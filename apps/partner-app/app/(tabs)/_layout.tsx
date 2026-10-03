import { useEffect } from 'react';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { FullScreenLoader } from '../../components/ui';
import { registerForPush, subscribeToPush } from '../../lib/push';
import { useAuthStore } from '../../store/auth-store';
import { colors, fonts } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'dashboard', title: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'wallet', title: 'Wallet', icon: 'wallet-outline', active: 'wallet' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', active: 'person' },
];

const TAB_BAR_HEIGHT = 64;

/** Signed-in shell. Without a stored partner session the user is sent to the login page. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { partner, isLoading, loadStoredSession } = useAuthStore();
  const partnerId = partner?.id;

  useEffect(() => {
    if (!partner) loadStoredSession();
  }, [partner, loadStoredSession]);

  // Push notifications for wallet activity: register this device once signed in, refresh
  // the wallet when one arrives, and open the Notifications page when one is tapped.
  useEffect(() => {
    if (!partnerId) return;
    registerForPush();
    return subscribeToPush(
      () => {
        queryClient.invalidateQueries({ queryKey: ['home'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      },
      () => router.push('/notifications')
    );
  }, [partnerId, queryClient, router]);

  if (!partner && isLoading) return <FullScreenLoader />;
  if (!partner) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.canvasDeep,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          paddingTop: 6,
          // The default 49pt bar clips the Poppins labels; size it for icon + label + system inset.
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? t.active : t.icon} size={22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
