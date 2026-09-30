'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Health = 'checking' | 'ok' | 'degraded';

/** Desktop utility bar: live API/database status and today's date. */
export function AdminTopbar() {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch('/api/health', { cache: 'no-store' })
        .then((r) => r.json())
        .then((b: { database?: string }) => !cancelled && setHealth(b.database === 'connected' ? 'ok' : 'degraded'))
        .catch(() => !cancelled && setHealth('degraded'));
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const label = health === 'ok' ? 'All systems operational' : health === 'degraded' ? 'Database unreachable' : 'Checking status…';

  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-stone-150 bg-background/85 px-8 backdrop-blur lg:flex">
      <p className="text-xs text-stone-500">{today}</p>
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          health === 'degraded' ? 'border-red-200 bg-red-50 text-red-700' : 'border-stone-200 bg-white text-stone-600'
        )}
        role="status"
      >
        <span className="relative flex h-2 w-2">
          {health === 'ok' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              health === 'ok' ? 'bg-emerald-500' : health === 'degraded' ? 'bg-red-500' : 'bg-stone-300'
            )}
          />
        </span>
        {label}
      </div>
    </div>
  );
}
