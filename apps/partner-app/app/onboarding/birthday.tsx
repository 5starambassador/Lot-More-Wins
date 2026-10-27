import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import apiClient from '../../lib/api';
import { dobInputToIso, formatDob, isoToDobInput } from '../../lib/dates';
import { describeError } from '../../lib/queries';
import { useOnboardingStore } from '../../store/onboarding-store';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { GiftAnimation } from '../../components/home/GiftAnimation';
import { Button, DateField, Notice, Txt } from '../../components/ui';
import { colors, fonts, radius, space } from '../../theme/tokens';

const GIFT_SIZE = 168;

/** The looping gift box with a slow gold halo breathing around it and a gift badge. */
function GiftHero() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.45, transform: [{ scale: 0.92 + pulse.value * 0.14 }] }));
  const badge = useAnimatedStyle(() => ({ transform: [{ rotate: `${-8 + pulse.value * 6}deg` }, { scale: 1 + pulse.value * 0.06 }] }));

  return (
    <View style={styles.hero} accessible accessibilityLabel="A special gift on your birthday">
      <Animated.View style={[styles.halo, halo]} />
      <GiftAnimation size={GIFT_SIZE} />
      <Animated.View entering={ZoomIn.delay(350).springify().damping(9)} style={styles.badgeWrap}>
        <Animated.View style={[styles.badge, badge]}>
          <Ionicons name="gift" size={26} color={colors.textOnGold} />
          <Txt style={styles.badgeLabel}>birthday gift</Txt>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Step 3 (optional): date of birth, for birthday perks. No amounts are promised here. */
export default function BirthdayScreen() {
  const router = useRouter();
  const stored = useOnboardingStore();

  const [dob, setDob] = useState(isoToDobInput(stored.dateOfBirth));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'continue' | 'skip' | null>(null);

  const iso = dobInputToIso(dob);

  // Step 4 is the verification code: it is sent as the partner leaves this step.
  const proceed = async (dateOfBirth: string | null, via: 'continue' | 'skip') => {
    setFormError(null);
    setSubmitting(via);
    try {
      const res = await apiClient.sendOtp({ identifier: stored.mobile, name: stored.name, email: stored.email });
      stored.setDateOfBirth(dateOfBirth);
      stored.setMessagingMode(res.mode);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push('/onboarding/verify-otp');
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFormError(describeError(err));
    } finally {
      setSubmitting(null);
    }
  };

  const handleContinue = async () => {
    if (!iso) {
      setFieldError(dob ? 'Please enter a valid date as DD/MM/YYYY' : 'Enter your date of birth, or skip this step');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    proceed(iso, 'continue');
  };

  return (
    <OnboardingShell
      step="birthday"
      hero={<GiftHero />}
      title="We’ve got a gift for your birthday"
      subtitle="Enter your date of birth to get extra perks and special gift discounts on your birthday."
      footer={
        <View style={styles.footer}>
          <Button label="Save my birthday" onPress={handleContinue} loading={submitting === 'continue'} disabled={submitting === 'skip'} />
          <Button
            label="Skip for now"
            variant="ghost"
            onPress={() => proceed(null, 'skip')}
            loading={submitting === 'skip'}
            disabled={submitting === 'continue'}
          />
        </View>
      }
    >
      {formError && <Notice tone="error" message={formError} />}

      <DateField
        label="Date of birth"
        value={dob}
        onChangeText={(v) => {
          setDob(v);
          setFieldError(null);
        }}
        error={fieldError}
        hint="Type it, or tap the calendar to pick a date"
      />

      {iso ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.unlocked}>
          <Ionicons name="sparkles" size={18} color={colors.goldBright} />
          <Txt variant="small" tone="secondary" style={styles.flex}>
            Lovely! Every year on <Txt variant="smallMedium" tone="gold">{formatDob(iso).replace(/ \d{4}$/, '')}</Txt> you get extra perks and a
            special gift discount.
          </Txt>
        </Animated.View>
      ) : (
        <View style={styles.perks}>
          {[
            { icon: 'gift-outline' as const, text: 'Extra perks and special gift discounts on your birthday' },
            { icon: 'lock-closed-outline' as const, text: 'Only used for your birthday gift, never shared' },
            { icon: 'create-outline' as const, text: 'You can add or change it later in your profile' },
          ].map((perk) => (
            <View key={perk.text} style={styles.perk}>
              <Ionicons name={perk.icon} size={16} color={colors.gold} />
              <Txt variant="small" tone="secondary" style={styles.flex}>
                {perk.text}
              </Txt>
            </View>
          ))}
        </View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignSelf: 'center', width: GIFT_SIZE + 70, height: GIFT_SIZE + 44, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  halo: {
    position: 'absolute',
    width: GIFT_SIZE + 36,
    height: GIFT_SIZE + 36,
    borderRadius: (GIFT_SIZE + 36) / 2,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  badgeWrap: { position: 'absolute', top: 6, right: 0 },
  badge: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontFamily: fonts.medium, fontSize: 9, lineHeight: 12, color: colors.textOnGold, letterSpacing: 0.3 },
  footer: { gap: space.xs },
  unlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  perks: { gap: space.sm },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
