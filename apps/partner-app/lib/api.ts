import { createApiClient } from '@lotmorewins/api-client';
import { secureStorage as SecureStore } from './secure-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

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

// Clean up trailing slash
const baseUrl = resolveApiUrl(rawApiUrl).replace(/\/+$/, '');

export const apiClient = createApiClient({
  baseUrl,
  getAuthToken: async () => {
    try {
      return await SecureStore.getItemAsync('lmw_partner_token');
    } catch {
      return null;
    }
  },
});

export default apiClient;
