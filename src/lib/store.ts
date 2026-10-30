import { useSyncExternalStore } from 'react';

// Small localStorage-backed stores: the user's own profile, their watchlist and the compare tray.
// Everything lives on this device; a sync link (see encodeSync) carries it to another one.

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function createStore<T>(key: string, initial: T) {
  let value = load(key, initial);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

type Store<T> = ReturnType<typeof createStore<T>>;

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

// ---------- lists (watchlist ids, compare tray) ----------

function createListStore(key: string, max = Infinity) {
  const s = createStore<number[]>(key, []);
  const set = (next: number[]) => s.set(next.slice(0, max));
  return {
    ...s,
    set,
    toggle: (id: number) => set(s.get().includes(id) ? s.get().filter((x) => x !== id) : [...s.get(), id]),
    add: (id: number) => { if (!s.get().includes(id)) set([...s.get(), id]); },
    remove: (id: number) => set(s.get().filter((x) => x !== id)),
  };
}

export const MAX_COMPARE = 6;
/** Watchlist ids (stored under the original "starred" key so existing stars carry over). */
export const starred = createListStore('starred');
export const compareTray = createListStore('compare', MAX_COMPARE);

export function useList(store: ReturnType<typeof createListStore>): number[] {
  return useSyncExternalStore(store.subscribe, store.get);
}

// ---------- profile ----------

/** The player id the user has claimed as themselves. */
export const me = createStore<number | null>('me', null);

// ---------- watch metadata ----------

/** When each player was added and their rating then, so we can show "change since watching". */
export interface WatchInfo { added: string; rating: number | null }
export const watchInfo = createStore<Record<number, WatchInfo>>('watchInfo', {});

/** Last event id seen per player on the My page, for "new results" badges. */
export const lastSeen = createStore<Record<number, number | null>>('lastSeen', {});

export function watch(id: number, rating: number | null) {
  starred.add(id);
  if (!watchInfo.get()[id]) {
    watchInfo.set({ ...watchInfo.get(), [id]: { added: new Date().toISOString().slice(0, 10), rating } });
  }
}

export function unwatch(id: number) {
  starred.remove(id);
  const { [id]: _, ...rest } = watchInfo.get();
  watchInfo.set(rest);
}

// ---------- sync link ----------

/** Compact, URL-safe snapshot: "<me>.<id>,<id>…" */
export function encodeSync(): string {
  return `${me.get() ?? ''}.${starred.get().join(',')}`;
}

export function decodeSync(code: string): { me: number | null; ids: number[] } | null {
  const m = /^(\d*)\.([\d,]*)$/.exec(code.trim());
  if (!m) return null;
  return { me: m[1] ? Number(m[1]) : null, ids: m[2].split(',').filter(Boolean).map(Number) };
}
