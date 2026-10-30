import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CompareChart, RangePicker, type CompareMode, type Range } from '../components/Charts';
import { PlayerSearchBox } from '../components/Search';
import { Delta, Icon, Loading, useMobile } from '../components/ui';
import { usePlayers, useDataset, type Player } from '../lib/data';
import { displayName, fmtDate, fmtMonth, isActive, relative, SERIES, winPct } from '../lib/format';
import { compareTray, MAX_COMPARE } from '../lib/store';
import { formatScore } from './PlayerPage';

export default function Compare() {
  const ds = useDataset();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<CompareMode>('date');
  const [range, setRange] = useState<Range>('all');
  const mobile = useMobile();

  const ids = useMemo(() => {
    const fromUrl = (params.get('ids') ?? '').split(',').map(Number).filter((n) => n > 0);
    return [...new Set(fromUrl.length ? fromUrl : compareTray.get())].slice(0, MAX_COMPARE);
  }, [params]);

  // URL is the source of truth (shareable links); the tray mirrors it so selections persist across pages.
  const setIds = (next: number[]) => {
    compareTray.set(next);
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true });
  };
  useEffect(() => { compareTray.set(ids); }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const details = usePlayers(ids);
  const players = ids.map((id) => ds?.byId.get(id)).filter((p): p is Player => !!p);
  const histories = useMemo(() => new Map([...details].map(([id, d]) => [id, d.history])), [details]);

  if (!ds) return <Loading h={500} />;

  const suggest = () => setIds(ds.players.filter((p) => isActive(p)).slice(0, 4).map((p) => p.id));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1>Compare players</h1>
        <p className="ink2" style={{ margin: '6px 0 0' }}>Overlay rating histories, line up stats, and see head-to-head records — for up to {MAX_COMPARE} players.</p>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        {players.length < MAX_COMPARE && (
          <PlayerSearchBox ds={ds} exclude={ids} placeholder={players.length ? 'Add another player…' : 'Search for a player to compare…'}
            onPick={(p) => setIds([...ids, p.id])} />
        )}
        {players.length > 0 ? (
          <div className="chips">
            {players.map((p, i) => (
              <span key={p.id} className="chip">
                <span className="dot" style={{ background: SERIES[i], width: 10, height: 10 }} />
                <Link to={`/player/${p.id}`}>{displayName(p.name)}</Link>
                <span className="muted num small">{p.rating}</span>
                <button onClick={() => setIds(ids.filter((x) => x !== p.id))} aria-label={`Remove ${displayName(p.name)}`}><Icon name="x" size={14} /></button>
              </span>
            ))}
            {players.length > 1 && <button className="btn sm" onClick={() => setIds([])}>Clear all</button>}
          </div>
        ) : (
          <div className="row wrap small muted">
            Tip: tap <b className="ink2">Compare</b> on any player, or <button className="btn sm" onClick={suggest}>try the current top 4</button>
          </div>
        )}
      </div>

      {players.length > 0 && (
        <>
          <div className="card">
            <div className="card-head wrap">
              <h2>Rating history</h2>
              <span className="spacer" />
              <div className="seg" role="group" aria-label="X axis">
                <button className={mode === 'date' ? 'on' : ''} onClick={() => setMode('date')}>By date</button>
                <button className={mode === 'career' ? 'on' : ''} onClick={() => setMode('career')} title="Align everyone at their first rated event">By career</button>
              </div>
              {mode === 'date' && <RangePicker value={range} onChange={setRange} />}
            </div>
            {details.size < players.length ? <Loading h={380} /> : <CompareChart players={players} histories={histories} mode={mode} range={range} height={mobile ? 280 : 380} />}
            {mode === 'career' && <p className="small muted" style={{ margin: '8px 0 0' }}>Career view starts every player at year 0 — their first rated event — to compare development speed.</p>}
          </div>

          <StatsTable players={players} details={details} />
          {players.length > 1 && <HeadToHead players={players} details={details} />}
        </>
      )}
    </div>
  );
}

type Details = ReturnType<typeof usePlayers>;

