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

/**
 * The session is gone (signed out, expired, or the account was deactivated): back to /login.
 * A 403 for a page or action the account was not given is shown as an error instead.
 */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || (error.status === 403 && error.code === 'FORBIDDEN'));
}

/**
 * Downloads `GET /api{path}?…&format=csv` as a file. Every admin list route answers
 * `format=csv` with the whole filtered result, so the export matches the filters on screen.
 */
export async function downloadCsv(path: string, params: Record<string, string | number | undefined> = {}): Promise<void> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  query.set('format', 'csv');

  const res = await fetch(`/api${path}?${query}`, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiClientError(res.status, body?.message ?? 'The export could not be created.', body?.code);
  }
  const fileName = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
