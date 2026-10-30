import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DistributionChart } from '../components/Charts';
import { CompareButton, Delta, Icon, Loading, PlayerCell, Rating, Sparkline, Stat, cmp, useSort } from '../components/ui';
import { useDataset, type Dataset, type Player } from '../lib/data';
import { displayName, isActive, relative } from '../lib/format';

function clubStats(ds: Dataset) {
  const by = new Map<number, Player[]>();
  for (const p of ds.players) if (p.club != null) { if (!by.has(p.club)) by.set(p.club, []); by.get(p.club)!.push(p); }
  return [...ds.clubs.values()].map((c) => {
    const members = by.get(c.id) ?? [];
    const active = members.filter((p) => isActive(p) && p.rating != null);
    const top = [...active].sort((a, b) => b.rating! - a.rating!)[0];
    const avg = active.length ? Math.round(active.reduce((s, p) => s + p.rating!, 0) / active.length) : null;
    return { c, members, active, top, avg };
  }).sort((a, b) => b.active.length - a.active.length || b.members.length - a.members.length);
}

export function Clubs() {
  const ds = useDataset();
  const stats = useMemo(() => (ds ? clubStats(ds) : []), [ds]);
  if (!ds) return <Loading h={400} />;
  return (
    <div className="stack">
      <h1>Clubs</h1>
      <div className="grid grid-3">
        {stats.map(({ c, members, active, top, avg }) => (
          <Link key={c.id} to={`/club/${c.id}`} className="card" style={{ display: 'block' }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 16 }}>{c.name}</h2>
                <div className="small muted">{[c.short, c.city].filter(Boolean).join(' · ')}</div>
              </div>
              {!c.active && <span className="badge">Inactive</span>}
            </div>
            <div className="row" style={{ marginTop: 16, gap: 20 }}>
              <div><div className="rating" style={{ fontSize: 22 }}>{active.length}</div><div className="small muted">active</div></div>
              <div><div className="rating" style={{ fontSize: 22 }}>{members.length}</div><div className="small muted">all-time</div></div>
              <div><div className="rating" style={{ fontSize: 22 }}>{avg ?? '—'}</div><div className="small muted">avg rating</div></div>
            </div>
            {top && <div className="small ink2" style={{ marginTop: 12 }}>Top: <b>{displayName(top.name)}</b> ({top.rating})</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}

type Key = 'rating' | 'ch12' | 'lastPlayed' | 'events';

export function ClubPage() {
  const id = Number(useParams().id);
  const ds = useDataset();
  const nav = useNavigate();
  const { sort, th } = useSort<Key>('rating');
  const s = useMemo(() => (ds ? clubStats(ds).find((x) => x.c.id === id) : undefined), [ds, id]);

  if (ds && !s) return <div className="card"><h2>Club not found</h2></div>;
  if (!ds || !s) return <Loading h={400} />;

  const rows = [...s.members].sort((a, b) => cmp(a[sort.key], b[sort.key], sort.dir));
  const climbers = s.active.filter((p) => (p.ch12 ?? 0) > 0).length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <Link to="/clubs" className="link small">← All clubs</Link>
        <h1 style={{ marginTop: 6 }}>{s.c.name}</h1>
        <div className="row wrap" style={{ marginTop: 8 }}>
          {s.c.city && <span className="badge">{s.c.city}</span>}
          {s.c.website && <a className="badge accent" href={s.c.website} target="_blank" rel="noreferrer">Website <Icon name="external" size={12} /></a>}
        </div>
      </div>
      <div className="grid grid-4">
        <Stat label="Active members" value={s.active.length} foot="played in last 12 months" />
        <Stat label="All-time members" value={s.members.length} />
        <Stat label="Average rating" value={s.avg ?? '—'} foot="active members" />
        <Stat label="Improved this year" value={climbers} foot={s.active.length ? `${Math.round((100 * climbers) / s.active.length)}% of active` : undefined} />
      </div>
      {s.active.length > 2 && (
        <div className="card">
          <div className="card-head"><h2>Rating spread</h2><span className="sub">active members</span></div>
          <DistributionChart ratings={s.active.map((p) => p.rating!)} height={180} />
        </div>
      )}
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Player</th>{th('rating', 'Rating', 'r')}{th('ch12', '12 mo', 'r')}<th className="hide-sm">Trend</th>{th('events', 'Events', 'r hide-sm')}{th('lastPlayed', 'Last played', 'r hide-sm')}<th className="hide-md" /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => nav(`/player/${p.id}`)}>
                  <td><PlayerCell p={p} ds={ds} sub={`#${p.id}`} /></td>
                  <td className="r"><Rating p={p} /></td>
                  <td className="r"><Delta v={p.ch12} /></td>
                  <td className="hide-sm"><Sparkline data={p.spark} /></td>
                  <td className="r num hide-sm">{p.events}</td>
                  <td className="r muted nowrap hide-sm">{relative(p.lastPlayed)}</td>
                  <td className="hide-md"><CompareButton id={p.id} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
