import { Pressable, StyleSheet, View } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import apiClient from '../../lib/api';
import { describeError } from '../../lib/queries';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { Button, Notice, OtpInput, Txt } from '../../components/ui';
import { space } from '../../theme/tokens';

/** Step 4: the 6-digit code sent when the partner left the birthday step. */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const { mobile, email, name, messagingMode, setMessagingMode, setOtp: saveOtpToStore } = useOnboardingStore();

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits of your OTP');
      return;
    }
    setErrorMsg(null);
    setIsVerifying(true);

    try {
      await apiClient.verifyOtp({ identifier: mobile, otp: code });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      saveOtpToStore(code);
      router.push('/onboarding/set-password');
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(describeError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.sendOtp({ identifier: mobile, name, email });
      setMessagingMode(res.mode);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCountdown(60);
    } catch (err) {
      setErrorMsg(describeError(err));
    } finally {
      setIsResending(false);
    }
  };

  const channelLabel = messagingMode === 'whatsapp' ? 'WhatsApp' : 'email';
  const destination = messagingMode === 'whatsapp' ? `+91 ${mobile}` : email;

  return (
    <OnboardingShell
      step="verify"
      title="Enter your code"
      subtitle={`We sent a 6-digit code by ${channelLabel} to ${destination}.`}
      footer={
        <Button label="Verify" onPress={() => handleVerify()} loading={isVerifying} disabled={otp.length !== 6} />
      }
    >
      {errorMsg && <Notice tone="error" message={errorMsg} />}

      <View style={styles.cells}>
        <OtpInput value={otp} onChange={setOtp} onComplete={handleVerify} />
      </View>

      <View style={styles.resend}>
        <Txt variant="small" tone="muted">
          Didn’t get it?{' '}
        </Txt>
        {countdown > 0 ? (
          <Txt variant="smallMedium" tone="muted">{`Resend in 0:${String(countdown).padStart(2, '0')}`}</Txt>
        ) : (
          <Pressable accessibilityRole="button" onPress={handleResend} disabled={isResending} hitSlop={8}>
            <Txt variant="smallMedium" tone="gold">
              {isResending ? 'Sending…' : 'Resend code'}
            </Txt>
          </Pressable>
        )}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  cells: { marginTop: space.md },
  resend: { flexDirection: 'row', alignItems: 'center', marginTop: space.xxl },
});
