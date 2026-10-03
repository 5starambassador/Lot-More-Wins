import { useCallback, useEffect, useState } from 'react';
import { PARTNER_WEB_URL } from './config';

/**
 * Partner App download links, set by the Super Admin (Settings → App downloads) and read from
 * the API's public /app-links.
 *
 * Android uses exactly the link set there: no file is bundled with this site, so when the
 * request fails or no link is set, the page says so instead of offering a download.
 * iOS falls back to the web app address from the environment.
 */

export type AppLinkType = 'DIRECT' | 'STORE';

export interface AppLink {
  url: string | null;
  /** DIRECT: an APK (Android) or the web app (iOS). STORE: Google Play / App Store. */
  type: AppLinkType;
}

export interface AppLinks {
  android: AppLink;
  ios: AppLink;
}

export type AppLinksState =
  | { status: 'loading' }
  | { status: 'ready'; links: AppLinks }
  /** `reason`: shown to the visitor. */
  | { status: 'error'; reason: string };

const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'https://lotmore-wins.vercel.app/api').replace(/\/+$/, '');
const TIMEOUT_MS = 12_000;

const typeOf = (link: Partial<AppLink> | undefined): AppLinkType => (link?.type === 'STORE' ? 'STORE' : 'DIRECT');

async function fetchAppLinks(signal: AbortSignal): Promise<AppLinks> {
  const res = await fetch(`${API_URL}/app-links`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: Partial<AppLinks> };
  const remote = body.data;
  if (!remote) throw new Error('No data in the response');
  return {
    android: { url: remote.android?.url?.trim() || null, type: typeOf(remote.android) },
    ios: remote.ios?.url?.trim()
      ? { url: remote.ios.url.trim(), type: typeOf(remote.ios) }
      : { url: PARTNER_WEB_URL, type: 'DIRECT' },
  };
}

export function useAppLinks(): AppLinksState & { retry: () => void } {
  const [state, setState] = useState<AppLinksState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `cancelled`: this request was superseded (retry or unmount) and must not update the page.
    // A timeout also aborts the request, but that one is reported as an error.
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    setState({ status: 'loading' });
    fetchAppLinks(controller.signal)
      .then((links) => {
        if (!cancelled) setState({ status: 'ready', links });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('Could not load the app download links:', error);
        setState({
          status: 'error',
          reason: navigator.onLine
            ? 'We could not load the download links right now. Please try again in a moment.'
            : 'You appear to be offline. Connect to the internet and try again.',
        });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
