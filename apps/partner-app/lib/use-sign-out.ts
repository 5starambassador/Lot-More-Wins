import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from './haptics';
import { useAuthStore } from '../store/auth-store';

/** Sign-out with a confirmation step: the session only lives on this device. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return () =>
    Alert.alert('Sign out?', 'You can sign in again any time with your mobile number or email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          queryClient.clear();
          router.replace('/');
        },
      },
    ]);
}
