import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, CompareButton, Delta, Icon, Loading, MRow, PlayerCell, Rating, SortSelect, Sparkline, StarButton, cmp, useMobile, useSort } from '../components/ui';
import { useDataset, type Player } from '../lib/data';
import { displayName, isActive, relative } from '../lib/format';
import { searchPlayers } from '../lib/search';
import { starred, useList } from '../lib/store';

type Key = 'rating' | 'name' | 'ch12' | 'peak' | 'lastPlayed' | 'events' | 'winpct';
const PAGE = 50;

export default function Players() {
  const ds = useDataset();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const stars = useList(starred);
  const [limit, setLimit] = useState(PAGE);
  const { sort, th, setSort } = useSort<Key>('rating');
  const mobile = useMobile();
  const [showFilters, setShowFilters] = useState(false);

  const q = params.get('q') ?? '';
  const club = params.get('club') ?? '';
  const sex = params.get('sex') ?? '';
  const activity = params.get('active') ?? '365';
  const onlyStarred = params.get('starred') === '1';
  const minR = params.get('min') ?? '';
  const maxR = params.get('max') ?? '';

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  const rows = useMemo(() => {
    if (!ds) return [];
    let list: Player[] = q.trim() ? searchPlayers(ds, q, 500) : ds.players;
    list = list.filter((p) =>
      (!club || String(p.club) === club) &&
      (!sex || p.sex === sex) &&
      (activity === 'any' || isActive(p, Number(activity))) &&
      (!onlyStarred || stars.includes(p.id)) &&
      (!minR || (p.rating ?? 0) >= Number(minR)) &&
      (!maxR || (p.rating ?? 0) <= Number(maxR)));
    if (q.trim() && sort.key === 'rating' && sort.dir === -1) return list; // keep relevance order while searching
    const val = (p: Player) => {
      switch (sort.key) {
        case 'name': return displayName(p.name);
        case 'winpct': return p.w + p.l ? p.w / (p.w + p.l) : null;
        default: return p[sort.key];
      }
    };
    return [...list].sort((a, b) => cmp(val(a), val(b), sort.dir));
  }, [ds, q, club, sex, activity, onlyStarred, stars, minR, maxR, sort]);

  if (!ds) return <Loading h={500} />;

  const clubs = [...ds.clubs.values()].sort((a, b) => a.name.localeCompare(b.name));
  const activeFilters = [club, sex, activity !== '365' ? activity : '', onlyStarred ? '1' : '', minR, maxR].filter(Boolean).length;

  return (
    <div className="stack">
      <div className="row wrap">
        <h1>Players</h1>
        <span className="badge" style={{ marginLeft: 4 }}>{rows.length.toLocaleString()}</span>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="search-wrap" style={{ flex: '1 1 260px' }}>
            <Icon name="search" size={17} />
            <input className="input" style={{ width: '100%', paddingLeft: 40 }} placeholder="Filter by name, ID or club…"
              value={q} onChange={(e) => set('q', e.target.value)} aria-label="Filter players" />
          </div>
          {mobile && (
            <button className={`btn ${showFilters || activeFilters ? 'on' : ''}`} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              Filters{activeFilters ? ` · ${activeFilters}` : ''}
            </button>
          )}
          {(!mobile || showFilters) && <>
          <select className="select" value={activity} onChange={(e) => set('active', e.target.value === '365' ? '' : e.target.value)} aria-label="Activity">
            <option value="90">Played in last 3 months</option>
            <option value="365">Played in last 12 months</option>
            <option value="1095">Played in last 3 years</option>
            <option value="any">All players, ever</option>
          </select>
          <select className="select" value={club} onChange={(e) => set('club', e.target.value)} aria-label="Club" style={{ maxWidth: 240 }}>
            <option value="">All clubs</option>
            {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={sex} onChange={(e) => set('sex', e.target.value)} aria-label="Gender">
            <option value="">All genders</option><option value="M">Men</option><option value="F">Women</option>
          </select>
          <input className="input num" style={{ width: 82 }} placeholder="Min" inputMode="numeric" value={minR}
            onChange={(e) => set('min', e.target.value.replace(/\D/g, ''))} aria-label="Minimum rating" />
          <input className="input num" style={{ width: 82 }} placeholder="Max" inputMode="numeric" value={maxR}
            onChange={(e) => set('max', e.target.value.replace(/\D/g, ''))} aria-label="Maximum rating" />
          <label className="toggle"><input type="checkbox" checked={onlyStarred} onChange={(e) => set('starred', e.target.checked ? '1' : '')} />Watchlist</label>
          </>}
          {mobile && (
            <SortSelect value={sort} onChange={setSort} options={[
              ['rating', 'Rating'], ['ch12', '12-month change'], ['peak', 'Peak'], ['winpct', 'Win %'],
              ['events', 'Events'], ['lastPlayed', 'Recently played'], ['name', 'Name', 1],
            ]} />
          )}
        </div>
      </div>

      <div className="card flush">
        {mobile ? (
          <div className="mlist">
            {rows.slice(0, limit).map((p) => {
              const c = p.club != null ? ds.clubs.get(p.club) : undefined;
              return (
                <MRow key={p.id} onClick={() => nav(`/player/${p.id}`)} lead={<Avatar p={p} />}
                  title={displayName(p.name)}
                  meta={[c?.short || c?.name, `played ${relative(p.lastPlayed)}`].filter(Boolean).join(' · ')}
                  side={<><Rating p={p} /><Delta v={p.ch12} /></>} />
              );
            })}
            {!rows.length && <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No players match these filters.</div>}
          </div>
        ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                {th('name', 'Player', '', 1)}
                {th('rating', 'Rating', 'r')}
                {th('ch12', '12 mo', 'r')}
                <th className="hide-sm">Trend</th>
                {th('peak', 'Peak', 'r hide-sm')}
                {th('winpct', 'Win %', 'r hide-md')}
                {th('events', 'Events', 'r hide-md')}
                {th('lastPlayed', 'Last played', 'r hide-sm')}
                <th className="hide-md" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((p) => (
                <tr key={p.id} className="clickable" onClick={() => nav(`/player/${p.id}`)}>
                  <td style={{ paddingRight: 0 }}><StarButton id={p.id} rating={p.rating} /></td>
                  <td><PlayerCell p={p} ds={ds} /></td>
                  <td className="r"><Rating p={p} /></td>
                  <td className="r"><Delta v={p.ch12} /></td>
                  <td className="hide-sm"><Sparkline data={p.spark} /></td>
                  <td className="r num hide-sm">{p.peak ?? '—'}</td>
                  <td className="r num hide-md">{p.w + p.l ? `${Math.round((100 * p.w) / (p.w + p.l))}%` : '—'}</td>
                  <td className="r num hide-md">{p.events}</td>
                  <td className="r nowrap muted hide-sm">{relative(p.lastPlayed)}</td>
                  <td className="hide-md"><CompareButton id={p.id} small /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="muted" style={{ padding: 40, textAlign: 'center' }}>No players match these filters.</div>}
        </div>
        )}
        {rows.length > limit && (
          <div style={{ padding: 14, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button className="btn" onClick={() => setLimit((l) => l + 100)}>Show more ({(rows.length - limit).toLocaleString()} remaining)</button>
          </div>
        )}
      </div>
    </div>
  );
}
