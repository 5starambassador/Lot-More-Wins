import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Divider, FullScreenLoader, Screen, Txt } from '../components/ui';
import { BrandLogo, Wordmark } from '../components/brand/Brand';
import { useAuthStore } from '../store/auth-store';
import { useOnboardingStore } from '../store/onboarding-store';
import { colors, space } from '../theme/tokens';

const BENEFITS = [
  { icon: 'qr-code-outline' as const, title: 'A permanent discount QR', body: 'Show it at any participating outlet for your partner discount.' },
  { icon: 'people-outline' as const, title: 'A referral QR of your own', body: 'Share it with family and friends and earn points on their visits.' },
  { icon: 'diamond-outline' as const, title: 'Points that add up', body: 'Every eligible bill builds your rewards balance.' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { partner, isLoading, loadStoredSession } = useAuthStore();
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  useEffect(() => {
    loadStoredSession();
  }, [loadStoredSession]);

  if (isLoading) return <FullScreenLoader />;
  if (partner) return <Redirect href="/dashboard" />;

  return (
    <Screen
      footer={
        <Animated.View entering={FadeIn.delay(350).duration(400)} style={styles.actions}>
          <Button
            label="Become a partner"
            onPress={() => {
              resetOnboarding();
              router.push('/onboarding/association');
            }}
          />
          <Button label="I already have an account" variant="ghost" onPress={() => router.push('/(auth)/login')} />
        </Animated.View>
      }
    >
      <Animated.View entering={FadeIn.duration(500)} style={styles.brand}>
        <BrandLogo size={64} />
        <Wordmark size="sm" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.hero}>
        <Txt variant="overline" tone="gold">
          Partner programme
        </Txt>
        <Txt variant="display" style={styles.headline}>
          Rewards that{'\n'}recognise you.
        </Txt>
        <Txt variant="body" tone="secondary">
          Join in a few minutes. Your discount and referral codes are issued the moment you register.
        </Txt>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(500)}>
        {BENEFITS.map((b, i) => (
          <View key={b.title}>
            {i > 0 && <Divider inset={52} />}
            <View style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={20} color={colors.gold} />
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyMedium">{b.title}</Txt>
                <Txt variant="small" tone="secondary">
                  {b.body}
                </Txt>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl },
  hero: { marginTop: space.xxxl, marginBottom: space.xxl, gap: space.sm },
  headline: { marginBottom: space.xs },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: space.xs },
});
