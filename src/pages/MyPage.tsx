import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RangePicker, RatingHistoryChart, type Range } from '../components/Charts';
import { PlayerSearchBox } from '../components/Search';
import { Avatar, Delta, Icon, Loading, MRow, PlayerCell, Rating, Sparkline, StarButton, cmp, useMobile, useSort } from '../components/ui';
import { loadPlayer, useDataset, type Dataset, type Player, type PlayerDetail } from '../lib/data';
import { displayName, fmtDate, isActive, relative } from '../lib/format';
import {
  compareTray, decodeSync, encodeSync, lastSeen, me, starred, unwatch, useList, useStore, watch, watchInfo, MAX_COMPARE,
} from '../lib/store';

export default function MyPage() {
  const ds = useDataset();
  const myId = useStore(me);
  const ids = useList(starred);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (myId != null) loadPlayer(myId).then(setDetail, () => setDetail(null));
  }, [myId]);

  // Snapshot "last seen" once per visit, then mark everything as seen for next time.
  const seenRef = useRef(lastSeen.get());
  useEffect(() => {
    if (!ds) return;
    const next = { ...lastSeen.get() };
    for (const id of [...ids, ...(myId != null ? [myId] : [])]) next[id] = ds.byId.get(id)?.lastEvent ?? null;
    lastSeen.set(next);
  }, [ds, ids, myId]);
  const isNew = (p: Player) => p.id in seenRef.current && seenRef.current[p.id] !== p.lastEvent;

  if (!ds) return <Loading h={500} />;
  const mine = myId != null ? ds.byId.get(myId) : undefined;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <SyncBanner ds={ds} />
      <div className="row wrap">
        <h1>My page</h1>
        <span className="spacer" />
        <SyncButton />
      </div>

      {mine ? <MyProfile ds={ds} p={mine} detail={detail} isNew={isNew(mine)} /> : <ClaimProfile ds={ds} />}

      <Watchlist ds={ds} ids={ids} mine={mine} detail={detail} isNew={isNew} />

      <p className="small muted" style={{ margin: 0 }}>
        Your profile and watchlist are saved in this browser — no account needed. Use <b>Sync to another device</b> to copy them to your phone or another computer.
      </p>
    </div>
  );
}

