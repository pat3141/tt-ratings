import { useSyncExternalStore } from 'react';

// Tiny localStorage-backed stores for starred players and the compare tray.

function createListStore(key: string, max = Infinity) {
  let value: number[] = [];
  try { value = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* storage unavailable */ }
  const listeners = new Set<() => void>();

  const set = (next: number[]) => {
    value = next.slice(0, max);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };

  return {
    get: () => value,
    set,
    toggle: (id: number) => set(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]),
    add: (id: number) => { if (!value.includes(id)) set([...value, id]); },
    remove: (id: number) => set(value.filter((x) => x !== id)),
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

export const MAX_COMPARE = 6;
export const starred = createListStore('starred');
export const compareTray = createListStore('compare', MAX_COMPARE);

export function useList(store: ReturnType<typeof createListStore>): number[] {
  return useSyncExternalStore(store.subscribe, store.get);
}
