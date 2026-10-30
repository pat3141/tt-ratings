import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDataset } from '../lib/data';
import { fmtDate } from '../lib/format';
import { compareTray, useList } from '../lib/store';
import { CommandPalette } from './Search';
import { Avatar, Icon } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/players', label: 'Players', icon: 'users' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/events', label: 'Events', icon: 'calendar' },
  { to: '/clubs', label: 'Clubs', icon: 'club' },
  { to: '/me', label: 'My page', icon: 'user' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches);
  const flip = () => {
    const t = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch { /* ignore */ }
    setDark(!dark);
  };
  return (
    <button className="icon-btn" onClick={flip} title={dark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}

function CompareTray() {
  const ds = useDataset();
  const ids = useList(compareTray);
  const nav = useNavigate();
  const { pathname } = useLocation();
  if (!ds || !ids.length || pathname === '/compare') return null;
  const players = ids.map((id) => ds.byId.get(id)).filter((p) => !!p);
  return (
    <div className="tray">
      <div className="avatars" style={{ paddingLeft: 6 }}>{players.map((p) => <Avatar key={p.id} p={p} />)}</div>
      <span className="small nowrap">{ids.length} selected</span>
      <button className="btn sm" onClick={() => nav(`/compare?ids=${ids.join(',')}`)}>Compare</button>
      <button className="x" onClick={() => compareTray.set([])} aria-label="Clear compare selection"><Icon name="x" size={16} /></button>
    </div>
  );
}

export default function Layout() {
  const ds = useDataset();
  const [palette, setPalette] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link to="/" className="brand">
            <span className="brand-mark">🏓</span>
            <span>Rally<small>{ds?.meta.region ?? ''} ratings</small></span>
          </Link>
          <nav className="nav">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
          </nav>
          <div className="spacer hide-md" />
          <button className="search-trigger" onClick={() => setPalette(true)}>
            <Icon name="search" size={16} /><span style={{ flex: 1, textAlign: 'left' }}>Search players</span>
            <span className="hint"><kbd>⌘</kbd> <kbd>K</kbd></span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="container"><Outlet /></main>

      <footer className="site">
        <div className="container">
          Data from <a className="link" href="https://www.ratingscentral.com" target="_blank" rel="noreferrer">Ratings Central</a>
          {ds && <> · updated {fmtDate(ds.meta.updated.slice(0, 10))}</>}. Unofficial fan-made viewer; not affiliated with Ratings Central.
        </div>
      </footer>

      <nav className="mobile-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} />{n.label}</NavLink>
        ))}
      </nav>

      <CompareTray />
      {palette && <CommandPalette ds={ds} onClose={() => setPalette(false)} />}
    </>
  );
}
