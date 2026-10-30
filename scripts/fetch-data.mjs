#!/usr/bin/env node
// Pulls public CSV exports from Ratings Central and writes static JSON for the site.
// Incremental: a player's history/matches are only re-fetched when their LastEvent changes.
//
// Usage: node scripts/fetch-data.mjs [--full]
// Region is configured in scripts/region.json.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
const PLAYER_DIR = path.join(OUT, 'p');
const BASE = 'https://www.ratingscentral.com';
const FULL = process.argv.includes('--full');
// Ratings Central returns 403 when hit too fast, so stay sequential and polite.
const CONCURRENCY = 1;
const DELAY_MS = 350;

const region = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts', 'region.json'), 'utf8'));

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 6) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'tt-ratings-explorer (static site builder)' } });
      if (res.status === 403 || res.status === 429) {
        const wait = 30_000 * i;
        console.log(`\n  rate limited (${res.status}), waiting ${wait / 1000}s…`);
        await sleep(wait);
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) throw new Error('Got HTML instead of CSV');
      return text;
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await sleep(1000 * i * i);
    }
  }
}

// RFC4180-ish CSV parser (handles quoted fields with commas/quotes/newlines)
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const num = (v) => (v === '' || v == null ? null : Number(v));
const qs = (o) => new URLSearchParams(o).toString();

async function pool(items, worker) {
  let idx = 0, done = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < items.length) {
      const item = items[idx++];
      await worker(item);
      done++;
      if (done % 25 === 0 || done === items.length) process.stdout.write(`  ${done}/${items.length}\r`);
      await sleep(DELAY_MS);
    }
  });
  await Promise.all(runners);
  process.stdout.write('\n');
}

async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

// ---------- fetch ----------

await fs.mkdir(PLAYER_DIR, { recursive: true });

console.log(`Region: ${region.name}`);
console.log('Fetching clubs…');
const clubRows = parseCSV(await get(`${BASE}/ClubList.php?${qs({
  ClubSport: 'Any', ClubCountry: region.country, CSV_Output: 'Text',
})}`));
const clubs = Object.fromEntries(clubRows.map((c) => [c.ID, {
  id: Number(c.ID), name: c.Name, short: c.Nickname || '', city: c.City, province: c.Province,
  website: c.Website || '', active: c.Status === 'Active',
}]));

// Players registered in the region, plus anyone whose primary club is in the region
// (people often keep an interstate address on their Ratings Central record).
console.log('Fetching player list…');
const byId = new Map();
const addRows = (rows) => { for (const r of rows) if (!byId.has(r.ID)) byId.set(r.ID, r); };
addRows(parseCSV(await get(`${BASE}/PlayerList.php?${qs({
  PlayerSport: 'Any', PlayerCountry: region.country, PlayerProvince: region.province,
  SortOrder: 'Rating', CSV_Output: 'Text',
})}`)));
const regionClubs = clubRows.filter((c) => c.Province === region.province);
for (const c of regionClubs) {
  await sleep(DELAY_MS);
  addRows(parseCSV(await get(`${BASE}/PlayerList.php?${qs({ PlayerSport: 'Any', ClubID: c.ID, SortOrder: 'Rating', CSV_Output: 'Text' })}`)));
}
const playerRows = [...byId.values()].sort((a, b) => (num(b.Rating) ?? -1) - (num(a.Rating) ?? -1));
playerRows.forEach((r, i) => { r.Rank = String(i + 1); });
console.log(`  ${playerRows.length} players (region + ${regionClubs.length} local clubs)`);

// A detail file records the LastEvent it was built from; refetch only when that changed.
const toFetch = [];
for (const r of playerRows) {
  const prev = FULL ? null : await readJSON(path.join(PLAYER_DIR, `${r.ID}.json`), null);
  const prevLast = prev ? (prev.lastEvent ?? prev.history.at(-1)?.e ?? null) : undefined;
  if (prevLast !== num(r.LastEvent)) toFetch.push(r);
}
console.log(`Fetching history + matches for ${toFetch.length} players (${playerRows.length - toFetch.length} unchanged)…`);

