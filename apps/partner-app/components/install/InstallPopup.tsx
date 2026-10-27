import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInstallPrompt } from '../../lib/install';
import { colors, radius, space } from '../../theme/tokens';
import { BrandLogo } from '../brand/Brand';
import { Button, Txt } from '../ui';

/**
 * Small "Install the app" card in the top-right corner of Welcome and Home, in the web version
 * only, while it is open in a browser tab. Renders nothing in the native app, when already
 * installed, or after it was closed (see lib/install.ts).
 * Place it after the screen's content so it sits above it.
 */
export function InstallPopup({ hidden = false }: { hidden?: boolean }) {
  // The native app never offers this; the check also keeps the hook out of native renders.
  if (Platform.OS !== 'web') return null;
  return <WebInstallPopup hidden={hidden} />;
}

function WebInstallPopup({ hidden }: { hidden: boolean }) {
  const insets = useSafeAreaInsets();
  const { device, visible, install, dismiss } = useInstallPrompt();
  if (!visible || hidden) return null;

  const message =
    device === 'ios' ? 'Add it to your home screen from Safari in a few taps.' : 'Open it from your home screen, like any other app.';

  return (
    <Animated.View
      entering={FadeInUp.delay(600).duration(350)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + space.xs }]}
      pointerEvents="box-none"
    >
      <View style={styles.card} accessibilityRole="alert" accessibilityLabel="Install the Lot More Wins Partner App">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={dismiss}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>

        <View style={styles.row}>
          <BrandLogo size={40} />
          <View style={styles.text}>
            <Txt variant="smallMedium">Install the Partner App</Txt>
            <Txt variant="caption" tone="secondary">
              {message}
            </Txt>
          </View>
        </View>

        <Button
          label={device === 'ios' ? 'How to install' : 'Install'}
          compact
          icon={<Ionicons name={device === 'ios' ? 'share-outline' : 'download-outline'} size={16} color={colors.textOnGold} />}
          onPress={() => void install()}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: space.sm, left: space.sm, alignItems: 'flex-end', zIndex: 50 },
  card: {
    width: '100%',
    maxWidth: 300,
    padding: space.sm,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xl },
  text: { flex: 1 },
  close: {
    position: 'absolute',
    top: space.xxs,
    right: space.xxs,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
