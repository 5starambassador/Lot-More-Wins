import { ApiClientError, createApiClient } from '@lotmorewins/api-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from '../store/session-store';

/**
 * On a device or emulator, "localhost" is the device itself, not the dev machine.
 * Swap it for the host the app already reaches Metro through (10.0.2.2 on the Android
 * emulator, the LAN IP on a physical device); fall back to 10.0.2.2 on Android.
 * In a browser, use the host the page was served from, so a phone opening the dev
 * server by LAN IP reaches the API on that same machine.
 */
function resolveApiUrl(url: string): string {
  if (!/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/.test(url)) return url;
  if (Platform.OS === 'web') {
    const pageHost = globalThis.location?.hostname;
    return pageHost ? url.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${pageHost}`) : url;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  const host = devHost || (Platform.OS === 'android' ? '10.0.2.2' : null);
  return host ? url.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${host}`) : url;
}

const baseUrl = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

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