const failed = [];
await pool(toFetch, async (r) => {
  const id = r.ID;
  let histCsv, matchCsv;
  try {
    histCsv = await get(`${BASE}/PlayerHistory.php?${qs({ PlayerID: id, CSV_Output: 'Text' })}`);
    await sleep(DELAY_MS);
    matchCsv = await get(`${BASE}/MatchList.php?${qs({ PlayerID: id, CSV_Output: 'Text' })}`);
  } catch (err) {
    failed.push(id);
    console.log(`\n  skipped ${id}: ${err.message}`);
    return;
  }
  const history = parseCSV(histCsv)
    .map((h) => ({
      e: Number(h.EventID), d: h.EventDate, n: h.EventName,
      im: num(h.InitialMean), is: num(h.InitialStDev), pc: num(h.PointChange),
      m: num(h.FinalMean), s: num(h.FinalStDev),
    }))
    .sort((a, b) => a.d.localeCompare(b.d) || a.e - b.e);
  const matches = parseCSV(matchCsv)
    .map((m) => ({
      e: Number(m.EventID), d: m.EventDate, o: Number(m.OpponentID), on: m.OpponentName,
      om: num(m.OpponentMean), os: num(m.OpponentStDev), w: m.WonLost === 'W' ? 1 : 0,
      pc: num(m.PointChange), sc: m.Score, pm: num(m.PlayerMean),
    }))
    .sort((a, b) => b.d.localeCompare(a.d) || b.e - a.e);
  await fs.writeFile(path.join(PLAYER_DIR, `${id}.json`), JSON.stringify({ id: Number(id), lastEvent: num(r.LastEvent), history, matches }));
});

// ---------- build index ----------

console.log('Building index…');
const now = new Date();
const isoDaysAgo = (n) => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10);
const yearAgo = isoDaysAgo(365);

const players = [];
const events = new Map();

for (const r of playerRows) {
  const id = Number(r.ID);
  const detail = await readJSON(path.join(PLAYER_DIR, `${id}.json`), { history: [], matches: [] });
  const h = detail.history;
  const peak = h.reduce((best, x) => (x.m > (best?.m ?? -1) ? x : best), null);
  const before = [...h].reverse().find((x) => x.d < yearAgo);
  const rating = num(r.Rating);
  const wins = detail.matches.filter((m) => m.w).length;

  // sparkline: down-sample to <= 30 points
  const step = Math.max(1, Math.ceil(h.length / 30));
  const spark = h.filter((_, i) => i % step === 0 || i === h.length - 1).map((x) => x.m);

  players.push({
    id, name: r.Name, rating, sd: num(r.StDev), club: num(r.PrimaryClub),
    city: r.City, sex: r.Sex, lastPlayed: r.LastPlayed || null, lastEvent: num(r.LastEvent),
    rank: num(r.Rank), ittf: r.ITTF === 'Y', tta: num(r.TTA_ID) || null,
    deceased: r.Deceased === 'Y',
    first: h[0]?.d ?? null, events: h.length, peak: peak?.m ?? rating, peakDate: peak?.d ?? null,
    // change over the last 12 months; null if they haven't played in that time
    ch12: !h.length || h.at(-1).d < yearAgo || rating == null ? null : rating - (before ? before.m : h[0].im ?? rating),
    w: wins, l: detail.matches.length - wins, spark,
  });

  for (const x of h) {
    let ev = events.get(x.e);
    if (!ev) events.set(x.e, (ev = { id: x.e, name: x.n, date: x.d, players: [] }));
    ev.players.push({ id, pc: x.pc, m: x.m, im: x.im });
  }
}

const eventList = [...events.values()]
  .map((e) => ({ ...e, players: e.players.sort((a, b) => b.pc - a.pc) }))
  .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

const usedClubs = new Set(players.map((p) => p.club));
const clubOut = Object.values(clubs).filter((c) => usedClubs.has(c.id));

await fs.writeFile(path.join(OUT, 'players.json'), JSON.stringify({ players }));
await fs.writeFile(path.join(OUT, 'clubs.json'), JSON.stringify(clubOut));
await fs.writeFile(path.join(OUT, 'events.json'), JSON.stringify(eventList));
await fs.writeFile(path.join(OUT, 'meta.json'), JSON.stringify({
  region: region.name, updated: now.toISOString(), players: players.length, events: eventList.length,
}));

if (failed.length) console.log(`${failed.length} players failed and will be retried next run.`);
console.log(`Done: ${players.length} players, ${eventList.length} events, ${clubOut.length} clubs.`);
