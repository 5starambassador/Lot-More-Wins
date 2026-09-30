import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Divider, Screen, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import { useAuthStore } from '../../store/auth-store';
import { firstName, formatPoints, tierLabel } from '../../lib/format';
import { colors, space } from '../../theme/tokens';

/** Confirmation after registration: the account and both permanent QR codes now exist. */
export default function OnboardingSuccessScreen() {
  const router = useRouter();
  const { partner, qrCodes } = useAuthStore();
  const claimed = Number(useLocalSearchParams<{ claimed?: string }>().claimed ?? 0);
  const scale = useSharedValue(0.6);
  const seal = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 140 }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [scale]);

  if (!partner) return <Redirect href="/" />;

  return (
    <Screen footer={<Button label="View my QR codes" onPress={() => router.replace('/dashboard')} />}>
      <View style={styles.brandRow}>
        <BrandLogo size={40} />
      </View>
      <View style={styles.center}>
        <Animated.View style={[styles.sealOuter, seal]}>
          <View style={styles.sealInner}>
            <Ionicons name="checkmark" size={40} color={colors.textOnGold} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(450)} style={styles.copy}>
          <Txt variant="overline" tone="gold" align="center">
            Registration complete
          </Txt>
          <Txt variant="title" align="center">
            Welcome, {firstName(partner.name)}
          </Txt>
          <Txt variant="body" tone="secondary" align="center">
            Your partner account is ready and your permanent codes have been issued.
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(450).duration(450)} style={styles.summary}>
          <View style={styles.summaryRow}>
            <Txt variant="small" tone="muted">
              Membership
            </Txt>
            <Badge label={tierLabel(partner)} />
          </View>
          <Divider />
          <View style={styles.summaryRow}>
            <Txt variant="small" tone="muted">
              Partner code
            </Txt>
            <Txt variant="mono">{partner.partnerCode}</Txt>
          </View>
          <Divider />
          <View style={styles.summaryRow}>
            <Txt variant="small" tone="muted">
              Permanent QR codes
            </Txt>
            <Txt variant="smallMedium">{qrCodes.length} issued</Txt>
          </View>
          {claimed > 0 && (
            <>
              <Divider />
              <View style={styles.summaryRow}>
                <Txt variant="small" tone="muted">
                  Points from earlier visits
                </Txt>
                <Txt variant="smallMedium" tone="gold">
                  +{formatPoints(claimed)} pts
                </Txt>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: 'center', paddingTop: space.lg },
  center: { flex: 1, justifyContent: 'center', paddingVertical: space.xxl },
  sealOuter: {
    alignSelf: 'center',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealInner: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  copy: { marginTop: space.xxl, gap: space.xs },
  summary: { marginTop: space.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
});
