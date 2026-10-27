import { createApiClient } from '@lotmorewins/api-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureStorage as SecureStore } from './secure-storage';

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
const clientHeader = `partner-app/${Constants.expoConfig?.version ?? '0'}+${Constants.expoConfig?.android?.versionCode ?? 0}`;
const defaultHeaders: Record<string, string> = Platform.OS === 'web' ? {} : { 'X-LMW-Client': clientHeader };

export const apiClient = createApiClient({
  baseUrl,
  defaultHeaders,
  getAuthToken: async () => {
    try {
      return await SecureStore.getItemAsync('lmw_partner_token');
    } catch {
      return null;
    }
  },
});

export default apiClient;
