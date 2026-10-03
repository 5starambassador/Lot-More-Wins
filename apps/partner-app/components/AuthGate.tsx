import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_TOKEN_KEY, useAuthStore } from '../store/auth-store';

/** Routes that work without a session; everything else needs a signed-in partner. */
const PUBLIC_SEGMENTS = new Set(['(auth)', 'onboarding']);

/**
 * Keeps signed-out users off partner pages: after sign-out, browser back navigation, a stale
 * tab or a deep link to a partner page all land on the login page instead. On the web,
 * signing out in one tab also signs out the others.
 */
export function AuthGate() {
  const router = useRouter();
  // Typed routes never list the empty root path; at "/" there are no segments.
  const segments = useSegments() as string[];
  const navigationReady = !!useRootNavigationState()?.key;
  const queryClient = useQueryClient();
  const { partner, isLoading, loadStoredSession } = useAuthStore();

  const isPublic = segments.length === 0 || PUBLIC_SEGMENTS.has(segments[0]);

  useEffect(() => {
    if (!partner) loadStoredSession();
    // Only on start-up; screens that need it reload the session themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (navigationReady && !isLoading && !partner && !isPublic) router.replace('/(auth)/login');
  }, [navigationReady, isLoading, partner, isPublic, router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if ((event.key === SESSION_TOKEN_KEY || event.key === null) && !event.newValue && useAuthStore.getState().partner) {
        useAuthStore.getState().logout();
        queryClient.clear();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  return null;
}
