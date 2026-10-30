import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Dataset, Player } from '../lib/data';
import { displayName, initials, signed } from '../lib/format';
import { compareTray, me as meStore, starred, unwatch, useList, useStore, watch, MAX_COMPARE } from '../lib/store';

const paths: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  home: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.4 0 4 1.5 4.5 4" /></>,
  compare: <><path d="M3 17 9 11l4 4 8-8" /><path d="M3 21h18" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  club: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 5 5 9-10" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></>,
};

export function Icon({ name, size = 18, fill = false }: { name: keyof typeof paths | string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={fill ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Avatar({ p, size }: { p: Pick<Player, 'id' | 'name'>; size?: 'lg' }) {
  const hue = (p.id * 137.508) % 360;
  return (
    <div className={`avatar ${size ?? ''}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 48%), hsl(${(hue + 40) % 360} 46% 38%))` }}>
      {initials(p.name)}
    </div>
  );
}

export function Delta({ v, suffix = '' }: { v: number | null | undefined; suffix?: string }) {
  if (v == null) return <span className="muted">—</span>;
  const cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  return (
    <span className={`delta ${cls}`}>
      {v !== 0 && <Icon name={v > 0 ? 'up' : 'down'} size={12} />}
      {v === 0 ? '0' : signed(v).replace('-', '−')}{suffix}
    </span>
  );
}

export function Rating({ p }: { p: Pick<Player, 'rating' | 'sd'> }) {
  if (p.rating == null) return <span className="muted">—</span>;
  return <span className="nowrap"><span className="rating">{p.rating}</span><span className="sd">±{p.sd}</span></span>;
}

export function Sparkline({ data, width = 90, height = 26 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const up = data.at(-1)! >= data[0];
  const color = up ? 'var(--up)' : 'var(--down)';
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

/** Watchlist toggle. Icon-only by default; `label` shows a full button (player page). */
export function StarButton({ id, rating, label }: { id: number; rating: number | null; label?: boolean }) {
  const list = useList(starred);
  const on = list.includes(id);
  const toggle = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); if (on) unwatch(id); else watch(id, rating); };
  if (label) {
    return (
      <button className={`btn ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on}>
        <span style={{ color: on ? 'var(--star)' : undefined, lineHeight: 0 }}><Icon name="star" size={16} fill={on} /></span>
        {on ? 'Watching' : 'Watch'}
      </button>
    );
  }
  return (
    <button className={`star ${on ? 'on' : ''}`} onClick={toggle} title={on ? 'Remove from watchlist' : 'Add to watchlist'} aria-pressed={on}>
      <Icon name="star" size={17} fill={on} />
    </button>
  );
}

/** Claim (or unclaim) a player as "me". */
export function MeButton({ id }: { id: number }) {
  const mine = useStore(meStore);
  const on = mine === id;
  return (
    <button className={`btn ${on ? 'on' : ''}`} onClick={() => meStore.set(on ? null : id)} aria-pressed={on}
      title={on ? 'Unlink this profile' : 'Save as my profile'}>
      <Icon name={on ? 'check' : 'user'} size={15} />{on ? 'My profile' : 'This is me'}
    </button>
  );
}

export function CompareButton({ id, small }: { id: number; small?: boolean }) {
  const list = useList(compareTray);
  const on = list.includes(id);
  const full = !on && list.length >= MAX_COMPARE;
  return (
    <button className={`btn ${small ? 'sm' : ''} ${on ? 'on' : ''}`} disabled={full}
      title={full ? `Compare holds up to ${MAX_COMPARE} players` : undefined}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); compareTray.toggle(id); }}>
      <Icon name={on ? 'check' : 'plus'} size={15} />{on ? 'Comparing' : 'Compare'}
    </button>
  );
}

export function PlayerCell({ p, ds, sub }: { p: Player; ds: Dataset; sub?: ReactNode }) {
  const club = p.club != null ? ds.clubs.get(p.club) : undefined;
  return (
    <div className="pcell">
      <Avatar p={p} />
      <div style={{ minWidth: 0 }}>
        <Link to={`/player/${p.id}`} className="pname" onClick={(e) => e.stopPropagation()}>{displayName(p.name)}</Link>
        <div className="meta">{sub ?? (club?.short || club?.name || p.city || `#${p.id}`)}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, foot }: { label: string; value: ReactNode; foot?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function Loading({ h = 240 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />;
}

/** Sortable table state: clicking the active column flips direction; a new column starts descending. */
export function useSort<K extends string>(initial: K, initialDir: 1 | -1 = -1) {
  const [sort, setSort] = useState<{ key: K; dir: 1 | -1 }>({ key: initial, dir: initialDir });
  const th = (key: K, label: ReactNode, cls = '', firstDir: 1 | -1 = -1) => (
    <th className={`sortable ${cls} ${sort.key === key ? 'sorted' : ''}`}
      onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: firstDir }))}
      aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  );
  return { sort, th };
}

/** Compare helper: nulls always sort last. */
export function cmp(a: unknown, b: unknown, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'string') return a.localeCompare(b as string) * dir;
  return ((a as number) - (b as number)) * dir;
}
