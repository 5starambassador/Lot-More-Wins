import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { partnerLoginOtpRequestSchema } from '@lotmorewins/validation';
import type { PartnerLoginOtpResponse } from '@lotmorewins/types';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import { Button, Field, FullScreenLoader, Notice, OtpInput, Screen, TopBar, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import { useAuthStore } from '../../store/auth-store';
import { useOnboardingStore } from '../../store/onboarding-store';
import { describeError } from '../../lib/queries';
import { space } from '../../theme/tokens';

const RESEND_AFTER_SEC = 60;

/**
 * Partner sign-in with a one-time code only (no password): the registered mobile number or
 * email, then the 6-digit code. The code goes out by email or WhatsApp as set by the Super Admin
 * in Settings; the partner never picks the channel. The session then lasts until they sign out.
 */
export default function PartnerLoginScreen() {
  const router = useRouter();
  const { partner, isLoading, loadStoredSession, setSession } = useAuthStore();
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  /** Set once a code has been sent: the screen then asks for the code. */
  const [sent, setSent] = useState<PartnerLoginOtpResponse | null>(null);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!partner) loadStoredSession();
  }, [partner, loadStoredSession]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Already signed in on this device: go straight to Home.
  if (partner) return <Redirect href="/dashboard" />;
  if (isLoading) return <FullScreenLoader />;

  const requestCode = async () => {
    setError(null);
    const parsed = partnerLoginOtpRequestSchema.safeParse({ identifier });
    if (!parsed.success) {
      setIdentifierError(parsed.error.issues[0]?.message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setIdentifierError(undefined);
    setSubmitting(true);
    try {
      const res = await apiClient.requestPartnerLoginOtp({ identifier });
      setSent(res.data);
      setOtp('');
      setCountdown(RESEND_AFTER_SEC);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (code = otp) => {
    if (code.length !== 6) {
      setError('Please enter all 6 digits of your code');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.partnerLogin({ identifier, otp: code });
      await setSession(res.data.partner, res.data.qrCodes, res.data.token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/dashboard');
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  const changeIdentifier = () => {
    setSent(null);
    setOtp('');
    setError(null);
  };

  const channelLabel = sent?.mode === 'whatsapp' ? 'WhatsApp' : 'email';

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          {sent ? (
            <Button label="Sign in" onPress={() => verifyCode()} loading={submitting} disabled={otp.length !== 6} />
          ) : (
            <Button label="Send code" onPress={requestCode} loading={submitting} />
          )}
          <View style={styles.row}>
            <Txt variant="small" tone="muted">
              New to Lot More Wins?{' '}
            </Txt>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                resetOnboarding();
                router.replace('/onboarding/details');
              }}
            >
              <Txt variant="smallMedium" tone="gold">
                Become a partner
              </Txt>
            </Pressable>
          </View>
        </View>
      }
    >
      <TopBar showLogo={false} />
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        <BrandLogo size={88} />
        <Txt variant="title" style={styles.title}>
          {sent ? 'Enter your code' : 'Welcome back'}
        </Txt>
        <Txt variant="body" tone="secondary" style={styles.subtitle}>
          {sent
            ? `We sent a 6-digit code by ${channelLabel} to ${sent.destination}.`
            : 'Sign in with the email you registered with. We’ll send you a one-time code.'}
        </Txt>

        {error && <Notice tone="error" message={error} />}

        {sent ? (
          <>
            <OtpInput value={otp} onChange={setOtp} onComplete={verifyCode} />
            <View style={[styles.row, styles.resend]}>
              <Txt variant="small" tone="muted">
                Didn’t get it?{' '}
              </Txt>
              {countdown > 0 ? (
                <Txt variant="smallMedium" tone="muted">{`Resend in 0:${String(countdown).padStart(2, '0')}`}</Txt>
              ) : (
                <Pressable accessibilityRole="button" onPress={requestCode} disabled={submitting} hitSlop={8}>
                  <Txt variant="smallMedium" tone="gold">
                    Resend code
                  </Txt>
                </Pressable>
              )}
            </View>
            <Pressable accessibilityRole="button" onPress={changeIdentifier} hitSlop={8} style={styles.change}>
              <Txt variant="smallMedium" tone="gold">
                Use a different mobile number or email
              </Txt>
            </Pressable>
          </>
        ) : (
          <Field
            label="Email"
            value={identifier}
            onChangeText={(v) => {
              setIdentifier(v);
              if (identifierError) setIdentifierError(undefined);
            }}
            placeholder="partner@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="username"
            returnKeyType="go"
            onSubmitEditing={requestCode}
            error={identifierError}
          />
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.lg },
  title: { marginTop: space.xl },
  subtitle: { marginTop: space.xs, marginBottom: space.xxl },
  footer: { gap: space.md },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resend: { justifyContent: 'flex-start', marginTop: space.xxl },
  change: { marginTop: space.lg },
});
