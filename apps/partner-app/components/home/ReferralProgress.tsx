import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { formatPercent } from '../../lib/format';
import { colors, fonts, goldFrame, radius, space } from '../../theme/tokens';
import { Txt } from '../ui';

/** A still frame of Gift.gif with its backdrop removed. */
const GIFT_BOX = require('../../assets/gift-box.png');
const GIFT_SIZE = 76;
const BAR_HEIGHT = 16;
const SHINE_WIDTH = 46;

// Gradients fall back to the flat `backgroundColor` beside them where they are not supported.
const CARD_FILL = {
  backgroundColor: '#5A0404',
  experimental_backgroundImage: 'linear-gradient(160deg, #8C0A0A 0%, #5A0404 55%, #430202 100%)',
} as ViewStyle;
const GOLD_BAR = {
  backgroundColor: colors.gold,
  experimental_backgroundImage: 'linear-gradient(90deg, #B8922F 0%, #F5C542 35%, #FFEFB8 60%, #F5C542 80%, #FFDD75 100%)',
} as ViewStyle;

/** Where the glitter sits on the frame, as fractions of the card's width and height. */
const SPARKLES = [
  { x: 0.3, y: 0, size: 10, delay: 0 },
  { x: 0.58, y: 0, size: 7, delay: 900 },
  { x: 0.86, y: 0, size: 12, delay: 400 },
  { x: 1, y: 0.4, size: 8, delay: 1300 },
  { x: 0.94, y: 1, size: 10, delay: 700 },
  { x: 0.62, y: 1, size: 7, delay: 1700 },
  { x: 0.28, y: 1, size: 11, delay: 200 },
  { x: 0, y: 0.72, size: 8, delay: 1100 },
];

/** One glint on the gold frame: fades and swells in, then out, on its own beat. */
function Sparkle({ x, y, size, delay, width, height }: (typeof SPARKLES)[number] & { width: number; height: number }) {
  const twinkle = useSharedValue(0);
  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 600 })
        ),
        -1
      )
    );
  }, [delay, twinkle]);
  const style = useAnimatedStyle(() => ({
    opacity: twinkle.value,
    transform: [{ scale: 0.4 + twinkle.value * 0.9 }, { rotate: `${twinkle.value * 45}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, { left: x * width - size / 2, top: y * height - size / 2 }, style]}>
      <Ionicons name="sparkles" size={size} color="#FFF6D6" />
    </Animated.View>
  );
}

/**
 * Successful referrals (bills closed with the partner's referral QR) out of the goal, on a
 * glittering gold-framed card with the gift box peeking over its top-left corner.
 * Reaching the goal unlocks a special discount on the partner's next own purchase; using it
 * takes the bar back to the start.
 */
export function ReferralProgress({
  successful,
  goal,
  rewardAvailable,
  rewardDiscount,
  loading,
  onUseReward,
}: {
  successful: number;
  goal: number;
  rewardAvailable: boolean;
  /** Undefined until the programme settings have loaded. */
  rewardDiscount: number | undefined;
  loading: boolean;
  onUseReward: () => void;
}) {
  const [card, setCard] = useState({ width: 0, height: 0 });
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = Math.min(1, goal > 0 ? successful / goal : 0);
  const fillWidth = trackWidth * ratio;
  const discount = rewardDiscount ? formatPercent(rewardDiscount) : null;
  const shown = Math.min(successful, goal);

  const fill = useAnimatedStyle(() => ({ width: withTiming(fillWidth, { duration: 800, easing: Easing.out(Easing.cubic) }) }));

  // A band of light sweeps along the filled part of the bar, then rests before the next pass.
  const sweep = useSharedValue(0);
  // The gift rocks gently so the card feels alive.
  const rock = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1300 }), withTiming(0, { duration: 0 })),
      -1
    );
    rock.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [sweep, rock]);
  const shine = useAnimatedStyle(() => ({
    transform: [{ translateX: -SHINE_WIDTH + sweep.value * (fillWidth + SHINE_WIDTH * 2) }, { skewX: '-20deg' }],
  }));
  const gift = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-18 + rock.value * 5}deg` }, { translateY: -rock.value * 3 }],
  }));

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${shown} of ${goal} successful referrals${rewardAvailable ? '. Special discount unlocked' : ''}`}
    >
      {/* The gold frame is the gradient showing around the inset card. */}
      <View style={[styles.frame, goldFrame]} onLayout={(e) => setCard(e.nativeEvent.layout)}>
        <View style={[styles.card, CARD_FILL]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Txt variant="overline" tone="gold">
                Refer &amp; win
              </Txt>
              <Txt variant="bodyMedium">Successful referrals</Txt>
            </View>
            <View style={styles.count}>
              <Txt style={styles.countFigure}>{loading ? '—' : shown}</Txt>
              <Txt style={styles.countGoal}>/ {goal}</Txt>
            </View>
          </View>

          <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.fill, GOLD_BAR, fill]}>
              <View pointerEvents="none" style={styles.gloss} />
              {ratio > 0 ? <Animated.View pointerEvents="none" style={[styles.shine, shine]} /> : null}
            </Animated.View>
          </View>

          {rewardAvailable ? (
            <Pressable accessibilityRole="button" onPress={onUseReward} style={({ pressed }) => [styles.reward, pressed && { opacity: 0.8 }]}>
              <Ionicons name="trophy" size={18} color={colors.goldBright} />
              <Txt variant="small" style={styles.flex}>
                <Txt variant="smallMedium" tone="gold">
                  {discount ? `${discount} special discount unlocked! ` : 'Special discount unlocked! '}
                </Txt>
                Show your Personal Discount QR on your next purchase to use it. Your progress starts again from 0 after that.
              </Txt>
              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </Pressable>
          ) : (
            <Txt variant="caption" tone="secondary">
              {discount
                ? `Every ${goal} customers who close a bill with your referral QR unlock a ${discount} special discount on your next purchase.`
                : 'Counts each time a customer closes a bill with your referral QR.'}
            </Txt>
          )}
        </View>
      </View>

      {card.width > 0 ? SPARKLES.map((s, i) => <Sparkle key={i} {...s} width={card.width} height={card.height} />) : null}

      <Animated.View pointerEvents="none" style={[styles.gift, gift]}>
        <Image source={GIFT_BOX} style={styles.giftImage} contentFit="contain" accessibilityLabel="Gift box" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Room above the card for the gift that overhangs its top-left corner.
  wrap: { marginTop: space.xl + space.xs },
  frame: {
    padding: 2,
    borderRadius: radius.xl,
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  card: { borderRadius: radius.xl - 2, padding: space.md, gap: space.sm, overflow: 'hidden' },
  // Text starts to the right of the gift.
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: GIFT_SIZE - space.md },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  countFigure: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, color: colors.goldBright },
  countGoal: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: colors.goldLine,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: BAR_HEIGHT / 2, overflow: 'hidden' },
  gloss: { position: 'absolute', top: 1, left: 4, right: 4, height: BAR_HEIGHT / 3, borderRadius: BAR_HEIGHT / 3, backgroundColor: 'rgba(255, 255, 255, 0.35)' },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SHINE_WIDTH, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sparkle: { position: 'absolute' },
  gift: { position: 'absolute', top: -GIFT_SIZE * 0.42, left: -space.xs, width: GIFT_SIZE, height: GIFT_SIZE },
  giftImage: { width: GIFT_SIZE, height: GIFT_SIZE },
});
