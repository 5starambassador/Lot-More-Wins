import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from './haptics';
import { unregisterPush } from './push';
import { useAuthStore } from '../store/auth-store';

const TITLE = 'Sign out?';
const MESSAGE = 'You can sign in again any time with your mobile number or email and password.';

/** Asks before signing out. React Native Web's Alert shows nothing, so the web uses the browser's confirm. */
function confirmSignOut(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${TITLE}\n\n${MESSAGE}`)) onConfirm();
    return;
  }
  Alert.alert(TITLE, MESSAGE, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Sign-out with a confirmation step: the session only lives on this device. Clears the stored
 * session and every cached query, then replaces the history entry with the login page;
 * the root AuthGate keeps protected pages from showing again on back navigation.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return () =>
    confirmSignOut(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // While the session token is still valid: stop pushing this partner's activity to the device.
      await unregisterPush().catch(() => {});
      await logout();
      queryClient.clear();
      router.replace('/(auth)/login');
    });
}
