import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

/**
 * Safe wrapper around expo-haptics. Haptics are unavailable on web (and can fail on
 * devices without a vibration motor), so every call is a no-op there instead of throwing.
 */

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

const supported = Platform.OS !== 'web';

async function run(fn: () => Promise<void>): Promise<void> {
  if (!supported) return;
  try {
    await fn();
  } catch {
    // Haptic feedback is best-effort; never let it break a user action.
  }
}

export function impactAsync(style?: ExpoHaptics.ImpactFeedbackStyle): Promise<void> {
  return run(() => ExpoHaptics.impactAsync(style));
}

export function notificationAsync(type?: ExpoHaptics.NotificationFeedbackType): Promise<void> {
  return run(() => ExpoHaptics.notificationAsync(type));
}

export function selectionAsync(): Promise<void> {
  return run(() => ExpoHaptics.selectionAsync());
}
