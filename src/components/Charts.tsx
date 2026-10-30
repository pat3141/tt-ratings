import { useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { HistoryRow, Player } from '../lib/data';
import { displayName, fmtDate, SERIES, toTime } from '../lib/format';
import { Delta } from './ui';

const axisProps = {
  stroke: 'var(--axis)',
  tick: { fill: 'var(--muted)', fontSize: 12 },
  tickLine: false,
} as const;

const yearTick = (t: number) => String(new Date(t).getFullYear());
const monthTick = (t: number) => new Date(t).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });

/** Calendar-aligned ticks: quarters for short spans, whole years (thinned to <= 10) otherwise. */
function timeTicks(min: number, max: number): { ticks: number[]; fmt: (t: number) => string } {
  const ticks: number[] = [];
  const a = new Date(min), span = max - min;
  if (span < 2 * 365 * 864e5) {
    for (let d = new Date(a.getFullYear(), Math.ceil(a.getMonth() / 3) * 3, 1); d.getTime() <= max; d.setMonth(d.getMonth() + 3)) ticks.push(d.getTime());
    return { ticks, fmt: monthTick };
  }
  const years = Math.ceil(span / (365.25 * 864e5));
  const step = Math.max(1, Math.ceil(years / 10));
  for (let y = a.getFullYear() + 1; new Date(y, 0, 1).getTime() <= max; y += step) ticks.push(new Date(y, 0, 1).getTime());
  return { ticks, fmt: yearTick };
}

export type Range = 'all' | '5y' | '2y' | '1y';
const RANGE_DAYS: Record<Range, number> = { all: Infinity, '5y': 1826, '2y': 730, '1y': 365 };

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="seg" role="group" aria-label="Time range">
      {(['1y', '2y', '5y', 'all'] as Range[]).map((r) => (
        <button key={r} className={value === r ? 'on' : ''} onClick={() => onChange(r)}>{r === 'all' ? 'All' : r.toUpperCase()}</button>
      ))}
    </div>
  );
}

const yScale = ({ domain, ticks }: ReturnType<typeof niceScale>) => ({ domain, ticks, interval: 0 as const });

/** Rating axis with ~5 evenly spaced round ticks; the domain ends exactly on a tick so labels never crowd. */
function niceScale(lo: number, hi: number): { domain: [number, number]; ticks: number[] } {
  const pad = Math.max(20, (hi - lo) * 0.06);
  const a = lo - pad, b = hi + pad;
  const step = [25, 50, 100, 150, 200, 250, 500].find((st) => (b - a) / st <= 5) ?? 1000;
  const start = Math.floor(a / step) * step, end = Math.ceil(b / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end; t += step) ticks.push(t);
  return { domain: [start, end], ticks };
}

// ---------- single player ----------

function peakPos(t: number, min: number, max: number): 'top' | 'left' | 'right' {
  const f = max > min ? (t - min) / (max - min) : 0.5;
  return f > 0.85 ? 'left' : f < 0.08 ? 'right' : 'top';
}

interface Pt { t: number; m: number; s: number; band: [number, number]; n: string; pc: number; im: number }