function StatsTable({ players, details }: { players: Player[]; details: Details }) {
  const mobile = useMobile();
  const rows: { label: string; get: (p: Player) => number | null; show?: (p: Player) => ReactNode; better?: 1 | -1 }[] = [
    { label: 'Current rating', get: (p) => p.rating, show: (p) => <><b className="rating">{p.rating}</b><span className="sd">±{p.sd}</span></>, better: 1 },
    { label: '12-month change', get: (p) => p.ch12, show: (p) => <Delta v={p.ch12} />, better: 1 },
    { label: 'Peak rating', get: (p) => p.peak, show: (p) => <>{p.peak} <span className="small muted">{fmtMonth(p.peakDate)}</span></>, better: 1 },
    { label: 'Win rate', get: (p) => winPct(p.w, p.l), show: (p) => <>{winPct(p.w, p.l) ?? '—'}% <span className="small muted">{p.w}–{p.l}</span></>, better: 1 },
    { label: 'Matches', get: (p) => p.w + p.l, better: 1 },
    { label: 'Events', get: (p) => p.events, better: 1 },
    {
      label: 'Avg. opponent', better: 1,
      get: (p) => { const m = details.get(p.id)?.matches; return m?.length ? Math.round(m.reduce((s, x) => s + x.om, 0) / m.length) : null; },
    },
    {
      label: 'Best win', better: 1,
      get: (p) => details.get(p.id)?.matches.filter((m) => m.w).reduce((a, m) => Math.max(a, m.om), 0) || null,
    },
    { label: 'First event', get: () => null, show: (p) => fmtDate(p.first) },
    { label: 'Last played', get: () => null, show: (p) => relative(p.lastPlayed) },
  ];

  return (
    <div className="card flush">
      <div className="card-head"><h2>Side by side</h2><span className="sub">best value in each row highlighted</span></div>
      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table className="sticky-first">
          <thead><tr><th />{players.map((p, i) => (
            <th key={p.id} className="r" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, color: 'var(--ink)' }}>
              <span className="row" style={{ justifyContent: 'flex-end', gap: 6 }}><span className="dot" style={{ background: SERIES[i] }} />{mobile ? displayName(p.name).split(' ')[0] : displayName(p.name)}</span>
            </th>
          ))}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const vals = players.map(r.get);
              const nums = vals.filter((v): v is number => v != null);
              const best = r.better && nums.length > 1 && new Set(nums).size > 1 ? (r.better === 1 ? Math.max(...nums) : Math.min(...nums)) : null;
              return (
                <tr key={r.label}>
                  <td className="muted small nowrap">{r.label}</td>
                  {players.map((p, i) => (
                    <td key={p.id} className="r num nowrap" style={best != null && vals[i] === best ? { background: 'var(--accent-soft)', fontWeight: 650 } : undefined}>
                      {r.show ? r.show(p) : (vals[i] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeadToHead({ players, details }: { players: Player[]; details: Details }) {
  const record = (a: Player, b: Player) => {
    const ms = details.get(a.id)?.matches.filter((m) => m.o === b.id) ?? [];
    return { w: ms.filter((m) => m.w).length, n: ms.length, ms };
  };

  const meetings = players.length === 2 ? record(players[0], players[1]).ms : [];

  return (
    <div className="card flush">
      <div className="card-head"><h2>Head to head</h2><span className="sub">row player’s record against column player</span></div>
      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table className="sticky-first">
          <thead><tr><th />{players.map((p, i) => (
            <th key={p.id} className="c"><span className="dot" style={{ background: SERIES[i], marginRight: 6 }} />{displayName(p.name).split(' ')[0]}</th>
          ))}</tr></thead>
          <tbody>
            {players.map((a, i) => (
              <tr key={a.id}>
                <td className="nowrap"><span className="dot" style={{ background: SERIES[i], marginRight: 8 }} /><b>{displayName(a.name).split(' ')[0]}</b></td>
                {players.map((b) => {
                  if (a.id === b.id) return <td key={b.id} className="c muted">—</td>;
                  const r = record(a, b);
                  if (!r.n) return <td key={b.id} className="c muted small">never met</td>;
                  const lead = r.w * 2 > r.n ? 'w' : r.w * 2 < r.n ? 'l' : '';
                  return <td key={b.id} className="c"><span className={`badge ${lead}`}>{r.w}–{r.n - r.w}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meetings.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="card-head" style={{ paddingBottom: 6 }}><h3>All meetings</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Winner</th><th className="hide-sm">Games ({displayName(players[0].name).split(' ')[0]} first)</th><th className="r">Ratings then</th></tr></thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr key={i}>
                    <td className="nowrap muted small">{fmtDate(m.d)}</td>
                    <td><span className="row"><span className="dot" style={{ background: SERIES[m.w ? 0 : 1] }} /><b>{displayName((m.w ? players[0] : players[1]).name)}</b></span></td>
                    <td className="hide-sm score">{formatScore(m.sc).join('  ')}</td>
                    <td className="r num small">{m.pm} vs {m.om}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
