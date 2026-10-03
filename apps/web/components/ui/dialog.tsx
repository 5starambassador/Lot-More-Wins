'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/** Closes on Escape and keeps page scroll locked while an overlay is open. */
function useOverlay(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  /** Keeps the confirm button disabled, e.g. until a typed confirmation matches. */
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}) {
  const close = React.useCallback(() => !busy && onClose(), [busy, onClose]);
  useOverlay(open, close);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
        <div className="absolute inset-0 bg-maroon-950/40 backdrop-blur-[2px] animate-fade-in" onClick={close} />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="relative w-full max-w-md rounded-lg border border-stone-150 bg-white shadow-raised animate-rise-in"
        >
          <div className="flex gap-4 px-6 pb-2 pt-6">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tone === 'danger' ? 'bg-red-50 text-red-700' : 'bg-gold-50 text-gold-700'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-[15px] font-semibold text-stone-900">
                {title}
              </h2>
              {description && <div className="mt-1.5 text-[13px] leading-relaxed text-stone-600">{description}</div>}
            </div>
          </div>
          {children && <div className="px-6 pb-2 pl-20">{children}</div>}
          <div className="mt-4 flex justify-end gap-2 border-t border-stone-150 bg-stone-25 px-6 py-3.5">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button ref={confirmRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** Right-hand detail panel; full screen on phones. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-maroon-950/30 animate-fade-in" onClick={onClose} />
        <aside
          role="dialog"
          aria-modal="true"
          className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-raised animate-slide-in-right"
        >
          <header className="flex items-start justify-between gap-4 border-b border-stone-150 px-6 py-5">
            <div className="min-w-0">
              <div className="text-base font-semibold text-stone-900">{title}</div>
              {subtitle && <div className="mt-1 text-xs text-stone-500">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="scroll-thin flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="border-t border-stone-150 px-6 py-4">{footer}</footer>}
        </aside>
      </div>
    </Portal>
  );
}