function ClaimProfile({ ds }: { ds: Dataset }) {
  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--surface)' }}>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div className="avatar lg" style={{ background: 'var(--accent)', flexShrink: 0 }}><Icon name="user" size={32} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20 }}>Save your profile</h2>
          <p className="ink2" style={{ margin: '6px 0 14px' }}>
            Find yourself to get your rating front and centre, your head-to-head record against everyone you watch, and alerts when new results land.
          </p>
          <div style={{ maxWidth: 520 }}>
            <PlayerSearchBox ds={ds} placeholder="Search your name or Ratings Central ID…" onPick={(p) => me.set(p.id)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MyProfile({ ds, p, detail, isNew }: { ds: Dataset; p: Player; detail: PlayerDetail | null; isNew: boolean }) {
  const [range, setRange] = useState<Range>('2y');
  const club = p.club != null ? ds.clubs.get(p.club) : undefined;
  const rank = isActive(p) && p.rating != null ? ds.players.filter((x) => isActive(x) && (x.rating ?? 0) > p.rating!).length + 1 : null;
  const recent = detail ? [...detail.history].reverse().slice(0, 4) : [];

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar p={p} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="small muted">My profile {isNew && <span className="badge accent" style={{ marginLeft: 4 }}><Icon name="bell" size={11} />New results</span>}</div>
            <Link to={`/player/${p.id}`}><h2 style={{ fontSize: 22 }}>{displayName(p.name)}</h2></Link>
            <div className="small muted">{[club?.name, `#${p.id}`].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="kpis">
          <div><div className="kpi-big num">{p.rating}</div><div className="small muted">±{p.sd}</div></div>
          <div><div style={{ marginTop: 4 }}><Delta v={p.ch12} /></div><div className="small muted" style={{ marginTop: 4 }}>12 months</div></div>
          {rank && <div><div className="kpi num">#{rank}</div><div className="small muted">in {ds.meta.region}</div></div>}
          <div><div className="kpi num">{p.peak}</div><div className="small muted">peak</div></div>
        </div>
        <div>
          <h3 style={{ marginBottom: 4 }}>Recent events</h3>
          {!detail ? <Loading h={120} /> : recent.map((h) => (
            <Link key={h.e} to={`/event/${h.e}`} className="list-item" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.n}</div>
                <div className="small muted">{fmtDate(h.d)} · {h.im} → {h.m}</div>
              </div>
              <Delta v={h.pc} />
            </Link>
          ))}
        </div>
        <div className="row wrap">
          <Link to={`/player/${p.id}`} className="btn primary">Full profile</Link>
          <button className="btn" onClick={() => me.set(null)}>Not me</button>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>My rating</h2><span className="spacer" /><RangePicker value={range} onChange={setRange} /></div>
        {detail ? <RatingHistoryChart history={detail.history} range={range} showBand height={340} /> : <Loading h={340} />}
      </div>
    </div>
  );
}

type Key = 'rating' | 'since' | 'ch12' | 'vs' | 'lastPlayed' | 'name';

function Watchlist({ ds, ids, mine, detail, isNew }: {
  ds: Dataset; ids: number[]; mine?: Player; detail: PlayerDetail | null; isNew: (p: Player) => boolean;
}) {
  const nav = useNavigate();
  const info = useStore(watchInfo);
  const { sort, th } = useSort<Key>('rating');
  const mobile = useMobile();

  const vsMe = useMemo(() => {
    const m = new Map<number, { w: number; n: number }>();
    for (const x of detail?.matches ?? []) {
      const r = m.get(x.o) ?? { w: 0, n: 0 };
      r.n++; r.w += x.w;
      m.set(x.o, r);
    }
    return m;
  }, [detail]);

  const players = ids.map((id) => ds.byId.get(id)).filter((p): p is Player => !!p);
  const since = (p: Player) => {
    const base = info[p.id]?.rating;
    return base != null && p.rating != null ? p.rating - base : null;
  };
  const val = (p: Player) => {
    switch (sort.key) {
      case 'since': return since(p);
      case 'vs': { const r = vsMe.get(p.id); return r ? r.w / r.n : null; }
      case 'name': return displayName(p.name);
      default: return p[sort.key];
    }
  };
  // players with new results float to the top
  const rows = [...players].sort((a, b) => Number(isNew(b)) - Number(isNew(a)) || cmp(val(a), val(b), sort.dir));
  const fresh = players.filter(isNew).length;

  // Suggest frequent opponents not yet watched
  const suggestions = useMemo(() => [...vsMe.entries()]
    .filter(([id]) => ds.byId.has(id) && !ids.includes(id) && id !== mine?.id)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 5)
    .map(([id, r]) => ({ p: ds.byId.get(id)!, r })), [vsMe, ds, ids, mine]);

  const compareAll = () => {
    const sel = [...(mine ? [mine.id] : []), ...ids].slice(0, MAX_COMPARE);
    compareTray.set(sel);
    nav(`/compare?ids=${sel.join(',')}`);
  };

  return (
    <div className="card flush">
      <div className="card-head">
        <h2>★ Watchlist</h2>
        <span className="badge">{players.length}</span>
        {fresh > 0 && <span className="badge accent"><Icon name="bell" size={11} />{fresh} with new results</span>}
        <span className="spacer" />
        {players.length > 0 && <button className="btn sm" onClick={compareAll}><Icon name="compare" size={14} />Compare{mine ? ' with me' : ''}</button>}
      </div>
      <div style={{ padding: '12px 18px 0' }}>
        <PlayerSearchBox ds={ds} exclude={ids} placeholder="Add a player to your watchlist…" onPick={(p) => watch(p.id, p.rating)} />
      </div>

      {players.length > 0 && mobile ? (
        <div className="mlist" style={{ marginTop: 12, borderTop: '1px solid var(--border)' }}>
          {rows.map((p) => {
            const r = vsMe.get(p.id);
            return (
              <MRow key={p.id} onClick={() => nav(`/player/${p.id}`)} lead={<Avatar p={p} />} title={displayName(p.name)}
                meta={isNew(p) ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>● New results</span>
                  : <>{r ? `vs me ${r.w}–${r.n - r.w} · ` : ''}played {relative(p.lastPlayed)}</>}
                side={<><Rating p={p} /><Delta v={since(p) ?? p.ch12} /></>} />
            );
          })}
        </div>
      ) : players.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr>
              {th('name', 'Player', '', 1)}
              {th('rating', 'Rating', 'r')}
              {th('since', 'Since added', 'r hide-sm')}
              {th('ch12', '12 mo', 'r')}
              <th className="hide-md">Trend</th>
              {mine && th('vs', 'Vs me', 'c')}
              {th('lastPlayed', 'Last played', 'r hide-sm')}
              <th />
            </tr></thead>
            <tbody>
              {rows.map((p) => {
                const r = vsMe.get(p.id);
                return (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/player/${p.id}`)}>
                    <td><PlayerCell p={p} ds={ds} sub={isNew(p)
                      ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>● New results</span>
                      : info[p.id] ? `watching since ${fmtDate(info[p.id].added)}` : undefined} /></td>
                    <td className="r"><Rating p={p} /></td>
                    <td className="r hide-sm"><Delta v={since(p)} /></td>
                    <td className="r"><Delta v={p.ch12} /></td>
                    <td className="hide-md"><Sparkline data={p.spark} /></td>
                    {mine && <td className="c">{r
                      ? <span className={`badge ${r.w * 2 > r.n ? 'w' : r.w * 2 < r.n ? 'l' : ''}`}>{r.w}–{r.n - r.w}</span>
                      : <span className="muted small">—</span>}</td>}
                    <td className="r muted nowrap hide-sm">{relative(p.lastPlayed)}</td>
                    <td className="r"><button className="star" title="Remove from watchlist" aria-label={`Remove ${displayName(p.name)}`}
                      onClick={(e) => { e.stopPropagation(); unwatch(p.id); }}><Icon name="x" size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="muted" style={{ padding: '20px 18px 4px' }}>
          No one on your watchlist yet. Tap <b className="ink2">☆ Watch</b> on any player, or search above.
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ padding: '14px 18px 18px', borderTop: players.length ? '1px solid var(--border)' : undefined, marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>People you play most</h3>
          <div className="chips">
            {suggestions.map(({ p, r }) => (
              <span key={p.id} className="chip">
                <Link to={`/player/${p.id}`}>{displayName(p.name)}</Link>
                <span className="small muted num">{r.w}–{r.n - r.w}</span>
                <StarButton id={p.id} rating={p.rating} />
              </span>
            ))}
          </div>
        </div>
      )}
      {players.length > 0 && <div style={{ height: 6 }} />}
    </div>
  );
}

// ---------- sync between devices ----------

function syncUrl() {
  return `${location.origin}${location.pathname}#/me?sync=${encodeSync()}`;
}

function SyncButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'show'>('idle');
  const url = syncUrl();
  const copy = async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'My table tennis watchlist', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('show');
    }
  };
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button className="btn" onClick={copy}><Icon name={state === 'copied' ? 'check' : 'link'} size={15} />
        {state === 'copied' ? 'Link copied — open it on your other device' : 'Sync to another device'}</button>
      {state === 'show' && <input className="input small" readOnly value={url} onFocus={(e) => e.target.select()} style={{ width: 'min(420px, 90vw)' }} />}
    </div>
  );
}

function SyncBanner({ ds }: { ds: Dataset }) {
  const [params, setParams] = useSearchParams();
  const code = params.get('sync');
  const data = code ? decodeSync(code) : null;
  if (!data) return null;

  const valid = data.ids.filter((id) => ds.byId.has(id));
  const who = data.me != null ? ds.byId.get(data.me) : undefined;
  const done = () => setParams({}, { replace: true });
  const apply = (mode: 'merge' | 'replace') => {
    if (data.me != null && ds.byId.has(data.me)) me.set(data.me);
    if (mode === 'replace') { starred.set([]); watchInfo.set({}); }
    for (const id of valid) watch(id, ds.byId.get(id)!.rating);
    done();
  };

  return (
    <div className="card" style={{ borderColor: 'var(--accent)', background: 'linear-gradient(135deg, var(--accent-soft), transparent), var(--surface)' }}>
      <div className="row wrap" style={{ gap: 12 }}>
        <Icon name="link" size={22} />
        <div style={{ flex: '1 1 260px' }}>
          <b>Import from sync link?</b>
          <div className="small ink2">{[who && `Profile: ${displayName(who.name)}`, `${valid.length} watched player${valid.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
        </div>
        <button className="btn primary" onClick={() => apply('merge')}>Import</button>
        <button className="btn" onClick={() => apply('replace')} title="Replace this device's watchlist">Replace mine</button>
        <button className="btn" onClick={done}>Dismiss</button>
      </div>
    </div>
  );
}
