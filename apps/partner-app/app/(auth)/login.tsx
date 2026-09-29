import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function PartnerLoginScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-slate-950 px-6 justify-center items-center">
      <View className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <Text className="text-xl font-bold text-white text-center">
          Partner Sign In
        </Text>
        <Text className="text-xs text-slate-400 text-center leading-relaxed">
          Phase 1 Navigation Placeholder.
          OTP authentication & onboarding will be integrated in Phase 2.
        </Text>

        <Pressable
          onPress={() => router.back()}
          className="mt-4 p-3 rounded-xl bg-slate-800 active:bg-slate-700 items-center"
        >
          <Text className="text-xs font-semibold text-slate-300">
            &larr; Back to Overview
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
