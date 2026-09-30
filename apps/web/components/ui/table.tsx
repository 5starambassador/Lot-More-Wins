import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

/** Enterprise data table primitives: quiet header, hairline rows, tabular numbers. */

export function TableScroll({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('scroll-thin overflow-x-auto', className)} {...props} />;
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-left text-[13px]', className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-stone-150 bg-stone-25', className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-stone-100', className)} {...props} />;
}

export function TH({
  className,
  align = 'left',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500 first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...props}
    />
  );
}

export function SortTH<K extends string>({
  column,
  sort,
  onSort,
  children,
  align,
  className,
}: {
  column: K;
  sort: { key: K; dir: 'asc' | 'desc' };
  onSort: (key: K) => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH
      align={align}
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-[0.06em] transition-colors hover:text-stone-900',
          active && 'text-stone-900',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-gold-600' : 'text-stone-300')} />
      </button>
    </TH>
  );
}

export function TR({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors',
        interactive && 'cursor-pointer hover:bg-maroon-50/40 focus-within:bg-maroon-50/40',
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = 'left',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'h-14 px-4 align-middle text-stone-700 first:pl-5 last:pr-5',
        align === 'right' && 'tabular text-right',
        align === 'center' && 'text-center',
        className
      )}
      {...props}
    />
  );
}

/** Filter/search bar that sits on top of a table inside the same panel. */
export function TableToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-3 border-b border-stone-150 px-5 py-3 lg:flex-row lg:items-center', className)}
      {...props}
    />
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  noun = 'results',
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-stone-150 px-5 py-3 text-xs text-stone-500">
      <p className="tabular">
        <span className="font-medium text-stone-800">
          {formatNumber(from)}–{formatNumber(to)}
        </span>{' '}
        of {formatNumber(total)} {noun}
      </p>
      <div className="flex items-center gap-1">
        <span className="mr-2 hidden sm:inline">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Placeholder rows while a table loads, so the layout does not jump. */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="h-14 px-4 first:pl-5 last:pr-5">
              <div
                className="h-3 animate-pulse rounded bg-stone-100"
                style={{ width: `${c === 0 ? 70 : 40 + ((r * 7 + c * 13) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
