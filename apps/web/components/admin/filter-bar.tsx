'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, X } from 'lucide-react';
import type { AdminDateRangeQuery } from '@lotmorewins/types';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { useToast } from '@/components/ui/toast';
import { downloadCsv, errorMessage, isUnauthenticated } from '@/lib/admin-client';
import { cn } from '@/lib/utils';

/**
 * The one filter section used on every admin page: filters on the left, "Clear" and
 * "Export CSV" on the right. The export always downloads the whole result the filters
 * currently select, not just the page on screen.
 */

export type DateRange = Required<{ [K in keyof AdminDateRangeQuery]: string }>;
export const NO_DATES: DateRange = { from: '', to: '' };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};
const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** The range of the last `days` days, ending today. */
export const lastDays = (days: number): DateRange => ({ from: daysAgo(days - 1), to: today() });

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads `from` / `to` from the page URL, ignoring anything that is not a date. */
export function readDateRange(params: URLSearchParams, fallback: DateRange = NO_DATES): DateRange {
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  if (!from && !to) return fallback;
  return { from: DATE.test(from) ? from : '', to: DATE.test(to) ? to : '' };
}

/** The `from` / `to` part of an API query: empty ends are left out. */
export const dateQuery = (range: DateRange): AdminDateRangeQuery => ({ from: range.from || undefined, to: range.to || undefined });

type Mode = 'all' | '7d' | '30d' | '90d' | 'day' | 'month' | 'year' | 'range';

const MODE_LABEL: Record<Mode, string> = {
  all: 'All time',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  day: 'A day',
  month: 'A month',
  year: 'A year',
  range: 'Custom range',
};

function modeOf({ from, to }: DateRange): Mode {
  if (!from && !to) return 'all';
  if (!from || !to) return 'range';
  if (to === today()) {
    if (from === daysAgo(6)) return '7d';
    if (from === daysAgo(29)) return '30d';
    if (from === daysAgo(89)) return '90d';
  }
  if (from === to) return 'day';
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) return 'year';
  if (fy === ty && fm === tm && fd === 1 && td === lastDayOfMonth(ty!, tm!)) return 'month';
  return 'range';
}

const FIRST_YEAR = 2024;

/**
 * Date filter by day, month, year, a rolling period or a custom from–to range.
 * Whatever the mode, it resolves to an inclusive `from` / `to` pair of dates.
 */
export function DateRangeFilter({
  value,
  onChange,
  allowAll = true,
  label = 'Date',
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Dashboards always need a period, so they hide "All time". */
  allowAll?: boolean;
  label?: string;
}) {
  const [mode, setMode] = useState<Mode>(() => modeOf(value));
  // The value can change without going through the select (Clear, a link, a reload), so the
  // chosen mode is only kept while the dates still fit it; "Custom range" fits any dates.
  const derived = modeOf(value);
  const shown: Mode = derived === 'all' ? 'all' : mode === 'range' || mode === derived ? mode : derived;
  const thisYear = new Date().getFullYear();

  const pick = (next: Mode) => {
    setMode(next);
    const now = new Date();
    if (next === 'all') onChange(NO_DATES);
    else if (next === '7d') onChange(lastDays(7));
    else if (next === '30d') onChange(lastDays(30));
    else if (next === '90d') onChange(lastDays(90));
    else if (next === 'day') onChange({ from: today(), to: today() });
    else if (next === 'month') {
      const [y, m] = [now.getFullYear(), now.getMonth() + 1];
      onChange({ from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` });
    } else if (next === 'year') onChange({ from: `${thisYear}-01-01`, to: `${thisYear}-12-31` });
    else onChange(value.from && value.to ? value : lastDays(30));
  };

  const modes = (Object.keys(MODE_LABEL) as Mode[]).filter((m) => allowAll || m !== 'all');
  const inputClass = 'w-[9.5rem] tabular';

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${label} filter`}>
      <Select aria-label={`${label} filter type`} value={shown} onChange={(e) => pick(e.target.value as Mode)} className="w-40">
        {modes.map((m) => (
          <option key={m} value={m}>
            {MODE_LABEL[m]}
          </option>
        ))}
      </Select>
      {shown === 'day' && (
        <Input
          type="date"
          aria-label="Day"
          max={today()}
          value={value.from}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: e.target.value })}
          className={inputClass}
        />
      )}
      {shown === 'month' && (
        <Input
          type="month"
          aria-label="Month"
          max={today().slice(0, 7)}
          value={value.from.slice(0, 7)}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m] = e.target.value.split('-').map(Number);
            onChange({ from: `${e.target.value}-01`, to: `${e.target.value}-${pad(lastDayOfMonth(y!, m!))}` });
          }}
          className={inputClass}
        />
      )}
      {shown === 'year' && (
        <Select
          aria-label="Year"
          value={value.from.slice(0, 4)}
          onChange={(e) => onChange({ from: `${e.target.value}-01-01`, to: `${e.target.value}-12-31` })}
          className="w-28"
        >
          {Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      )}
      {shown === 'range' && (
        <>
          <Input
            type="date"
            aria-label="From date"
            max={value.to || today()}
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={inputClass}
          />
          <span className="text-xs text-stone-400">to</span>
          <Input
            type="date"
            aria-label="To date"
            min={value.from || undefined}
            max={today()}
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={inputClass}
          />
        </>
      )}
    </div>
  );
}

/** Downloads `GET /api{path}?…&format=csv` — the full filtered result as a CSV file. */
export function ExportCsvButton({
  path,
  params,
  label = 'Export CSV',
  size = 'md',
}: {
  path: string;
  params?: Record<string, string | number | undefined>;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await downloadCsv(path, params);
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else toast('error', 'Could not export', errorMessage(err, 'The CSV could not be created. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="secondary" size={size} onClick={run} loading={busy}>
      {!busy && <Download className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {label}
    </Button>
  );
}

export function FilterBar({
  children,
  onClear,
  exportCsv,
  className,
}: {
  children: React.ReactNode;
  /** Shown only while a filter is active. */
  onClear?: (() => void) | false;
  exportCsv?: React.ComponentProps<typeof ExportCsvButton>;
  className?: string;
}) {
  return (
    <Panel
      aria-label="Filters"
      className={cn('mb-6 flex flex-col gap-3 px-5 py-3 animate-rise-in xl:flex-row xl:items-center', className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {onClear && (
          <Button type="button" variant="ghost" onClick={onClear}>
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
        {exportCsv && <ExportCsvButton {...exportCsv} />}
      </div>
    </Panel>
  );
}
