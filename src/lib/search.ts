import Fuse from 'fuse.js';
import type { Dataset, Player } from './data';
import { displayName } from './format';

interface Doc { p: Player; name: string; display: string; id: string; club: string }

const cache = new WeakMap<Dataset, Fuse<Doc>>();

function index(ds: Dataset): Fuse<Doc> {
  let f = cache.get(ds);
  if (!f) {
    const docs = ds.players.map((p) => {
      const c = p.club != null ? ds.clubs.get(p.club) : undefined;
      return { p, name: p.name, display: displayName(p.name), id: String(p.id), club: c ? `${c.name} ${c.short}` : '' };
    });
    f = new Fuse(docs, {
      keys: [{ name: 'display', weight: 3 }, { name: 'name', weight: 3 }, { name: 'id', weight: 2 }, { name: 'club', weight: 0.5 }],
      threshold: 0.32,
      ignoreLocation: true,
      includeScore: true,
    });
    cache.set(ds, f);
  }
  return f;
}

/** Fuzzy, typo-tolerant player search. Exact ID match always wins; ties broken by rating. */
export function searchPlayers(ds: Dataset, q: string, limit = 50): Player[] {
  const query = q.trim();
  if (!query) return [];
  if (/^\d+$/.test(query)) {
    const exact = ds.byId.get(Number(query));
    if (exact) return [exact];
  }
  return index(ds)
    .search(query, { limit: limit * 2 })
    .sort((a, b) => (a.score! - b.score!) || ((b.item.p.rating ?? 0) - (a.item.p.rating ?? 0)))
    .slice(0, limit)
    .map((r) => r.item.p);
}
