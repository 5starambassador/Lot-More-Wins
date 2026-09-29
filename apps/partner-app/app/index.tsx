import { View, Text, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { createApiClient } from '@lotmorewins/api-client';
import type { HealthCheckResponse } from '@lotmorewins/types';

const apiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
});

export default function PartnerHomeScreen() {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleHapticTest = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCheckHealth = async () => {
    setLoading(true);
    try {
      const res: HealthCheckResponse = await apiClient.checkHealth();
      setHealthStatus(`Connected: ${res.service} (${res.status})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealthStatus(`API unreachable: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 py-8">
      <Animated.View entering={FadeInDown.duration(600)} className="space-y-6">
        {/* Status Badge */}
        <View className="self-start rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/20">
          <Text className="text-xs font-semibold text-emerald-400">
            Phase 1 Foundation Ready
          </Text>
        </View>

        {/* Title & App Identification */}
        <View>
          <Text className="text-3xl font-extrabold text-white">
            Lot More Wins
          </Text>
          <Text className="text-lg font-medium text-emerald-400 mt-1">
            Partner App
          </Text>
          <Text className="text-sm text-slate-400 mt-2 leading-relaxed">
            Registered business partner application. Architecture initialized with NativeWind, Reanimated, Gesture Handler, and shared API client.
          </Text>
        </View>

        {/* Foundation Validation Card */}
        <View className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <Text className="text-sm font-semibold text-white mb-3">
            Integrated Tech Stack
          </Text>
          <View className="space-y-2">
            <Text className="text-xs text-slate-400">• NativeWind v4 + Tailwind CSS</Text>
            <Text className="text-xs text-slate-400">• React Native Reanimated</Text>
            <Text className="text-xs text-slate-400">• Gesture Handler & Expo Haptics</Text>
            <Text className="text-xs text-slate-400">• Shared @lotmorewins/api-client</Text>
          </View>
        </View>

        {/* API Health Probe */}
        <Pressable
          onPress={handleCheckHealth}
          className="p-4 rounded-xl bg-slate-800 active:bg-slate-700 border border-slate-700 items-center"
        >
          <Text className="text-sm font-semibold text-slate-200">
            {loading ? 'Checking API Health...' : 'Check API Connection (@lotmorewins/api-client)'}
          </Text>
          {healthStatus && (
            <Text className="text-xs text-emerald-400 mt-2">{healthStatus}</Text>
          )}
        </Pressable>

        {/* Interactive Haptic Test Button */}
        <Pressable
          onPress={handleHapticTest}
          className="p-4 rounded-xl bg-slate-800 active:bg-slate-700 border border-slate-700 items-center"
        >
          <Text className="text-sm font-semibold text-slate-200">
            Test Haptic Feedback
          </Text>
        </Pressable>

        {/* Auth Route Placeholder Link */}
        <Link href="/(auth)/login" asChild>
          <Pressable className="p-4 rounded-xl bg-emerald-600 active:bg-emerald-700 items-center">
            <Text className="text-sm font-semibold text-white">
              Open (auth)/login Screen &rarr;
            </Text>
          </Pressable>
        </Link>
      </Animated.View>
    </ScrollView>
  );
}
