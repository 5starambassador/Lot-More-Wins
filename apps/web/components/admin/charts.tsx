'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailySalesPoint } from '@lotmorewins/types';
import { cn } from '@/lib/utils';
import { formatCompact, formatCompactINR, formatINR, formatNumber } from '@/lib/format';
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

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type Metric = 'billAmount' | 'billCount';

/**
 * Daily sales, one series. Metric switch instead of a second axis; hover tooltip on every
 * column; table view for exact values.
 */
export function SalesChart({ data }: { data: DailySalesPoint[] }) {
  const [metric, setMetric] = useState<Metric>('billAmount');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();

  const height = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 48 };
  const values = data.map((d) => d[metric]);
  const ticks = useMemo(() => niceTicks(Math.max(...values, 0)), [values]);
  const yMax = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => pad.top + innerH - (v / yMax) * innerH;
  const fmtValue = metric === 'billAmount' ? formatINR : formatNumber;
  const fmtTick = metric === 'billAmount' ? formatCompactINR : formatCompact;
  const labelEvery = band < 22 ? 7 : band < 40 ? 5 : 2;
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<Metric>
          label="Chart metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'billAmount', label: 'Gross sales' },
            { value: 'billCount', label: 'Bills' },
          ]}
        />
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
        <TableScroll className="max-h-[220px] overflow-y-auto rounded-md border border-stone-150">
          <Table>
            <THead className="sticky top-0">
              <tr>
                <TH>Date</TH>
                <TH align="right">Bills</TH>
                <TH align="right">Gross sales</TH>
              </tr>
            </THead>
            <TBody>
              {[...data].reverse().map((d) => (
                <TR key={d.date}>
                  <TD className="h-9">{shortDate(d.date)}</TD>
                  <TD className="h-9" align="right">
                    {formatNumber(d.billCount)}
                  </TD>
                  <TD className="h-9" align="right">
                    {formatINR(d.billAmount)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : (
        <div ref={ref} className="relative h-[220px] w-full" onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label={`Daily ${metric === 'billAmount' ? 'gross sales' : 'bill count'}, last ${data.length} days`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#EFEBE6" strokeWidth={1} />
                  <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-400 text-[10px] tabular">
                    {fmtTick(t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const v = d[metric];
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
            <p className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-xs text-stone-400">No sales in this period yet</p>
          )}
          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute z-10 min-w-[150px] rounded-md border border-stone-150 bg-white px-3 py-2 shadow-raised animate-fade-in"
              style={{
                left: Math.min(Math.max(pad.left + hover * band + band / 2 - 75, 0), Math.max(0, width - 160)),
                top: Math.max(0, y(hovered[metric]) - 72),
              }}
            >
              <p className="text-[11px] text-stone-500">{shortDate(hovered.date)}</p>
              <p className="tabular text-sm font-semibold text-stone-900">{fmtValue(hovered[metric])}</p>
              <p className="tabular text-[11px] text-stone-500">
                {metric === 'billAmount' ? `${formatNumber(hovered.billCount)} bills` : formatINR(hovered.billAmount)}
              </p>
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
