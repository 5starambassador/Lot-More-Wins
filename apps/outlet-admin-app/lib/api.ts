import { ApiClientError, createApiClient } from '@lotmorewins/api-client';
import { useSession } from '../store/session-store';

/** The live API on Vercel. EXPO_PUBLIC_API_URL can point a build at another server. */
const LIVE_API_URL = 'https://lotmore-wins.vercel.app/api';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || LIVE_API_URL).replace(/\/+$/, '');

export const apiClient = createApiClient({
  baseUrl,
  getAuthToken: () => useSession.getState().token,
});

/** 403s that describe the business state (not the session) and must not sign the admin out. */
const BUSINESS_FORBIDDEN_CODES = new Set(['OUTLET_INACTIVE']);

/** The session is missing, expired or revoked: the admin must sign in again. */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) return false;
  if (error.status === 401) return true;
  return error.status === 403 && !BUSINESS_FORBIDDEN_CODES.has(error.code ?? '');
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.code : undefined;
}

/** User-facing text for an API failure; server messages are already written for staff. */
export function describeError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return 'No connection to the server. Check the network and try again.';
    if (error.code === 'TIMEOUT') return 'The server took too long to respond. Please try again.';
    return error.message || fallback;
  }
  return fallback;
}

export default apiClient;
