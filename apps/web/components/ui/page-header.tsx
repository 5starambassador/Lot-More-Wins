import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  /** Status pills or tags shown beside the title. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 animate-rise-in', className)}>
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-stone-500">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={b.label}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-stone-300" />}
              {b.href ? (
                <Link href={b.href} className="transition-colors hover:text-maroon-700">
                  {b.label}
                </Link>
              ) : (
                <span className="text-stone-700">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-stone-900">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Segmented control for small, mutually exclusive filters (ranges, status). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex h-9 items-center rounded-md border border-stone-200 bg-stone-50 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 text-xs font-medium transition-all',
              active ? 'bg-white text-maroon-800 shadow-[0_1px_2px_rgba(28,25,22,0.08)] ring-1 ring-stone-200' : 'text-stone-500 hover:text-stone-800'
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('tabular text-[11px]', active ? 'text-gold-600' : 'text-stone-400')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
