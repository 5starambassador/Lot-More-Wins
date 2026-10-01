import { Stack } from 'expo-router';
import { colors } from '../../theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
      <Stack.Screen name="details" />
      <Stack.Screen name="location" />
      <Stack.Screen name="birthday" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="set-password" />
    </Stack>
  );
}
