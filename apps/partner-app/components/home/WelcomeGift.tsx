import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { formatPercent } from '../../lib/format';
import { useWalletFormat } from '../../lib/wallet-display';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Txt } from '../ui';
import { Confetti } from './Confetti';
import { GiftAnimation } from './GiftAnimation';

const GIFT_SIZE = 200;

/** The box is left to wobble for a beat before it "pops" and releases the card. */
const POP_AT_MS = 1100;

/**
 * Shown once, on the first Home visit after registration: the gift box wobbles, pops with
 * party poppers, and a card springs out of it announcing the first-purchase discount.
 */
export function WelcomeGift({
  firstTimeDiscount,
  claimedPoints,
  onClose,
}: {
  /** From the Super Admin settings; undefined while it loads. */
  firstTimeDiscount: number | undefined;
  claimedPoints: number;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const format = useWalletFormat();
  const [popped, setPopped] = useState(false);

  const pop = useSharedValue(1);
  // The card starts small inside the box and springs up to its place above it.
  const rise = useSharedValue(0);
  const fade = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(
      POP_AT_MS - 160,
      withSequence(withTiming(0.86, { duration: 160 }), withSpring(1.12, { damping: 5, stiffness: 220 }), withSpring(1, { damping: 10 }))
    );
    rise.value = withDelay(POP_AT_MS, withSpring(1, { damping: 11, stiffness: 90, mass: 0.9 }));
    fade.value = withDelay(POP_AT_MS, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    const timer = setTimeout(() => {
      setPopped(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, POP_AT_MS);
    return () => clearTimeout(timer);
  }, [pop, rise, fade]);

  const giftStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - rise.value) * 200 }, { scale: 0.2 + rise.value * 0.8 }, { rotate: `${(1 - rise.value) * -8}deg` }],
  }));

  const discount = firstTimeDiscount && firstTimeDiscount > 0 ? formatPercent(firstTimeDiscount) : null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.stage}>
          <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={18} color={colors.textOnGold} />
            </Pressable>

            <Txt variant="overline" tone="gold" align="center">
              Welcome gift
            </Txt>
            {discount ? <Txt style={styles.figure}>{discount}</Txt> : <Ionicons name="gift" size={44} color={colors.gold} style={styles.giftIcon} />}
            <Txt variant="subheading" align="center" style={styles.message}>
              You have activated your {discount ? `${discount} ` : ''}special Lot More partner discount for your first purchase.
            </Txt>
            <Txt variant="small" tone="secondary" align="center">
              Show your Personal Discount QR at any outlet to use it.
            </Txt>
            {claimedPoints > 0 ? (
              <View style={styles.claimed}>
                <Ionicons name="diamond-outline" size={14} color={colors.gold} />
                <Txt variant="caption" tone="secondary">
                  +{format.amount(claimedPoints)}
                  {format.inRupees ? ' in rewards' : ' points'} from your earlier visits {format.inRupees ? 'is' : 'are'} in your wallet
                </Txt>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View entering={ZoomIn.duration(350)} style={styles.gift}>
            <Animated.View style={giftStyle}>
              <GiftAnimation size={GIFT_SIZE} />
            </Animated.View>
          </Animated.View>
        </View>

        {popped ? <Confetti centerY={height / 2 + 70} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', paddingHorizontal: space.xl },
  gift: { marginTop: space.lg },
  card: {
    width: 300,
    maxWidth: '100%',
    alignItems: 'center',
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    gap: space.xs,
    // Drawn above the gift so it reads as coming out of the box.
    zIndex: 2,
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
  },
  figure: { fontFamily: fonts.bold, fontSize: 56, lineHeight: 64, letterSpacing: -1.5, color: colors.gold },
  giftIcon: { marginVertical: space.xs },
  message: { marginBottom: space.xxs },
  claimed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});
