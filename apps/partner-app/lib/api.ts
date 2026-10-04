import { createApiClient } from '@lotmorewins/api-client';
import { Platform } from 'react-native';
import { secureStorage as SecureStore } from './secure-storage';

/** The live API (the Super Admin domain). EXPO_PUBLIC_API_URL can point a build at another server. */
const LIVE_API_URL = 'https://superadmin.lotmorewins.com/api';

/** The Android emulator reaches the host machine's localhost through 10.0.2.2. */
const toDeviceUrl = (url: string) =>
  Platform.OS === 'android' ? url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, '//10.0.2.2') : url;

const baseUrl = toDeviceUrl(process.env.EXPO_PUBLIC_API_URL || LIVE_API_URL).replace(/\/+$/, '');

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
