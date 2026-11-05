import { useEffect, useState } from 'react';

/**
 * How each platform's download button behaves, set by the Super Admin (Settings → App downloads)
 * and read from the API's public /app-links:
 * - STORE with a link: the button opens that Google Play / App Store listing.
 * - DIRECT (web version), no link, or the links could not be loaded: the button opens the
 *   "Add to Home Screen" guide for the web version, which always works.
 */

export type Platform = 'android' | 'ios';

/** The store listing to open for each platform, or null to show the web version's install guide. */
export type StoreLinks = Record<Platform, string | null>;

export type AppLinksState = { status: 'loading' } | { status: 'ready'; stores: StoreLinks };

export const API_URL = (import.meta.env.VITE_API_URL?.trim() || 'https://superadmin.lotmorewins.com/api').replace(/\/+$/, '');
const TIMEOUT_MS = 8_000;

interface RemoteLink {
  url?: string | null;
  type?: string;
}

const storeUrl = (link: RemoteLink | undefined): string | null =>
  link?.type === 'STORE' && link.url?.trim() ? link.url.trim() : null;

const WEB_ONLY: StoreLinks = { android: null, ios: null };

export function useAppLinks(): AppLinksState {
  const [state, setState] = useState<AppLinksState>({ status: 'loading' });

  useEffect(() => {
    // `cancelled`: the page unmounted, so the result is dropped. A timeout also aborts the request,
    // and that one falls back to the web version.
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    fetch(`${API_URL}/app-links`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: { android?: RemoteLink; ios?: RemoteLink } };
        if (!cancelled) setState({ status: 'ready', stores: { android: storeUrl(body.data?.android), ios: storeUrl(body.data?.ios) } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('Could not load the app download links, showing the web version:', error);
        setState({ status: 'ready', stores: WEB_ONLY });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return state;
}
