import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import { useAuthStore } from '../../store/auth-store';
import apiClient from '../../lib/api';
import { describeError } from '../../lib/queries';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { Button, Field, Notice, Txt } from '../../components/ui';
import { colors, space } from '../../theme/tokens';

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.req}>
      <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={met ? colors.success : colors.textMuted} />
      <Txt variant="small" tone={met ? 'secondary' : 'muted'}>
        {label}
      </Txt>
    </View>
  );
}

/** Step 5: password and confirmation, then the account is created and Home opens with the welcome gift. */
export default function SetPasswordScreen() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { setSession, setWelcome } = useAuthStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: onboarding.name,
        mobile: onboarding.mobile,
        email: onboarding.email,
        city: onboarding.city,
        state: onboarding.state,
        pincode: onboarding.pincode,
        dateOfBirth: onboarding.dateOfBirth,
        password,
        confirmPassword,
        otp: onboarding.otp,
      };

      const res = await apiClient.registerPartner(payload);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Home opens the welcome gift once. Points earned as a customer before registering
      // are claimed during onboarding and mentioned on the card.
      setWelcome({ claimedPoints: res.data.claimedPoints ?? 0 });
      // Store permanent session and permanent QR codes in SecureStore + Zustand
      await setSession(res.data.partner, res.data.qrCodes, res.data.token);

      router.dismissAll();
      router.replace('/dashboard');
      onboarding.reset();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(describeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
      onPress={() => setShowPassword((p) => !p)}
      hitSlop={8}
      style={styles.eye}
    >
      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <OnboardingShell
      step="password"
      title="Secure your account"
      subtitle="Choose a password. Your two permanent QR codes are issued as soon as you finish."
      footer={<Button label="Create account" onPress={handleSubmit} loading={isSubmitting} />}
    >
      {errorMsg && <Notice tone="error" message={errorMsg} />}

      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        accessory={toggle}
      />
      <Field
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter password"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <View style={styles.reqs}>
        <Requirement met={password.length >= 6} label="At least 6 characters" />
        <Requirement met={password.length > 0 && password === confirmPassword} label="Both passwords match" />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  eye: { paddingHorizontal: space.md, height: 54, justifyContent: 'center' },
  reqs: { gap: space.xs, marginTop: -space.xs },
  req: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
