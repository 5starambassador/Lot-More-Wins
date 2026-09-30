import 'react-native-gesture-handler';
import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { useSession } from '../store/session-store';
import { isAuthError } from '../lib/api';
import { FullScreenLoader } from '../components/ui';
import { colors, fonts } from '../theme/tokens';

// Same four Poppins weights as the partner app (importing the package index would bundle all 18).
const POPPINS = {
  [fonts.regular]: require('@expo-google-fonts/poppins/Poppins_400Regular.ttf'),
  [fonts.medium]: require('@expo-google-fonts/poppins/Poppins_500Medium.ttf'),
  [fonts.semibold]: require('@expo-google-fonts/poppins/Poppins_600SemiBold.ttf'),
  [fonts.bold]: require('@expo-google-fonts/poppins/Poppins_700Bold.ttf'),
};

/** Sends signed-out users to login and signed-in users away from it. */
function useAuthGate() {
  const { token, isRestoring, restore } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    if (isRestoring) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) router.replace('/(auth)/login');
    else if (token && inAuth) router.replace('/(tabs)');
  }, [token, isRestoring, segments, router]);

  return isRestoring;
}

export default function RootLayout() {
  const signOut = useSession((s) => s.signOut);
  const [queryClient] = useState(() => {
    // An expired or revoked session anywhere signs the admin out.
    const onError = (error: unknown) => {
      if (isAuthError(error)) signOut();
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
    });
  });
  const isRestoring = useAuthGate();
  const [fontsLoaded, fontError] = useFonts(POPPINS);

  // Hold on the brand canvas until Poppins is ready so text never flashes in a system font.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="bill/[id]" />
          </Stack>
          {isRestoring && (
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
              <FullScreenLoader />
            </View>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
