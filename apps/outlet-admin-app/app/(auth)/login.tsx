import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { loginSchema } from '@lotmorewins/validation';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Field, Notice, Screen, Txt } from '../../components/ui';
import { BrandLogo, Wordmark } from '../../components/brand/Brand';
import apiClient, { describeError } from '../../lib/api';
import { useSession } from '../../store/session-store';
import { colors, space } from '../../theme/tokens';

/** Outlet Admin sign-in, laid out like the partner app's sign-in. */
export default function OutletAdminLoginScreen() {
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'password' ? 'password' : 'email';
        errs[key] ??= issue.message;
      }
      setFieldError(errs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setFieldError({});
    setSubmitting(true);
    try {
      const res = await apiClient.outletLogin(parsed.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await signIn(res.data); // the auth gate routes to the Scan tab
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err, 'Unable to sign in'));
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
          <Txt variant="caption" tone="muted" align="center">
            Outlet credentials are issued by the Lot More Wins Super Admin.
          </Txt>
        </View>
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        <BrandLogo size={72} />
        <View style={styles.brandRow}>
          <Wordmark size="sm" />
          <Badge label="Outlet Admin" />
        </View>
        <Txt variant="title" style={styles.title}>
          Sign in to your outlet
        </Txt>
        <Txt variant="body" tone="secondary" style={styles.subtitle}>
          Scan partner codes, apply discounts and complete bills at your counter.
        </Txt>

        {error && <Notice tone="error" message={error} />}

        <Field
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (fieldError.email) setFieldError((e) => ({ ...e, email: undefined }));
          }}
          placeholder="outlet@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={fieldError.email}
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
  body: { paddingHorizontal: space.xl, paddingTop: space.xxxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  title: { marginTop: space.lg },
  subtitle: { marginTop: space.xs, marginBottom: space.xxl },
  eye: { paddingHorizontal: space.md, height: 54, justifyContent: 'center' },
  footer: { gap: space.md },
});
