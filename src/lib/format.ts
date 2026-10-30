import type { Player } from './data';

/** "Wang, Yige Rachael" -> "Yige Rachael Wang" */
export function displayName(name: string): string {
  const i = name.indexOf(', ');
  return i < 0 ? name : `${name.slice(i + 2)} ${name.slice(0, i)}`;
}

export function initials(name: string): string {
  const parts = displayName(name).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase();
}

const dateFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' });

export const fmtDate = (d: string | null | undefined) => (d ? dateFmt.format(new Date(d + 'T00:00:00')) : '—');
export const fmtMonth = (d: string | null | undefined) => (d ? monthFmt.format(new Date(d + 'T00:00:00')) : '—');
export const toTime = (d: string) => new Date(d + 'T00:00:00').getTime();

export function relative(d: string | null): string {
  if (!d) return 'never';
  const days = Math.round((Date.now() - toTime(d)) / 864e5);
  if (days < 1) return 'today';
  if (days < 31) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30.4)}mo ago`;
  const y = days / 365.25;
  return `${y < 10 ? y.toFixed(1).replace(/\.0$/, '') : Math.round(y)}y ago`;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const ACTIVE_DAYS = 365;
export function isActive(p: Player, days = ACTIVE_DAYS): boolean {
  return !!p.lastPlayed && Date.now() - toTime(p.lastPlayed) <= days * 864e5;
}

export const winPct = (w: number, l: number) => (w + l ? Math.round((100 * w) / (w + l)) : null);

/** Categorical series colours (fixed order) – values live in CSS so dark mode can re-step them. */
export const SERIES = Array.from({ length: 6 }, (_, i) => `var(--series-${i + 1})`);
