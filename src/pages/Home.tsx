import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DistributionChart } from '../components/Charts';
import { Delta, Icon, Loading, PlayerCell, Rating, Sparkline, Stat } from '../components/ui';
import { useDataset, useEvents } from '../lib/data';
import { fmtDate, isActive, relative, since } from '../lib/format';
import { me, starred, useList, useStore } from '../lib/store';

export default function Home() {
  const ds = useDataset();
  const ev = useEvents();
  const stars = useList(starred);
  const myId = useStore(me);
  const nav = useNavigate();

  const s = useMemo(() => {
    if (!ds) return null;
    const active = ds.players.filter((p) => isActive(p) && p.rating != null && !p.deceased);
    const top = [...active].sort((a, b) => b.rating! - a.rating!).slice(0, 10);
    const movers = active.filter((p) => p.ch12 != null).sort((a, b) => b.ch12! - a.ch12!).slice(0, 8);
    const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const newPlayers = ds.players.filter((p) => p.first && p.first >= yearAgo).length;
    return { active, top, movers, newPlayers, yearAgo };
  }, [ds]);

  if (!ds || !s) return <div className="stack"><Loading h={140} /><Loading h={320} /></div>;

  const mine = myId != null ? ds.byId.get(myId) : undefined;
  const watched = stars.map((id) => ds.byId.get(id)).filter((p) => !!p);

  function MyStrip() {
    if (!mine && !watched.length) {
      return (
        <Link to="/me" className="card row wrap" style={{ gap: 14, background: 'linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--surface)' }}>
          <div className="avatar" style={{ background: 'var(--accent)' }}><Icon name="user" size={18} /></div>
          <div style={{ flex: '1 1 240px' }}>
            <b>Save your profile &amp; build a watchlist</b>
            <div className="small ink2">See your rating at a glance, follow friends and rivals, and get “new results” alerts.</div>
          </div>
          <span className="btn primary">Get started</span>
        </Link>
      );
    }
    return (
      <div className="card flush">
        <div className="card-head"><h2>{mine ? 'You & your watchlist' : '★ Your watchlist'}</h2><span className="spacer" /><Link to="/me" className="link small">My page →</Link></div>
        <div style={{ marginTop: 10 }}>
          {[...(mine ? [mine] : []), ...watched.filter((p) => p.id !== mine?.id)].slice(0, 8).map((p) => (
            <Link key={p.id} to={`/player/${p.id}`} className="list-item">
              <PlayerCell p={p} ds={ds!} sub={p.id === mine?.id ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>You · played {relative(p.lastPlayed)}</span> : `played ${relative(p.lastPlayed)}`} />
              <span className="spacer" />
              <span className="hide-sm"><Sparkline data={p.spark} /></span>
              <Delta v={p.ch12} />
              <Rating p={p} />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="eyebrow" style={{ alignSelf: 'flex-start' }}><span className="pulse" />Updated {since(ds.meta.updated)} from Ratings Central</div>

      <div className="grid grid-4">
        <Stat label="Rated players" value={ds.players.length.toLocaleString()} foot={`${s.newPlayers} new this year`} />
        <Stat label="Active (12 months)" value={s.active.length.toLocaleString()} foot={`${Math.round((100 * s.active.length) / ds.players.length)}% of all players`} />
        <Stat label="Events (12 months)" value={ev ? ev.list.filter((e) => e.date >= s.yearAgo).length : '…'} foot={ev ? `${ev.list.length.toLocaleString()} all-time` : undefined} />
        <Stat label="Clubs" value={ds.clubs.size} foot={<Link to="/clubs" className="link">Browse clubs →</Link>} />
      </div>

      <MyStrip />

      <div className="grid grid-2">
        <div className="card flush">
          <div className="card-head"><h2>Top rated</h2><span className="sub">active in the last 12 months</span><span className="spacer" />
            <Link to="/players" className="link small">All players →</Link></div>
          <div style={{ marginTop: 10 }}>
            {s.top.map((p, i) => (
              <Link key={p.id} to={`/player/${p.id}`} className="list-item">
                <span className="rank-no">{i + 1}</span>
                <PlayerCell p={p} ds={ds} />
                <span className="spacer" />
                <span className="hide-sm"><Sparkline data={p.spark} width={70} /></span>
                <Rating p={p} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Biggest climbers</h2><span className="sub">rating gain, last 12 months</span></div>
          <div style={{ marginTop: 10 }}>
            {s.movers.map((p) => (
              <Link key={p.id} to={`/player/${p.id}`} className="list-item">
                <PlayerCell p={p} ds={ds} />
                <span className="spacer" />
                <span className="hide-sm"><Sparkline data={p.spark} width={70} /></span>
                <Delta v={p.ch12} />
                <span className="rating" style={{ width: 44, textAlign: 'right' }}>{p.rating}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Rating distribution</h2><span className="sub">active players, 100-point bands</span></div>
          <DistributionChart ratings={s.active.map((p) => p.rating!)} />
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Recent events</h2><span className="spacer" /><Link to="/events" className="link small">All events →</Link></div>
          <div style={{ marginTop: 10 }}>
            {!ev && <div style={{ padding: 18 }}><Loading h={200} /></div>}
            {ev?.list.slice(0, 6).map((e) => (
              <div key={e.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav(`/event/${e.id}`)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                  <div className="small muted">{fmtDate(e.date)} · {e.players.length} {e.players.length === 1 ? 'player' : 'players'}</div>
                </div>
                {e.players[0] && (
                  <div className="small hide-sm" style={{ textAlign: 'right' }}>
                    <div className="muted">Top gain</div>
                    <Delta v={e.players[0].pc} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
