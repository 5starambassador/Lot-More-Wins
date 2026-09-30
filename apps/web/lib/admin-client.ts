'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, createApiClient } from '@lotmorewins/api-client';

/** Browser-side API client for the Super Admin panel; the session travels in an httpOnly cookie. */
export const adminApi = createApiClient({ baseUrl: '/api' });

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiClientError) return error.message;
  return fallback;
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Loads admin data, re-running when `deps` change. An expired session redirects to /login;
 * other failures surface as `error`. Stale responses from superseded requests are ignored.
 */
export function useAdminQuery<T>(fetcher: () => Promise<T>, deps: React.DependencyList) {
  const router = useRouter();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => id === latest.current && setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (id !== latest.current) return;
        if (isUnauthenticated(err)) router.replace('/login');
        else setState((s) => ({ ...s, error: errorMessage(err, 'Could not load data.'), loading: false }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((update: (d: T | null) => T | null) => setState((s) => ({ ...s, data: update(s.data) })), []);
  return { ...state, reload, setData };
}

/** Debounced copy of a value, for search boxes. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
