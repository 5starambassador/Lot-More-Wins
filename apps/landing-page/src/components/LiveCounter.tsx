import { useEffect, useRef, useState } from 'react';
import { useLiveCount } from '../lib/live-count';

const TWEEN_MS = 900;
const format = (value: number) => value.toLocaleString('en-IN');

/** Rolls the shown number to `target`: up from zero on load, then along with each new registration. */
function useRollingNumber(target: number | null): number | null {
  const [shown, setShown] = useState<number | null>(null);
  const current = useRef(0);

  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target;
      setShown(target);
      return;
    }
    const from = current.current;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / TWEEN_MS);
      const eased = 1 - (1 - progress) ** 3;
      current.current = Math.round(from + (target - from) * eased);
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

/** The big live partner count, with a placeholder until the API first answers. */
export function LiveCounter({ className = '' }: { className?: string }) {
  const count = useLiveCount();
  const shown = useRollingNumber(count);

  // The "+1" badge: each rise after the first figure replays its animation through a new key.
  const previous = useRef<number | null>(null);
  const [rise, setRise] = useState<{ id: number; by: number } | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (previous.current !== null && count > previous.current) {
      const by = count - previous.current;
      setRise((last) => ({ id: (last?.id ?? 0) + 1, by }));
    }
    previous.current = count;
  }, [count]);

  return (
    <div className={`gilt-frame rounded-[2rem] shadow-[0_0_70px_-25px_rgba(245,197,66,0.7)] ${className}`}>
      <div className="relative overflow-hidden rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-canvas-top via-canvas to-canvas-night px-5 py-8 text-center sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.2)_0%,transparent_68%)]" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-gilt/40 bg-canvas-night/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gilt-bright">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ring absolute inset-0 rounded-full bg-[#4ADE80]" />
              <span className="relative h-2 w-2 rounded-full bg-[#4ADE80]" />
            </span>
            Live
          </span>

          <div className="relative mt-5">
            {shown === null ? (
              <div className="mx-auto h-[4.5rem] w-56 animate-pulse rounded-2xl bg-white/10 sm:h-24 sm:w-72" aria-label="Loading the partner count" />
            ) : (
              <p className="text-gilt-gradient text-[4.5rem] font-bold leading-none tracking-tight [font-variant-numeric:tabular-nums] sm:text-8xl" aria-live="off">
                {format(shown)}
              </p>
            )}
            {rise && (
              <span key={rise.id} className="animate-count-rise absolute right-[8%] top-0 rounded-full bg-gilt px-2.5 py-0.5 text-sm font-bold text-ink" aria-hidden>
                +{rise.by}
              </span>
            )}
          </div>

          <p className="mt-4 text-lg font-semibold text-ivory sm:text-xl">Total partners who wins every day</p>
          <p className="mt-1 text-sm font-light text-ivory-muted">Updates live as new partners join.</p>
        </div>
      </div>
    </div>
  );
}
