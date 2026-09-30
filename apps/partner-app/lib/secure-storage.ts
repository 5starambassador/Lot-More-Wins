import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** SecureStore on devices; browser storage on web (expo-secure-store has no web support). */
export const secureStorage =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItemAsync: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        deleteItemAsync: async (key: string) => globalThis.localStorage?.removeItem(key),
      }
    : SecureStore;
