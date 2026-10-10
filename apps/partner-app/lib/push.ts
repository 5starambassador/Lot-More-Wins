import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import apiClient from './api';

/**
 * Push notifications for wallet activity. Everything here is best-effort: the same
 * notifications are always in the in-app Notifications list, so a device that cannot
 * receive push (simulator, permission denied, web) simply goes without.
 */

const supported = Platform.OS !== 'web';

if (supported) {
  // Show notifications while the app is open too.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let registeredToken: string | null = null;
/** The last tapped notification already handed to `onOpen`, so it is never opened twice. */
let openedNotificationId: string | null = null;

/** Asks for permission and registers this device's Expo push token with the signed-in partner. */
export async function registerForPush(): Promise<void> {
  if (!supported || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Wallet activity',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiClient.registerPushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    registeredToken = token;
  } catch (error) {
    console.warn('Push registration skipped:', error);
  }
}

/** Stops pushing to this device. Call before the session token is cleared. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  try {
    await apiClient.removePushToken(token);
  } catch {
    // Signing out must not depend on the network.
  }
}

/**
 * Runs `onReceive` when a push arrives in the foreground and `onOpen` when one is tapped, with
 * the notification type the server put in the push data (e.g. PURCHASE_POINTS).
 */
export function subscribeToPush(onReceive: () => void, onOpen: (type: string | null) => void): () => void {
  if (!supported) return () => {};
  const open = (response: Notifications.NotificationResponse | null) => {
    const id = response?.notification.request.identifier;
    if (!id || id === openedNotificationId) return;
    openedNotificationId = id;
    const type = response?.notification.request.content.data?.type;
    onOpen(typeof type === 'string' ? type : null);
  };
  const received = Notifications.addNotificationReceivedListener(onReceive);
  const opened = Notifications.addNotificationResponseReceivedListener(open);
  // A tap that launched the app from a closed state arrives before this listener exists.
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  return () => {
    received.remove();
    opened.remove();
  };
}
