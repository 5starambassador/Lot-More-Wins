import 'react-native-gesture-handler';
import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { colors, fonts } from '../theme/tokens';

// Only the four weights the design uses; importing the package index would bundle all 18.
const POPPINS = {
  [fonts.regular]: require('@expo-google-fonts/poppins/Poppins_400Regular.ttf'),
  [fonts.medium]: require('@expo-google-fonts/poppins/Poppins_500Medium.ttf'),
  [fonts.semibold]: require('@expo-google-fonts/poppins/Poppins_600SemiBold.ttf'),
  [fonts.bold]: require('@expo-google-fonts/poppins/Poppins_700Bold.ttf'),
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
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
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="outlet/[id]" />
            <Stack.Screen name="activity" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="(auth)" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
