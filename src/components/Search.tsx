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

/** Inline search box with dropdown. `onPick` defaults to navigating to the player. */
export function PlayerSearchBox({ ds, onPick, placeholder = 'Search players…', big, exclude = [], inputRef, className = '' }: {
  ds: Dataset | null; onPick?: (p: Player) => void; placeholder?: string; big?: boolean; exclude?: number[];
  inputRef?: React.Ref<HTMLInputElement>; className?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const raw = useResults(ds, q, 12);
  const results = useMemo(() => raw.filter((p) => !exclude.includes(p.id)), [raw, exclude]);
  const pick = (p: Player) => {
    (onPick ?? ((x) => nav(`/player/${x.id}`)))(p);
    setQ(''); setOpen(false);
    if (!onPick) (document.activeElement as HTMLElement | null)?.blur(); // close the mobile keyboard after navigating
  };
  const { sel, setSel, onKeyDown } = useKeyboardList(results, pick);

  return (
    <div className={`search-wrap palette-inline ${className}`} style={{ position: 'relative' }}>
      <Icon name="search" size={big ? 20 : 17} />
      <input ref={inputRef} type="search" enterKeyHint="go" autoComplete="off" className={`input ${big ? 'big' : ''}`} style={big ? undefined : { width: '100%', paddingLeft: 40 }}
        placeholder={placeholder} value={q} aria-label={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); } else onKeyDown(e); }} />
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
