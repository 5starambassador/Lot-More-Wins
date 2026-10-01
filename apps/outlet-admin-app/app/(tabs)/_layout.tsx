import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Three primary areas; Scan is the home tab. Styled like the partner app's tab bar. */
const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Scan', icon: 'scan-outline', active: 'scan' },
  { name: 'history', title: 'History', icon: 'receipt-outline', active: 'receipt' },
  { name: 'profile', title: 'Outlet', icon: 'storefront-outline', active: 'storefront' },
];

const TAB_BAR_HEIGHT = 64;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="index"
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
