import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The single surface primitive: a white, hairline-bordered region. Content is grouped
 * inside panels with dividers rather than nesting more cards.
 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-lg border border-stone-150 bg-white shadow-panel', className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-stone-150 px-5 py-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-600">{eyebrow}</p>}
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function PanelFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-stone-150 px-5 py-3', className)}
      {...props}
    />
  );
}

/** Label/value pairs for read-only detail views. */
export function DetailList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-stone-100', className)}>
      {items.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-2.5 text-[13px]">
          <dt className="text-stone-500">{label}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-stone-900 sm:text-left">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
