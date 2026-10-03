import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { colors, goldFrame, radius, space } from '../../theme/tokens';
import { BrandLogo } from '../brand/Brand';
import { Button, Txt } from '../ui';

/**
 * "New version available" popup on Home, switched on by the Super Admin (Settings → Home popup).
 * Links to the Partner App download page set there.
 */
export function UpdatePopup({ downloadUrl, onClose }: { downloadUrl: string | null | undefined; onClose: () => void }) {
  const install = async () => {
    if (!downloadUrl) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(downloadUrl).catch(() => {});
    onClose();
  };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(250)} style={styles.scrim}>
        <Animated.View entering={ZoomIn.springify().damping(14).delay(80)} style={styles.card} accessibilityViewIsModal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={18} color={colors.textOnGold} />
          </Pressable>

          <View style={styles.badgeRow}>
            <BrandLogo size={72} />
            <View style={[styles.spark, goldFrame]}>
              <View style={styles.sparkFace}>
                <Ionicons name="sparkles" size={14} color={colors.gold} />
              </View>
            </View>
          </View>

          <View style={styles.pill}>
            <Txt variant="overline" tone="gold">
              New version
            </Txt>
          </View>
          <Txt variant="heading" align="center">
            Update available
          </Txt>
          <Txt variant="body" tone="secondary" align="center" style={styles.message}>
            A new updated version of the Partner App is now available. Install the latest version to experience the newly added features.
          </Txt>

          {downloadUrl ? (
            <Button
              label="Install latest version"
              icon={<Ionicons name="download-outline" size={18} color={colors.textOnGold} />}
              onPress={install}
              style={styles.action}
            />
          ) : null}
          <Button label="Maybe later" variant="ghost" onPress={onClose} style={styles.later} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  card: {
    width: 320,
    maxWidth: '100%',
    alignItems: 'center',
    paddingTop: space.xxl,
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    gap: space.xs,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  close: {
    position: 'absolute',
    // Kept inside the card: Android does not deliver touches outside a parent's bounds.
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeRow: { marginBottom: space.sm },
  spark: { position: 'absolute', right: -6, bottom: -4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sparkFace: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  message: { marginTop: space.xxs, marginBottom: space.sm },
  action: { alignSelf: 'stretch' },
  later: { alignSelf: 'stretch' },
});
