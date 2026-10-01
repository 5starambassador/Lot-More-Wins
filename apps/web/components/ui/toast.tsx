'use client';

import * as React from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<{
  toast: (tone: ToastTone, title: string, description?: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const dismiss = React.useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = React.useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setItems((list) => [...list.slice(-2), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : XCircle;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-[#5C0404] bg-brand-gradient px-4 py-3 text-white shadow-raised animate-rise-in"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.tone === 'success' ? 'text-gold-300' : 'text-white')} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-maroon-200">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded p-0.5 text-maroon-300 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}
