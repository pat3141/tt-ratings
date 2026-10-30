import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Delta, Icon, Loading, PlayerCell, Stat, cmp, useSort } from '../components/ui';
import { rcEventUrl, useDataset, useEvents } from '../lib/data';
import { fmtDate } from '../lib/format';

export function Events() {
  const ds = useDataset();
  const ev = useEvents();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const [limit, setLimit] = useState(60);

  const years = useMemo(() => [...new Set(ev?.list.map((e) => e.date.slice(0, 4)))], [ev]);
  const rows = useMemo(() => (ev?.list ?? []).filter((e) =>
    (!year || e.date.startsWith(year)) && (!q || e.name.toLowerCase().includes(q.toLowerCase()))), [ev, q, year]);

  if (!ds || !ev) return <Loading h={500} />;

  return (
    <div className="stack">
      <div className="row"><h1>Events</h1><span className="badge">{rows.length}</span></div>
      <div className="card" style={{ padding: 12 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="search-wrap" style={{ flex: '1 1 260px' }}>
            <Icon name="search" size={17} />
            <input className="input" style={{ width: '100%', paddingLeft: 40 }} placeholder="Search events…" value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(60); }} aria-label="Search events" />
          </div>
          <select className="select" value={year} onChange={(e) => { setYear(e.target.value); setLimit(60); }} aria-label="Year">
            <option value="">All years</option>
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Event</th><th className="r">Players</th><th className="hide-sm">Biggest gain</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map((e) => {
                const top = e.players[0];
                const tp = top ? ds.byId.get(top.id) : undefined;
                return (
                  <tr key={e.id} className="clickable" onClick={() => nav(`/event/${e.id}`)}>
                    <td className="nowrap muted small">{fmtDate(e.date)}</td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td className="r num">{e.players.length}</td>
                    <td className="hide-sm">{tp && top.pc > 0 ? <span className="row"><Delta v={top.pc} /><span className="small ink2">{tp.name.split(', ').reverse().join(' ')}</span></span> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit && <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={() => setLimit(limit + 100)}>Show more</button></div>}
      </div>
    </div>
  );
}

type Key = 'pc' | 'm' | 'im';

export function EventPage() {
  const id = Number(useParams().id);
  const ds = useDataset();
  const nav = useNavigate();
  const { sort, th } = useSort<Key>('pc');
  const ev = useEvents();
  const e = ev?.byId.get(id);

  if (ev && !e) return <div className="card"><h2>Event not found</h2></div>;
  if (!ds || !e) return <Loading h={400} />;

  const rows = [...e.players].sort((a, b) => cmp(a[sort.key], b[sort.key], sort.dir));
  const gains = e.players.filter((p) => p.pc > 0).length;
  const avgBefore = Math.round(e.players.reduce((s, p) => s + p.im, 0) / e.players.length);
  const maxAbs = Math.max(1, ...e.players.map((p) => Math.abs(p.pc)));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <Link to="/events" className="link small">← All events</Link>
        <h1 style={{ marginTop: 6 }}>{e.name}</h1>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <span className="badge">{fmtDate(e.date)}</span>
          <a className="badge accent" href={rcEventUrl(e.id)} target="_blank" rel="noreferrer">Full results on Ratings Central <Icon name="external" size={12} /></a>
        </div>
      </div>
      <div className="grid grid-3">
        <Stat label={`${ds.meta.region} players`} value={e.players.length} />
        <Stat label="Average rating (before)" value={avgBefore} />
        <Stat label="Players who gained" value={`${gains}`} foot={`${Math.round((100 * gains) / e.players.length)}% of field`} />
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Player</th>{th('im', 'Before', 'r hide-sm')}{th('m', 'After', 'r')}{th('pc', 'Change', 'r')}<th className="hide-sm" style={{ width: '30%' }} /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const p = ds.byId.get(r.id)!;
                const w = (Math.abs(r.pc) / maxAbs) * 50;
                return (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/player/${r.id}`)}>
                    <td><PlayerCell p={p} ds={ds} /></td>
                    <td className="r num muted hide-sm">{r.im}</td>
                    <td className="r rating">{r.m}</td>
                    <td className="r"><Delta v={r.pc} /></td>
                    <td className="hide-sm">
                      <div className="bar-track" style={{ background: 'transparent' }}>
                        <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--axis)' }} />
                        <div className="bar-fill" style={r.pc >= 0
                          ? { left: '50%', width: `${w}%`, background: 'var(--up)' }
                          : { right: '50%', width: `${w}%`, background: 'var(--down)' }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted">Showing {ds.meta.region} players only. Opponents from other regions appear on Ratings Central.</p>
    </div>
  );
}
