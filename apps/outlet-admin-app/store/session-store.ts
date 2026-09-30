import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Outlet, OutletAdminSession } from '@lotmorewins/types';

const TOKEN_KEY = 'lmw_outlet_admin_token';
const SESSION_KEY = 'lmw_outlet_admin_session';

/** SecureStore on devices; browser storage on web (expo-secure-store has no web support). */
const storage =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItemAsync: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        deleteItemAsync: async (key: string) => globalThis.localStorage?.removeItem(key),
      }
    : SecureStore;

interface SessionState {
  token: string | null;
  admin: OutletAdminSession['admin'] | null;
  outlet: Outlet | null;
  isRestoring: boolean;
  restore: () => Promise<void>;
  signIn: (session: OutletAdminSession) => Promise<void>;
  setOutlet: (outlet: Outlet) => void;
  signOut: () => Promise<void>;
}

/**
 * The outlet shown here is display data only. The server resolves the outlet from the
 * verified token on every request, so nothing in this store is trusted for authorization.
 */
export const useSession = create<SessionState>((set, get) => ({
  token: null,
  admin: null,
  outlet: null,
  isRestoring: true,

  restore: async () => {
    try {
      const token = await storage.getItemAsync(TOKEN_KEY);
      const raw = await storage.getItemAsync(SESSION_KEY);
      if (token && raw) {
        const { admin, outlet } = JSON.parse(raw) as Pick<OutletAdminSession, 'admin' | 'outlet'>;
        set({ token, admin, outlet, isRestoring: false });
        return;
      }
    } catch {
      // fall through to signed-out
    }
    set({ token: null, admin: null, outlet: null, isRestoring: false });
  },

  signIn: async ({ token, admin, outlet }) => {
    await storage.setItemAsync(TOKEN_KEY, token);
    await storage.setItemAsync(SESSION_KEY, JSON.stringify({ admin, outlet }));
    set({ token, admin, outlet, isRestoring: false });
  },

  setOutlet: (outlet) => {
    set({ outlet });
    const { admin } = get();
    storage.setItemAsync(SESSION_KEY, JSON.stringify({ admin, outlet })).catch(() => {});
  },

  signOut: async () => {
    await storage.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await storage.deleteItemAsync(SESSION_KEY).catch(() => {});
    set({ token: null, admin: null, outlet: null, isRestoring: false });
  },
}));
