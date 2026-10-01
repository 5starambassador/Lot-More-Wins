import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { partnerLoginSchema } from '@lotmorewins/validation';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import { Button, Field, FullScreenLoader, Notice, Screen, TopBar, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import { useAuthStore } from '../../store/auth-store';
import { useOnboardingStore } from '../../store/onboarding-store';
import { describeError } from '../../lib/queries';
import { colors, space } from '../../theme/tokens';

/** Partner sign-in with the registered mobile number or email and password. */
export default function PartnerLoginScreen() {
  const router = useRouter();
  const { partner, isLoading, loadStoredSession, setSession } = useAuthStore();
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<{ identifier?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!partner) loadStoredSession();
  }, [partner, loadStoredSession]);

  // Already signed in on this device: go straight to Home.
  if (partner) return <Redirect href="/dashboard" />;
  if (isLoading) return <FullScreenLoader />;

  const onSubmit = async () => {
    setError(null);
    const parsed = partnerLoginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const errs: { identifier?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'password' ? 'password' : 'identifier';
        errs[key] ??= issue.message;
      }
      setFieldError(errs);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setFieldError({});
    setSubmitting(true);
    try {
      const res = await apiClient.partnerLogin({ identifier, password });
      await setSession(res.data.partner, res.data.qrCodes, res.data.token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/dashboard');
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      onPress={() => setShowPassword((v) => !v)}
      hitSlop={8}
      style={styles.eye}
    >
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button label="Sign in" onPress={onSubmit} loading={submitting} />
          <View style={styles.registerRow}>
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
        <BrandLogo size={72} />
        <Txt variant="title" style={styles.title}>
          Welcome back
        </Txt>
        <Txt variant="body" tone="secondary" style={styles.subtitle}>
          Sign in with the mobile number or email you registered with.
        </Txt>

        {error && <Notice tone="error" message={error} />}

        <Field
          label="Mobile number or email"
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            if (fieldError.identifier) setFieldError((e) => ({ ...e, identifier: undefined }));
          }}
          placeholder="98765 43210 or name@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={fieldError.identifier}
        />
        <Field
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (fieldError.password) setFieldError((e) => ({ ...e, password: undefined }));
          }}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          error={fieldError.password}
          accessory={toggle}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.lg },
  title: { marginTop: space.xl },
  subtitle: { marginTop: space.xs, marginBottom: space.xxl },
  eye: { paddingHorizontal: space.md, height: 54, justifyContent: 'center' },
  footer: { gap: space.md },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
