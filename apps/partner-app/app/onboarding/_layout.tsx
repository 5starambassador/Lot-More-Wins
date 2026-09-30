import { Stack } from 'expo-router';
import { colors } from '../../theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
      <Stack.Screen name="association" />
      <Stack.Screen name="achariya-role" />
      <Stack.Screen name="role-form" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="set-password" />
      <Stack.Screen name="success" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
