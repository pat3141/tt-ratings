import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDataset } from '../lib/data';
import { fmtDate } from '../lib/format';
import { compareTray, useList } from '../lib/store';
import { CommandPalette } from './Search';
import { Avatar, Icon, useMobile } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/players', label: 'Players', icon: 'users' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/events', label: 'Events', icon: 'calendar' },
  { to: '/clubs', label: 'Clubs', icon: 'club' },
  { to: '/me', label: 'My page', icon: 'user' },
];

type Theme = 'light' | 'dark' | 'system';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch { /* ignore */ }
}

/** Light / Dark / Auto switch. Desktop shows all three; phones get one button that cycles. */
function ThemeToggle({ compact }: { compact: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') return t; } catch { /* ignore */ }
    return 'system';
  });
  const set = (t: Theme) => { applyTheme(t); setTheme(t); };
  const opts: { t: Theme; icon: string; label: string }[] = [
    { t: 'light', icon: 'sun', label: 'Light theme' },
    { t: 'dark', icon: 'moon', label: 'Dark theme' },
    { t: 'system', icon: 'auto', label: 'Match system theme' },
  ];
  if (compact) {
    const cur = opts.find((o) => o.t === theme)!;
    const next = opts[(opts.indexOf(cur) + 1) % opts.length];
    return (
      <button className="icon-btn" onClick={() => set(next.t)} aria-label={`${cur.label} (tap for ${next.label.toLowerCase()})`} title={cur.label}>
        <Icon name={cur.icon} />
      </button>
    );
  }
  return (
    <div className="theme-seg" role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button key={o.t} className={theme === o.t ? 'on' : ''} onClick={() => set(o.t)} role="radio" aria-checked={theme === o.t} title={o.label} aria-label={o.label}>
          <Icon name={o.icon} size={16} />
        </button>
      ))}
    </div>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="#e34948" /></linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <circle cx="14" cy="14" r="7.5" fill="#fff" fillOpacity=".95" />
      <rect x="18.5" y="18.5" width="3.6" height="9" rx="1.8" transform="rotate(-45 20.3 23)" fill="#fff" fillOpacity=".95" />
      <circle cx="24.5" cy="8" r="2.6" fill="#ffd166" />
    </svg>
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
  const mobile = useMobile();
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
            <span className="brand-mark"><Logo /></span>
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
          <ThemeToggle compact={mobile} />
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
