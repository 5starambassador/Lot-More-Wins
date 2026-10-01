import { createApiClient } from '@lotmorewins/api-client';
import { secureStorage as SecureStore } from './secure-storage';

/** The live API on Vercel. EXPO_PUBLIC_API_URL can point a build at another server. */
const LIVE_API_URL = 'https://lotmore-wins.vercel.app/api';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || LIVE_API_URL).replace(/\/+$/, '');

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
