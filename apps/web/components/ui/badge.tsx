import * as React from 'react';
import { CheckCircle2, CircleDashed, Clock3, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'gold' | 'maroon';

const tones: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-700/15',
  warning: 'bg-amber-50 text-amber-800 ring-amber-700/20',
  danger: 'bg-red-50 text-red-700 ring-red-700/15',
  neutral: 'bg-stone-100 text-stone-600 ring-stone-500/15',
  gold: 'bg-gold-50 text-gold-700 ring-gold-500/30',
  maroon: 'bg-maroon-50 text-maroon-700 ring-maroon-700/15',
};

/** Status never relies on colour alone: success/warning/danger/neutral carry an icon too. */
const statusIcons: Partial<Record<Tone, React.ComponentType<{ className?: string }>>> = {
  success: CheckCircle2,
  warning: Clock3,
  danger: XCircle,
  neutral: CircleDashed,
};

export function Badge({
  className,
  tone = 'neutral',
  icon = true,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: boolean }) {
  const Icon = icon ? statusIcons[tone] : undefined;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}

/** Small uppercase tag for categories (roles, transaction types) — not a status. */
export function Tag({ className, gold, ...props }: React.HTMLAttributes<HTMLSpanElement> & { gold?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium',
        gold ? 'bg-gold-50 text-gold-700' : 'bg-stone-100 text-stone-600',
        className
      )}
      {...props}
    />
  );
}

