import { create } from 'zustand';
import { secureStorage as SecureStore } from '../lib/secure-storage';
import type { PartnerProfile, PermanentQRItem } from '@lotmorewins/types';

interface AuthState {
  partner: PartnerProfile | null;
  qrCodes: PermanentQRItem[];
  token: string | null;
  isLoading: boolean;
  /** Set right after registration: Home opens the welcome gift once, then clears it. */
  welcome: { claimedPoints: number } | null;
  setSession: (partner: PartnerProfile, qrCodes: PermanentQRItem[], token: string) => Promise<void>;
  updatePartner: (partner: PartnerProfile) => void;
  updateQrCodes: (qrCodes: PermanentQRItem[]) => void;
  setWelcome: (welcome: { claimedPoints: number } | null) => void;
  loadStoredSession: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const SESSION_TOKEN_KEY = 'lmw_partner_token';
const SECURE_TOKEN_KEY = SESSION_TOKEN_KEY;
const SECURE_PROFILE_KEY = 'lmw_partner_profile';
const SECURE_QR_KEY = 'lmw_partner_qr_codes';

export const useAuthStore = create<AuthState>((set) => ({
  partner: null,
  qrCodes: [],
  token: null,
  isLoading: true,
  welcome: null,

  setSession: async (partner, qrCodes, token) => {
    try {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
      await SecureStore.setItemAsync(SECURE_PROFILE_KEY, JSON.stringify(partner));
      await SecureStore.setItemAsync(SECURE_QR_KEY, JSON.stringify(qrCodes));
    } catch (err) {
      console.warn('SecureStore save error:', err);
    }
    set({ partner, qrCodes, token, isLoading: false });
  },

  updatePartner: (partner) => {
    set({ partner });
    SecureStore.setItemAsync(SECURE_PROFILE_KEY, JSON.stringify(partner)).catch(() => {});
  },

  updateQrCodes: (qrCodes) => {
    set({ qrCodes });
    SecureStore.setItemAsync(SECURE_QR_KEY, JSON.stringify(qrCodes)).catch(() => {});
  },

  setWelcome: (welcome) => set({ welcome }),

  loadStoredSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
      const profileJson = await SecureStore.getItemAsync(SECURE_PROFILE_KEY);
      const qrJson = await SecureStore.getItemAsync(SECURE_QR_KEY);

      if (token && profileJson && qrJson) {
        const partner = JSON.parse(profileJson);
        const qrCodes = JSON.parse(qrJson);
        set({ partner, qrCodes, token, isLoading: false });
        return true;
      }
    } catch (err) {
      console.warn('SecureStore read error:', err);
    }
    set({ partner: null, qrCodes: [], token: null, isLoading: false });
    return false;
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
      await SecureStore.deleteItemAsync(SECURE_PROFILE_KEY);
      await SecureStore.deleteItemAsync(SECURE_QR_KEY);
    } catch (err) {
      console.warn('SecureStore delete error:', err);
    }
    set({ partner: null, qrCodes: [], token: null, isLoading: false, welcome: null });
  },
}));
