import { useEffect, useState } from 'react';
import { API_URL } from './app-links';

const POLL_MS = 3_000;
const TIMEOUT_MS = 8_000;

/**
 * The partner count from the API, refreshed every few seconds while the page is on screen.
 * Null until the first answer; a failed poll keeps the latest figure and tries again.
 */
export function useLiveCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const res = await fetch(`${API_URL}/partner-count`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: { count?: number } };
        const latest = body.data?.count;
        if (typeof latest !== 'number') throw new Error('No count in the response');
        if (!cancelled) setCount(latest);
      } catch (error) {
        console.warn('Could not load the partner count:', error);
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    // Coming back to the tab shows the current figure straight away.
    const onVisibility = () => void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return count;
}
