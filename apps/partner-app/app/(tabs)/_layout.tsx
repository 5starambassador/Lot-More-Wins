import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenLoader } from '../../components/ui';
import { useAuthStore } from '../../store/auth-store';
import { colors, fonts } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'dashboard', title: 'Home', icon: 'home-outline', active: 'home' },
  { name: 'outlets', title: 'Outlets', icon: 'storefront-outline', active: 'storefront' },
  { name: 'rewards', title: 'Rewards', icon: 'diamond-outline', active: 'diamond' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', active: 'person' },
];

/** Signed-in shell. Without a stored partner session the user is sent back to the welcome screen. */
export default function TabsLayout() {
  const { partner, isLoading, loadStoredSession } = useAuthStore();

  useEffect(() => {
    if (!partner) loadStoredSession();
  }, [partner, loadStoredSession]);

  if (!partner && isLoading) return <FullScreenLoader />;
  if (!partner) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          paddingTop: 6,
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
