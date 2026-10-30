import { useMemo } from 'react';
import { useNational, type Dataset, type MatchRow, type Player, type PlayerDetail } from '../lib/data';
import { isActive, toTime } from '../lib/format';
import { Loading } from './ui';

const STATE_NAMES: Record<string, string> = {
  ACT: 'ACT', NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', SA: 'South Australia',
  WA: 'Western Australia', TAS: 'Tasmania', NT: 'Northern Territory',
};
const MILESTONES = [50, 25, 10, 5, 1];

/** Ratings sorted high → low. Rank counts strictly higher ratings, so ties share a rank. */
function standing(sorted: number[], rating: number, includesSelf: boolean) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] > rating) lo = mid + 1; else hi = mid; }
  const n = sorted.length + (includesSelf ? 0 : 1);
  const rank = lo + 1;
  const top = (100 * rank) / n;
  // next "top X%" milestone and the rating it takes to get there
  const goal = MILESTONES.find((t) => top > t && Math.floor((n * t) / 100) >= 1);
  const need = goal != null ? sorted[Math.floor((n * goal) / 100) - 1] : null;
  return { rank, n, top, better: Math.max(0, Math.round(100 - top)), goal, need };
}

const topLabel = (top: number) => `Top ${top < 1 ? top.toFixed(1).replace(/\.0$/, '') : Math.ceil(top)}%`;

interface Row { key: string; label: string; sub: string; s: ReturnType<typeof standing> }

export function StandingCard({ ds, p, you }: { ds: Dataset; p: Player; you?: boolean }) {
  const nat = useNational();
  const active = isActive(p);
  const club = p.club != null ? ds.clubs.get(p.club) : undefined;

  const rows = useMemo<Row[]>(() => {
    if (p.rating == null) return [];
    const r = p.rating;
    const sex = p.sex === 'F' ? 'F' : 'M';
    const out: Row[] = [];
    const localActive = ds.players.filter((x) => isActive(x) && x.rating != null);
    const sortDesc = (xs: Player[]) => xs.map((x) => x.rating!).sort((a, b) => b - a);

    if (nat) {
      out.push({ key: 'aus', label: 'Australia', sub: 'active players', s: standing(nat.r, r, active) });
      out.push({
        key: 'aus-sex', label: `Australia · ${sex === 'F' ? 'women' : 'men'}`, sub: `active ${sex === 'F' ? 'women' : 'men'}`,
        s: standing(nat.r.filter((_, i) => nat.s[i] === sex), r, active),
      });
      const st = p.state && p.state !== ds.meta.region ? nat.states.indexOf(p.state) : -1;
      if (st >= 0) out.push({
        key: 'state', label: STATE_NAMES[p.state!] ?? p.state!, sub: 'active players registered there',
        s: standing(nat.r.filter((_, i) => nat.p[i] === st), r, active),
      });
    }
    out.push({ key: 'region', label: ds.meta.region, sub: 'active players', s: standing(sortDesc(localActive), r, active) });
    if (club) {
      const members = localActive.filter((x) => x.club === club.id);
      if (members.length > 1 || !active) out.push({ key: 'club', label: club.short || club.name, sub: 'active club members', s: standing(sortDesc(members), r, active) });
    }
    return out;
  }, [ds, p, nat, active, club]);

  if (p.rating == null) return null;
  const aus = rows.find((x) => x.key === 'aus');

  return (
    <div className="card">
      <div className="card-head wrap">
        <h2>{you ? 'Where you stand' : 'Rankings'}</h2>
        <span className="sub">{active ? 'rank among players active in the last 12 months' : 'where this rating would rank today'}</span>
      </div>
      {!nat && <Loading h={60} />}
      <div className="standing">
        {rows.map(({ key, label, sub, s }) => (
          <div key={key} className="standing-row">
            <div className="standing-label">
              <b>{label}</b>
              <span className="small muted">#{s.rank.toLocaleString()} of {s.n.toLocaleString()} {sub}</span>
            </div>
            <div className="standing-bar" title={`Rated higher than ${s.better}% of ${sub}`}>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${s.better}%`, background: 'var(--accent)' }} /></div>
            </div>
            <span className="standing-top num">{topLabel(s.top)}</span>
          </div>
        ))}
      </div>
      {aus?.s.goal != null && aus.s.need != null && (
        <p className="small ink2" style={{ margin: '14px 0 0' }}>
          <b>Next milestone:</b> top {aus.s.goal}% in Australia at <b className="num">{aus.s.need}</b>
          {' '}— <span className="num">{aus.s.need - p.rating}</span> points to go.
        </p>
      )}
    </div>
  );
}

function byDate(a: MatchRow, b: MatchRow) { return a.d.localeCompare(b.d) || a.e - b.e; }

export function FormCard({ d }: { d: PlayerDetail | null }) {
  if (!d) return <div className="card"><Loading h={140} /></div>;
  const ms = [...d.matches].sort(byDate);
  const last = ms.slice(-10);
  let streak = 0;
  for (let i = ms.length - 1; i >= 0 && ms[i].w === ms.at(-1)!.w; i--) streak++;
  const cutoff = Date.now() - 90 * 864e5;
  const recent = ms.filter((m) => toTime(m.d) >= cutoff);
  const rw = recent.filter((m) => m.w).length;
  const upsets = ms.filter((m) => m.w && m.om > m.pm).length;
  const h = d.history;
  const last3 = h.slice(-3).reduce((s, x) => s + x.pc, 0);

  return (
    <div className="card">
      <div className="card-head"><h2>Form</h2><span className="sub">last 10 matches, oldest → newest</span></div>
      {!ms.length ? <p className="muted">No matches recorded.</p> : (
        <>
          <div className="form-dots" aria-label={`Last ${last.length} results`}>
            {last.map((m, i) => <span key={i} className={m.w ? 'w' : 'l'} title={`${m.w ? 'Won' : 'Lost'} vs ${m.on} (${m.om})`}>{m.w ? 'W' : 'L'}</span>)}
          </div>
          <div className="form-stats">
            <div><div className="kpi num">{ms.at(-1)!.w ? 'W' : 'L'}{streak}</div><div className="small muted">current streak</div></div>
            <div><div className="kpi num">{rw}–{recent.length - rw}</div><div className="small muted">last 3 months</div></div>
            <div><div className={`kpi num ${last3 > 0 ? 'up' : last3 < 0 ? 'down' : ''}`}>{last3 > 0 ? '+' : last3 < 0 ? '−' : ''}{Math.abs(last3)}</div><div className="small muted">last 3 events</div></div>
            <div><div className="kpi num">{upsets}</div><div className="small muted">wins vs higher-rated</div></div>
          </div>
        </>
      )}
    </div>
  );
}
