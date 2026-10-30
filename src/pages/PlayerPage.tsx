import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RangePicker, RatingHistoryChart, type Range } from '../components/Charts';
import { Avatar, CompareButton, Delta, Icon, Loading, StarButton, Stat, cmp, useSort } from '../components/ui';
import { loadPlayer, rcPlayerUrl, useDataset, type Dataset, type MatchRow, type PlayerDetail } from '../lib/data';
import { displayName, fmtDate, fmtMonth, isActive, relative, winPct } from '../lib/format';

/** Scores use the usual shorthand of the loser's points per game, negative when the player lost: "6,-4" -> 11-6, 4-11. */
export function formatScore(sc: string): string[] {
  if (!sc) return [];
  return sc.split(',').map((g) => {
    const t = g.trim();
    const neg = t.startsWith('-');
    const n = Math.abs(Number(t));
    const win = Math.max(11, n + 2);
    return neg ? `${n}-${win}` : `${win}-${n}`;
  });
}

function OpponentLink({ ds, m }: { ds: Dataset; m: MatchRow }) {
  const known = ds.byId.has(m.o);
  const name = displayName(m.on);
  return known ? <Link className="pname" to={`/player/${m.o}`} onClick={(e) => e.stopPropagation()}>{name}</Link>
    : <a className="pname" href={rcPlayerUrl(m.o)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{name} <Icon name="external" size={12} /></a>;
}

function ScoreChips({ sc }: { sc: string }) {
  return <span className="score">{formatScore(sc).join('  ')}</span>;
}

function MatchTable({ ds, matches, showEvent = true }: { ds: Dataset; matches: MatchRow[]; showEvent?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          {showEvent && <th>Date</th>}<th>Opponent</th><th className="r">Opp. rating</th><th className="c">Result</th>
          <th className="hide-sm">Games</th><th className="r">Pts</th>
        </tr></thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={i}>
              {showEvent && <td className="nowrap muted small">{fmtDate(m.d)}</td>}
              <td><OpponentLink ds={ds} m={m} /></td>
              <td className="r num">{m.om}<span className="sd">±{m.os}</span></td>
              <td className="c"><span className={`badge ${m.w ? 'w' : 'l'}`}>{m.w ? 'Won' : 'Lost'}</span></td>
              <td className="hide-sm"><ScoreChips sc={m.sc} /></td>
              <td className="r"><Delta v={m.pc} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- tabs ----------

function EventsTab({ ds, d }: { ds: Dataset; d: PlayerDetail }) {
  const [open, setOpen] = useState<number | null>(null);
  const byEvent = useMemo(() => {
    const m = new Map<number, MatchRow[]>();
    for (const x of d.matches) { if (!m.has(x.e)) m.set(x.e, []); m.get(x.e)!.push(x); }
    return m;
  }, [d]);
  const rows = [...d.history].reverse();
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Event</th><th className="r hide-sm">Before</th><th className="r">After</th><th className="r">Change</th><th className="c hide-sm">W–L</th></tr></thead>
        <tbody>
          {rows.map((h) => {
            const ms = byEvent.get(h.e) ?? [];
            const w = ms.filter((m) => m.w).length;
            const isOpen = open === h.e;
            return (
              <Fragment key={h.e}>
                <tr className="clickable" onClick={() => setOpen(isOpen ? null : h.e)} aria-expanded={isOpen}>
                  <td className="nowrap muted small">{fmtDate(h.d)}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{h.n}</span>{' '}
                    <span className="muted small">{ms.length ? (isOpen ? '▾' : '▸') : ''}</span>
                  </td>
                  <td className="r num muted hide-sm">{h.im}</td>
                  <td className="r"><span className="rating">{h.m}</span><span className="sd">±{h.s}</span></td>
                  <td className="r"><Delta v={h.pc} /></td>
                  <td className="c num hide-sm">{ms.length ? `${w}–${ms.length - w}` : '—'}</td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={6} style={{ background: 'var(--surface-2)', padding: 8 }}>
                    <div className="card flush" style={{ boxShadow: 'none' }}>
                      {ms.length ? <MatchTable ds={ds} matches={ms} showEvent={false} /> : <div className="muted small" style={{ padding: 12 }}>No match details.</div>}
                      <div style={{ padding: '8px 12px' }}><Link className="link small" to={`/event/${h.e}`}>View event →</Link></div>
                    </div>
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchesTab({ ds, d }: { ds: Dataset; d: PlayerDetail }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<'' | 'W' | 'L'>('');
  const [limit, setLimit] = useState(100);
  const rows = d.matches.filter((m) =>
    (!q || displayName(m.on).toLowerCase().includes(q.toLowerCase()) || m.on.toLowerCase().includes(q.toLowerCase())) &&
    (!res || (res === 'W') === !!m.w));
  return (
    <>
      <div className="row wrap" style={{ padding: 12, gap: 10 }}>
        <input className="input" style={{ flex: '1 1 200px' }} placeholder="Filter by opponent…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by opponent" />
        <div className="seg">
          {(['', 'W', 'L'] as const).map((r) => <button key={r} className={res === r ? 'on' : ''} onClick={() => setRes(r)}>{r === '' ? 'All' : r === 'W' ? 'Wins' : 'Losses'}</button>)}
        </div>
        <span className="small muted">{rows.length} matches</span>
      </div>
      <MatchTable ds={ds} matches={rows.slice(0, limit)} />
      {rows.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit(limit + 200)}>Show more</button></div>}
    </>
  );
}

interface Opp { id: number; name: string; n: number; w: number; last: string; rating: number | null; pts: number }
type OppKey = 'n' | 'w' | 'pct' | 'last' | 'rating' | 'name' | 'pts';

function OpponentsTab({ ds, d }: { ds: Dataset; d: PlayerDetail }) {
  const nav = useNavigate();
  const { sort, th } = useSort<OppKey>('n');
  const opps = useMemo(() => {
    const m = new Map<number, Opp>();
    for (const x of d.matches) {
      let o = m.get(x.o);
      if (!o) m.set(x.o, (o = { id: x.o, name: x.on, n: 0, w: 0, last: x.d, rating: ds.byId.get(x.o)?.rating ?? x.om, pts: 0 }));
      o.n++; o.w += x.w; o.pts += x.pc;
      if (x.d > o.last) o.last = x.d;
    }
    return [...m.values()];
  }, [d, ds]);
  const val = (o: Opp) => (sort.key === 'pct' ? o.w / o.n : sort.key === 'name' ? displayName(o.name) : o[sort.key]);
  const rows = [...opps].sort((a, b) => cmp(val(a), val(b), sort.dir) || b.n - a.n);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          {th('name', 'Opponent', '', 1)}{th('rating', 'Rating', 'r')}{th('n', 'Played', 'r')}
          {th('w', 'W–L', 'c')}{th('pct', 'Win %', 'r')}{th('pts', 'Net pts', 'r hide-sm')}{th('last', 'Last met', 'r hide-sm')}<th className="hide-sm" />
        </tr></thead>
        <tbody>
          {rows.map((o) => {
            const pct = Math.round((100 * o.w) / o.n);
            return (
              <tr key={o.id}>
                <td>{ds.byId.has(o.id) ? <Link className="pname" to={`/player/${o.id}`}>{displayName(o.name)}</Link>
                  : <a className="pname" href={rcPlayerUrl(o.id)} target="_blank" rel="noreferrer">{displayName(o.name)} <Icon name="external" size={12} /></a>}</td>
                <td className="r num">{o.rating ?? '—'}</td>
                <td className="r num">{o.n}</td>
                <td className="c num">{o.w}–{o.n - o.w}</td>
                <td className="r">
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <div className="bar-track hide-sm" style={{ width: 60 }}><div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--series-1)' }} /></div>
                    <span className="num" style={{ width: 38 }}>{pct}%</span>
                  </div>
                </td>
                <td className="r hide-sm"><Delta v={o.pts} /></td>
                <td className="r muted small nowrap hide-sm">{fmtMonth(o.last)}</td>
                <td className="hide-sm">{ds.byId.has(o.id) && <button className="btn sm" onClick={() => nav(`/compare?ids=${d.id},${o.id}`)}>Head-to-head</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HighlightsTab({ ds, d }: { ds: Dataset; d: PlayerDetail }) {
  const wins = d.matches.filter((m) => m.w).sort((a, b) => b.om - a.om).slice(0, 6);
  const upsets = d.matches.filter((m) => !m.w).sort((a, b) => a.om - b.om).slice(0, 6);
  const best = [...d.history].sort((a, b) => b.pc - a.pc).slice(0, 5);

  // win rate by rating difference (opponent − player at the time)
  const buckets = [
    { label: '200+ below', lo: -Infinity, hi: -200 }, { label: '100–200 below', lo: -200, hi: -100 },
    { label: 'Within 100 below', lo: -100, hi: 0 }, { label: 'Within 100 above', lo: 0, hi: 100 },
    { label: '100–200 above', lo: 100, hi: 200 }, { label: '200+ above', lo: 200, hi: Infinity },
  ].map((b) => {
    const ms = d.matches.filter((m) => { const diff = m.om - m.pm; return diff >= b.lo && diff < b.hi; });
    return { ...b, n: ms.length, w: ms.filter((m) => m.w).length };
  });

  const Row = ({ m }: { m: MatchRow }) => (
    <div className="list-item" style={{ padding: '8px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <OpponentLink ds={ds} m={m} />
        <div className="small muted">{fmtDate(m.d)} · <ScoreChips sc={m.sc} /></div>
      </div>
      <span className="rating">{m.om}</span>
    </div>
  );

  return (
    <div className="grid grid-2" style={{ padding: 18 }}>
      <div>
        <h3 style={{ marginBottom: 6 }}>🏆 Best wins</h3>
        {wins.length ? wins.map((m, i) => <Row key={i} m={m} />) : <p className="muted small">No wins recorded.</p>}
      </div>
      <div>
        <h3 style={{ marginBottom: 6 }}>Toughest losses</h3>
        {upsets.length ? upsets.map((m, i) => <Row key={i} m={m} />) : <p className="muted small">No losses recorded.</p>}
      </div>
      <div>
        <h3 style={{ marginBottom: 10 }}>Win rate by opponent strength</h3>
        <div className="stack" style={{ gap: 8 }}>
          {buckets.map((b) => {
            const pct = b.n ? Math.round((100 * b.w) / b.n) : null;
            return (
              <div key={b.label} className="row" style={{ gap: 10 }}>
                <span className="small ink2" style={{ width: 120, flexShrink: 0 }}>{b.label}</span>
                <div className="bar-track" style={{ flex: 1, height: 10 }}>
                  {pct != null && <div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--series-1)' }} />}
                </div>
                <span className="small num" style={{ width: 90, textAlign: 'right' }}>{pct != null ? `${pct}%` : '—'} <span className="muted">({b.n})</span></span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 style={{ marginBottom: 6 }}>Best events</h3>
        {best.map((h) => (
          <div key={h.e} className="list-item" style={{ padding: '8px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/event/${h.e}`} className="pname">{h.n}</Link>
              <div className="small muted">{fmtDate(h.d)} · {h.im} → {h.m}</div>
            </div>
            <Delta v={h.pc} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- page ----------

const TABS = ['Events', 'Matches', 'Opponents', 'Highlights'] as const;

export default function PlayerPage() {
  const id = Number(useParams().id);
  const ds = useDataset();
  const [d, setD] = useState<PlayerDetail | null>(null);
  const [err, setErr] = useState(false);
  const [range, setRange] = useState<Range>('all');
  const [band, setBand] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Events');

  useEffect(() => {
    setD(null); setErr(false); setTab('Events');
    loadPlayer(id).then(setD, () => setErr(true));
  }, [id]);

  const p = ds?.byId.get(id);
  if (ds && !p) return <div className="card"><h2>Player not found</h2><p className="muted">No player #{id} in this region. <a className="link" href={rcPlayerUrl(id)}>Try Ratings Central →</a></p></div>;
  if (!ds || !p) return <div className="stack"><Loading h={160} /><Loading h={360} /></div>;

  const club = p.club != null ? ds.clubs.get(p.club) : undefined;
  const pct = winPct(p.w, p.l);
  const bestWin = d?.matches.filter((m) => m.w).reduce<MatchRow | null>((a, b) => (!a || b.om > a.om ? b : a), null);
  const activeRank = isActive(p) && p.rating != null
    ? ds.players.filter((x) => isActive(x) && (x.rating ?? 0) > p.rating!).length + 1 : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card">
        <div className="hero-player">
          <Avatar p={p} size="lg" />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h1>{displayName(p.name)}</h1>
            <div className="row wrap" style={{ marginTop: 6, gap: 6 }}>
              {club && <Link to={`/club/${club.id}`} className="badge accent">{club.name}</Link>}
              {activeRank && <span className="badge"><Icon name="trophy" size={12} />#{activeRank} active in {ds.meta.region}</span>}
              {p.ittf && <span className="badge">ITTF</span>}
              <span className="badge">ID {p.id}</span>
              {!isActive(p) && <span className="badge">Inactive · last played {relative(p.lastPlayed)}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="big-rating num">{p.rating ?? '—'}</div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
              <span className="muted small">±{p.sd}</span><Delta v={p.ch12} /><span className="small muted">12 mo</span>
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
          <StarButton id={p.id} />
          <CompareButton id={p.id} />
          <a className="btn" href={rcPlayerUrl(p.id)} target="_blank" rel="noreferrer"><Icon name="external" size={15} />Ratings Central</a>
        </div>
      </div>

      <div className="grid grid-4">
        <Stat label="Peak rating" value={p.peak ?? '—'} foot={p.peakDate ? fmtMonth(p.peakDate) : undefined} />
        <Stat label="Match record" value={<>{p.w}<span className="muted">–</span>{p.l}</>} foot={pct != null ? `${pct}% win rate` : 'No matches'} />
        <Stat label="Events played" value={p.events} foot={p.first ? `since ${new Date(p.first).getFullYear()}` : undefined} />
        <Stat label="Best win" value={bestWin ? bestWin.om : '—'} foot={bestWin ? displayName(bestWin.on) : d ? 'No wins yet' : '…'} />
      </div>

      <div className="card">
        <div className="card-head wrap">
          <h2>Rating history</h2>
          <span className="spacer" />
          <label className="toggle small"><input type="checkbox" checked={band} onChange={(e) => setBand(e.target.checked)} />Uncertainty band</label>
          <RangePicker value={range} onChange={setRange} />
        </div>
        {d ? <RatingHistoryChart history={d.history} range={range} showBand={band} /> : err ? <p className="muted">Couldn’t load history.</p> : <Loading h={320} />}
        {band && <p className="small muted" style={{ margin: '8px 0 0' }}>Shaded band shows rating ± one standard deviation — narrower means Ratings Central is more confident.</p>}
      </div>

      <div className="card flush">
        <div className="tabs" role="tablist">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        {!d ? <div style={{ padding: 18 }}><Loading h={200} /></div> : (
          <>
            {tab === 'Events' && <EventsTab ds={ds} d={d} />}
            {tab === 'Matches' && <MatchesTab ds={ds} d={d} />}
            {tab === 'Opponents' && <OpponentsTab ds={ds} d={d} />}
            {tab === 'Highlights' && <HighlightsTab ds={ds} d={d} />}
          </>
        )}
      </div>
    </div>
  );
}
