import { useEffect, useState } from 'react';

export interface Player {
  id: number;
  name: string;
  rating: number | null;
  sd: number | null;
  club: number | null;
  city: string;
  sex: string;
  lastPlayed: string | null;
  lastEvent: number | null;
  rank: number | null;
  ittf: boolean;
  tta: number | null;
  deceased: boolean;
  first: string | null;
  events: number;
  peak: number | null;
  peakDate: string | null;
  ch12: number | null;
  w: number;
  l: number;
  spark: number[];
}

export interface Club {
  id: number;
  name: string;
  short: string;
  city: string;
  province: string;
  website: string;
  active: boolean;
}

export interface EventEntry { id: number; pc: number; m: number; im: number }
export interface EventInfo { id: number; name: string; date: string; players: EventEntry[] }
export interface Meta { region: string; updated: string; players: number; events: number }

/** One row of a player's rating history (abbreviated keys keep the JSON small). */
export interface HistoryRow {
  e: number; d: string; n: string;
  im: number; is: number; pc: number; m: number; s: number;
}
/** One match: o = opponent id, om/os = opponent rating, w = 1 if won, sc = game scores. */
export interface MatchRow {
  e: number; d: string; o: number; on: string; om: number; os: number;
  w: 0 | 1; pc: number; sc: string; pm: number;
}
export interface PlayerDetail { id: number; history: HistoryRow[]; matches: MatchRow[] }

export interface Dataset {
  meta: Meta;
  players: Player[];
  byId: Map<number, Player>;
  clubs: Map<number, Club>;
}

export interface Events { list: EventInfo[]; byId: Map<number, EventInfo> }

const url = (p: string) => `${import.meta.env.BASE_URL}data/${p}`;

// meta.json is always revalidated; its timestamp versions every other data file,
// so a fresh deploy is picked up immediately instead of after the 10-minute Pages cache.
let versionPromise: Promise<Meta> | null = null;
function meta(): Promise<Meta> {
  versionPromise ??= fetch(url('meta.json'), { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('Failed to load meta.json');
    return r.json();
  });
  return versionPromise;
}

async function json<T>(p: string): Promise<T> {
  const { updated } = await meta();
  const res = await fetch(`${url(p)}?v=${encodeURIComponent(updated)}`);
  if (!res.ok) throw new Error(`Failed to load ${p}`);
  return res.json();
}

let datasetPromise: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  datasetPromise ??= Promise.all([
    meta(),
    json<{ players: Player[] }>('players.json'),
    json<Club[]>('clubs.json'),
  ]).then(([meta, { players }, clubs]) => ({
    meta,
    players,
    byId: new Map(players.map((p) => [p.id, p])),
    clubs: new Map(clubs.map((c) => [c.id, c])),
  }));
  return datasetPromise;
}

let eventsPromise: Promise<Events> | null = null;

export function loadEvents(): Promise<Events> {
  eventsPromise ??= json<EventInfo[]>('events.json').then((list) => ({ list, byId: new Map(list.map((e) => [e.id, e])) }));
  return eventsPromise;
}

export function useEvents(): Events | null {
  const [ev, setEv] = useState<Events | null>(null);
  useEffect(() => { loadEvents().then(setEv); }, []);
  return ev;
}

const detailCache = new Map<number, Promise<PlayerDetail>>();

export function loadPlayer(id: number): Promise<PlayerDetail> {
  let p = detailCache.get(id);
  if (!p) {
    p = json<PlayerDetail>(`p/${id}.json`);
    detailCache.set(id, p);
  }
  return p;
}

export function useDataset(): Dataset | null {
  const [ds, setDs] = useState<Dataset | null>(null);
  useEffect(() => { loadDataset().then(setDs); }, []);
  return ds;
}

export function usePlayers(ids: number[]): Map<number, PlayerDetail> {
  const [map, setMap] = useState(new Map<number, PlayerDetail>());
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(ids.map((id) => loadPlayer(id).catch(() => null))).then((list) => {
      if (!alive) return;
      setMap(new Map(list.filter((d): d is PlayerDetail => !!d).map((d) => [d.id, d])));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

export const rcPlayerUrl = (id: number) => `https://www.ratingscentral.com/Player.php?PlayerID=${id}`;
export const rcEventUrl = (id: number) => `https://www.ratingscentral.com/EventDetail.php?EventID=${id}`;