export function RatingHistoryChart({ history, range, showBand, height = 320 }: {
  history: HistoryRow[]; range: Range; showBand: boolean; height?: number;
}) {
  const data: Pt[] = useMemo(() => {
    const cutoff = Date.now() - RANGE_DAYS[range] * 864e5;
    return history
      .map((h) => ({ t: toTime(h.d), m: h.m, s: h.s, band: [h.m - h.s, h.m + h.s] as [number, number], n: h.n, pc: h.pc, im: h.im }))
      .filter((p) => p.t >= cutoff);
  }, [history, range]);

  if (data.length === 0) {
    return <div className="muted" style={{ height, display: 'grid', placeItems: 'center' }}>No rated events in this period.</div>;
  }

  const peak = data.reduce((a, b) => (b.m > a.m ? b : a));
  const lo = Math.min(...data.map((d) => (showBand ? d.band[0] : d.m)));
  const hi = Math.max(...data.map((d) => (showBand ? d.band[1] : d.m)));
  const tt = timeTicks(data[0].t, data.at(-1)!.t);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axisProps}
          ticks={tt.ticks} tickFormatter={tt.fmt} />
        <YAxis {...yScale(niceScale(lo, hi))} {...axisProps} axisLine={false} width={46} allowDecimals={false} />
        <Tooltip cursor={{ stroke: 'var(--axis)', strokeDasharray: '3 3' }} content={({ active, payload }) => {
          const p = payload?.[0]?.payload as Pt | undefined;
          if (!active || !p) return null;
          return (
            <div className="chart-tip">
              <div className="t">{fmtDate(new Date(p.t).toISOString().slice(0, 10))}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.n}</div>
              <div className="row">
                <span className="rating" style={{ fontSize: 18 }}>{p.m}</span><span className="sd">±{p.s}</span>
                <span className="spacer" /><Delta v={p.pc} />
              </div>
              <div className="small muted">from {p.im}</div>
            </div>
          );
        }} />
        {showBand && <Area dataKey="band" stroke="none" fill="var(--band)" isAnimationActive={false} activeDot={false} />}
        <Line dataKey="m" stroke="var(--series-1)" strokeWidth={2} isAnimationActive={false}
          dot={data.length <= 60 ? { r: 3, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 } : false}
          activeDot={{ r: 6, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
        <ReferenceDot x={peak.t} y={peak.m} r={6} fill="var(--star)" stroke="var(--surface)" strokeWidth={2}
          label={{
            value: `${range === 'all' ? 'Peak' : 'High'} ${peak.m}`, fontSize: 12, fontWeight: 600, fill: 'var(--ink-2)',
            // keep the label inside the plot when the peak sits near either edge
            position: peakPos(peak.t, data[0].t, data.at(-1)!.t),
          }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------- comparison ----------

export type CompareMode = 'date' | 'career';

export function CompareChart({ players, histories, mode, range, height = 380 }: {
  players: Player[]; histories: Map<number, HistoryRow[]>; mode: CompareMode; range: Range; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const { rows, series } = useMemo(() => {
    const cutoff = mode === 'date' ? Date.now() - RANGE_DAYS[range] * 864e5 : -Infinity;
    const series = players.map((p, i) => {
      const h = histories.get(p.id) ?? [];
      const t0 = h.length ? toTime(h[0].d) : 0;
      const pts = h.map((r) => ({
        x: mode === 'date' ? toTime(r.d) : (toTime(r.d) - t0) / (365.25 * 864e5),
        m: r.m, n: r.n,
      })).filter((pt) => mode !== 'date' || pt.x >= cutoff);
      return { p, key: `p${p.id}`, color: SERIES[i], pts };
    });
    const rows: Record<string, number>[] = [];
    for (const s of series) for (const pt of s.pts) rows.push({ x: pt.x, [s.key]: pt.m });
    rows.sort((a, b) => a.x - b.x);
    return { rows, series };
  }, [players, histories, mode, range]);

  if (!rows.length) return <div className="muted" style={{ height, display: 'grid', placeItems: 'center' }}>No rating history to show.</div>;

  const all = rows.flatMap((r) => Object.entries(r).filter(([k]) => k !== 'x').map(([, v]) => v));
  const xs = rows.map((r) => r.x);
  const tt = timeTicks(Math.min(...xs), Math.max(...xs));

  // value of each series at x = most recent rating on or before x
  const valueAt = (pts: { x: number; m: number; n: string }[], x: number) => {
    let best: (typeof pts)[number] | null = null;
    for (const pt of pts) { if (pt.x <= x) best = pt; else break; }
    return best;
  };

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...axisProps} minTickGap={36}
            scale={mode === 'date' ? 'time' : 'linear'} ticks={mode === 'date' ? tt.ticks : undefined}
            tickFormatter={mode === 'date' ? tt.fmt : (v: number) => `${Math.round(v * 10) / 10}y`} />
          <YAxis {...yScale(niceScale(Math.min(...all), Math.max(...all)))} {...axisProps} axisLine={false} width={46} />
          <Tooltip cursor={{ stroke: 'var(--axis)', strokeDasharray: '3 3' }} content={({ active, label }) => {
            if (!active || label == null) return null;
            const x = Number(label);
            const vals = series.map((s) => ({ s, v: valueAt(s.pts, x) })).filter((r) => r.v)
              .sort((a, b) => b.v!.m - a.v!.m);
            return (
              <div className="chart-tip">
                <div className="t">{mode === 'date' ? fmtDate(new Date(x).toISOString().slice(0, 10)) : `${x.toFixed(1)} years in`}</div>
                {vals.map(({ s, v }) => (
                  <div key={s.key} className="row" style={{ gap: 8, padding: '2px 0' }}>
                    <span className="dot" style={{ background: s.color }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(s.p.name)}</span>
                    <b className="num">{v!.m}</b>
                  </div>
                ))}
              </div>
            );
          }} />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={s.color} connectNulls isAnimationActive={false}
              strokeWidth={hover === s.p.id ? 3 : 2} strokeOpacity={hover == null || hover === s.p.id ? 1 : 0.25}
              dot={false} activeDot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="legend" style={{ marginTop: 8 }}>
        {series.map((s) => (
          <span key={s.key} onMouseEnter={() => setHover(s.p.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
            <i style={{ background: s.color }} />{displayName(s.p.name)}
          </span>
        ))}
      </div>
    </>
  );
}

// ---------- distribution ----------

export function DistributionChart({ ratings, highlight, height = 220 }: { ratings: number[]; highlight?: number | null; height?: number }) {
  const bins = useMemo(() => {
    if (!ratings.length) return [];
    const lo = Math.floor(Math.min(...ratings) / 100) * 100, hi = Math.floor(Math.max(...ratings) / 100) * 100;
    const out = [];
    for (let b = lo; b <= hi; b += 100) out.push({ b, n: 0 });
    for (const r of ratings) out[Math.floor(r / 100) - lo / 100].n++;
    return out;
  }, [ratings]);
  const hb = highlight != null ? Math.floor(highlight / 100) * 100 : null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="b" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
        <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={({ active, payload }) => {
          const d = payload?.[0]?.payload as { b: number; n: number } | undefined;
          if (!active || !d) return null;
          return <div className="chart-tip"><div className="t">Rating {d.b}–{d.b + 99}</div><b>{d.n}</b> players</div>;
        }} />
        <Bar dataKey="n" radius={[4, 4, 0, 0]} isAnimationActive={false}
          shape={(props: any) => {
            const { x, y, width, height: h, payload } = props;
            const on = hb != null && payload.b === hb;
            const r = Math.min(4, width / 2, h);
            return <path d={`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + h}Z`}
              fill={on ? 'var(--series-2)' : 'var(--series-1)'} opacity={hb != null && !on ? 0.55 : 1} />;
          }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
