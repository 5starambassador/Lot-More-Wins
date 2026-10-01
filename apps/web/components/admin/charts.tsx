'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCompact, formatNumber } from '@/lib/format';
import { Segmented } from '@/components/ui/page-header';
import { Table, TBody, TD, TH, THead, TR, TableScroll } from '@/components/ui/table';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Rounds the axis maximum up to a clean 1/2/2.5/5 × 10ⁿ step. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4].slice(0, count + 1);
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** Bucket label: an IST day (YYYY-MM-DD) or, for long periods, a month (YYYY-MM). */
const shortDate = (bucket: string) =>
  bucket.length === 7
    ? new Date(`${bucket}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : new Date(`${bucket}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export interface TrendMetric<K extends string> {
  key: K;
  label: string;
  /** Exact value, for the tooltip and the table view. */
  format?: (v: number) => string;
  /** Compact value, for the axis. */
  tick?: (v: number) => string;
}

/**
 * One series over time, drawn as columns. Several measures are offered through a metric
 * switch rather than a second axis; every column has a hover tooltip listing all of them,
 * and the table view gives the exact values.
 */
export function TrendChart<K extends string>({
  data,
  metrics,
  height = 220,
  emptyLabel = 'Nothing in this period yet',
}: {
  data: ({ date: string } & Record<K, number>)[];
  metrics: readonly TrendMetric<K>[];
  height?: number;
  emptyLabel?: string;
}) {
  const [metricKey, setMetricKey] = useState<K>(metrics[0]!.key);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]!;
  const fmt = (m: TrendMetric<K>) => m.format ?? formatNumber;
  const pad = { top: 12, right: 8, bottom: 28, left: 48 };
  const values = data.map((d) => d[metric.key] as number);
  const ticks = useMemo(() => niceTicks(Math.max(...values, 0)), [values]);
  const yMax = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const fmtTick = metric.tick ?? formatCompact;
  // Aim for a date label roughly every 64px, whatever the number of buckets.
  const labelEvery = Math.max(1, Math.ceil(64 / Math.max(band, 1)));
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {metrics.length > 1 ? (
          <Segmented<K>
            label="Chart metric"
            value={metric.key}
            onChange={setMetricKey}
            options={metrics.map((m) => ({ value: m.key, label: m.label }))}
            className="max-w-full overflow-x-auto"
          />
        ) : (
          <p className="text-xs font-medium text-stone-500">{metric.label}</p>
        )}
        <Segmented<'chart' | 'table'>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </div>

      {view === 'table' ? (
        <TableScroll className="overflow-y-auto rounded-md border border-stone-150" style={{ maxHeight: height }}>
          <Table>
            <THead className="sticky top-0">
              <tr>
                <TH>Date</TH>
                {metrics.map((m) => (
                  <TH key={m.key} align="right">
                    {m.label}
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {[...data].reverse().map((d) => (
                <TR key={d.date}>
                  <TD className="h-9 whitespace-nowrap">{shortDate(d.date)}</TD>
                  {metrics.map((m) => (
                    <TD key={m.key} className="h-9" align="right">
                      {fmt(m)(d[m.key] as number)}
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : (
        <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label={`${metric.label} over ${data.length} ${data[0]?.date.length === 7 ? 'months' : 'days'}`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#EFEBE6" strokeWidth={1} />
                  <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-400 text-[10px] tabular">
                    {fmtTick(t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const v = d[metric.key] as number;
                const x = pad.left + i * band + (band - barW) / 2;
                const top = y(v);
                const h = pad.top + innerH - top;
                const r = Math.min(4, h, barW / 2);
                const path =
                  h <= 0
                    ? ''
                    : `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`;
                return (
                  <g key={d.date}>
                    {path && (
                      <path
                        d={path}
                        className={cn('transition-colors duration-150', hover === i ? 'fill-gold-500' : hover !== null ? 'fill-maroon-300' : 'fill-maroon-700')}
                      />
                    )}
                    {i % labelEvery === (data.length - 1) % labelEvery && (
                      <text x={pad.left + i * band + band / 2} y={height - 8} textAnchor="middle" className="fill-stone-400 text-[10px]">
                        {shortDate(d.date)}
                      </text>
                    )}
                    <rect
                      x={pad.left + i * band}
                      y={pad.top}
                      width={band}
                      height={innerH}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      tabIndex={-1}
                    />
                  </g>
                );
              })}
              <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="#DDD5CB" />
            </svg>
          )}
          {width > 0 && values.every((v) => v === 0) && (
            <p className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-xs text-stone-400">{emptyLabel}</p>
          )}
          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute z-10 min-w-[170px] rounded-md border border-stone-150 bg-white px-3 py-2 shadow-raised animate-fade-in"
              style={{
                left: Math.min(Math.max(pad.left + hover * band + band / 2 - 85, 0), Math.max(0, width - 180)),
                top: Math.max(0, Math.min(y(hovered[metric.key] as number) - 40 - metrics.length * 18, height - 60 - metrics.length * 18)),
              }}
            >
              <p className="text-[11px] text-stone-500">{shortDate(hovered.date)}</p>
              {metrics.map((m) => (
                <p key={m.key} className={cn('tabular flex justify-between gap-4', m.key === metric.key ? 'text-sm font-semibold text-stone-900' : 'text-[11px] text-stone-500')}>
                  <span className={m.key === metric.key ? 'text-[11px] font-normal text-stone-500' : undefined}>{m.label}</span>
                  {fmt(m)(hovered[m.key] as number)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars, single hue, value at the bar tip. */
export function BarList({
  items,
  format = formatNumber,
  emptyLabel = 'No data yet',
}: {
  items: { key: string; label: React.ReactNode; value: number; hint?: string }[];
  format?: (v: number) => string;
  emptyLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (max === 0) return <p className="py-6 text-center text-xs text-stone-400">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} title={item.hint}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-stone-700">{item.label}</span>
            <span className="tabular shrink-0 font-medium text-stone-900">{format(item.value)}</span>
          </div>
          <div className="h-2 rounded-r bg-stone-100">
            <div
              className="h-full rounded-r bg-maroon-600 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two-part proportion meter (e.g. active vs inactive), labelled on both sides. */
export function SplitMeter({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b;
  const pct = total ? (a / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full">
        <div className="rounded-l-full bg-maroon-700 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        <div className="flex-1 rounded-r-full bg-maroon-100" />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-maroon-700" />
          {aLabel} <span className="tabular font-medium text-stone-800">{formatNumber(a)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-maroon-100 ring-1 ring-inset ring-maroon-200" />
          {bLabel} <span className="tabular font-medium text-stone-800">{formatNumber(b)}</span>
        </span>
      </div>
    </div>
  );
}
