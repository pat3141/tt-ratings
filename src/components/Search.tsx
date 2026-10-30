import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Dataset, Player } from '../lib/data';
import { displayName, relative } from '../lib/format';
import { searchPlayers } from '../lib/search';
import { Avatar, Icon, Rating } from './ui';

function useResults(ds: Dataset | null, q: string, limit: number) {
  return useMemo(() => (ds ? searchPlayers(ds, q, limit) : []), [ds, q, limit]);
}

function ResultRow({ p, ds, sel, onPick, onHover }: { p: Player; ds: Dataset; sel: boolean; onPick: () => void; onHover: () => void }) {
  const club = p.club != null ? ds.clubs.get(p.club) : undefined;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sel) ref.current?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  return (
    <div ref={ref} className={`result ${sel ? 'sel' : ''}`} onMouseDown={(e) => { e.preventDefault(); onPick(); }} onMouseEnter={onHover}
      role="option" aria-selected={sel}>
      <Avatar p={p} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pname">{displayName(p.name)}</div>
        <div className="small muted">{[club?.short || club?.name, `#${p.id}`, `played ${relative(p.lastPlayed)}`].filter(Boolean).join(' · ')}</div>
      </div>
      <Rating p={p} />
    </div>
  );
}

/** Keyboard-driven list of search results shared by the palette and inline box. */
function useKeyboardList(results: Player[], onPick: (p: Player) => void) {
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [results]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); onPick(results[sel]); }
  };
  return { sel, setSel, onKeyDown };
}

export function CommandPalette({ ds, onClose }: { ds: Dataset | null; onClose: () => void }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const results = useResults(ds, q, 30);
  const pick = (p: Player) => { nav(`/player/${p.id}`); onClose(); };
  const { sel, setSel, onKeyDown } = useKeyboardList(results, pick);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search players">
        <div className="search-wrap">
          <Icon name="search" size={20} />
          <input autoFocus placeholder="Search by name, ID or club…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); else onKeyDown(e); }} aria-label="Search players" />
        </div>
        <div className="results" role="listbox">
          {!q.trim() && <div className="empty">Type a name — typos are fine. Try a surname, first name, or Ratings Central ID.</div>}
          {q.trim() && !results.length && <div className="empty">No players match “{q}”.</div>}
          {ds && results.map((p, i) => (
            <ResultRow key={p.id} p={p} ds={ds} sel={i === sel} onPick={() => pick(p)} onHover={() => setSel(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Inline search box with dropdown. `onPick` defaults to navigating to the player. */
export function PlayerSearchBox({ ds, onPick, placeholder = 'Search players…', big, exclude = [] }: {
  ds: Dataset | null; onPick?: (p: Player) => void; placeholder?: string; big?: boolean; exclude?: number[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const raw = useResults(ds, q, 12);
  const results = useMemo(() => raw.filter((p) => !exclude.includes(p.id)), [raw, exclude]);
  const pick = (p: Player) => { (onPick ?? ((x) => nav(`/player/${x.id}`)))(p); setQ(''); setOpen(false); };
  const { sel, setSel, onKeyDown } = useKeyboardList(results, pick);

  return (
    <div className="search-wrap palette-inline" style={{ position: 'relative' }}>
      <Icon name="search" size={big ? 20 : 17} />
      <input className={`input ${big ? 'big' : ''}`} style={big ? undefined : { width: '100%', paddingLeft: 40 }}
        placeholder={placeholder} value={q} aria-label={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); else onKeyDown(e); }} />
      {open && q.trim() && ds && (
        <div className="dropdown palette" role="listbox" style={{ maxWidth: 'none' }}>
          {!results.length && <div className="empty">No players match “{q}”.</div>}
          {results.map((p, i) => (
            <ResultRow key={p.id} p={p} ds={ds} sel={i === sel} onPick={() => pick(p)} onHover={() => setSel(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
