import { ApiClientError, createApiClient } from '@lotmorewins/api-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from '../store/session-store';

/** The live API (the Super Admin domain). EXPO_PUBLIC_API_URL can point a build at another server. */
const LIVE_API_URL = 'https://superadmin.lotmorewins.com/api';

const LOCALHOST = /\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/;

/**
 * A localhost API URL means "the dev machine". A phone in Expo Go reaches it at the LAN IP it
 * loaded the bundle from (Metro's hostUri); the Android emulator reaches it through 10.0.2.2.
 */
const toDeviceUrl = (url: string) => {
  if (!LOCALHOST.test(url)) return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost && !/^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/.test(devHost)) return url.replace(LOCALHOST, `//${devHost}`);
  return Platform.OS === 'android' ? url.replace(LOCALHOST, '//10.0.2.2') : url;
};

const baseUrl = toDeviceUrl(process.env.EXPO_PUBLIC_API_URL || LIVE_API_URL).replace(/\/+$/, '');

// Which app and build is calling, so the server can tell old installs from new. Native only: on the
// web a custom header needs a CORS preflight that an older server may not allow.
const clientHeader = `outlet-admin-app/${Constants.expoConfig?.version ?? '0'}+${Constants.expoConfig?.android?.versionCode ?? 0}`;
const defaultHeaders: Record<string, string> = Platform.OS === 'web' ? {} : { 'X-LMW-Client': clientHeader };

export const apiClient = createApiClient({
  baseUrl,
  defaultHeaders,
  getAuthToken: () => useSession.getState().token,
});

/** 403s that describe the business state (not the session) and must not sign the admin out. */
const BUSINESS_FORBIDDEN_CODES = new Set(['OUTLET_INACTIVE', 'OFFERS_EDIT_FORBIDDEN', 'REDEEM_DISABLED']);

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
