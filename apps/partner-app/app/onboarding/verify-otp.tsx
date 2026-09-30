import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import apiClient from '../../lib/api';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { Button, Notice, Txt } from '../../components/ui';
import { colors, fonts, space } from '../../theme/tokens';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { mobile, email, name, messagingMode, setOtp: saveOtpToStore } = useOnboardingStore();

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const inputRef = useRef<TextInput>(null);

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
      const res = await apiClient.verifyOtp({
        identifier: mobile,
        otp: code,
      });

      if (res.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        saveOtpToStore(code);
        router.push('/onboarding/set-password');
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMsg(res.message || 'Verification failed. Please check OTP.');
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.sendOtp({
        identifier: mobile,
        name,
        email,
      });

      if (res.success) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCountdown(60);
      } else {
        setErrorMsg(res.message || 'Failed to resend code');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error resending code');
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    if (cleaned.length === 6) {
      handleVerify(cleaned);
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

      <Pressable accessibilityLabel="Verification code" onPress={() => inputRef.current?.focus()} style={styles.cells}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const digit = otp[index] || '';
          const isCurrent = otp.length === index;
          return (
            <View
              key={index}
              style={[styles.cell, { borderBottomColor: digit ? colors.goldMuted : isCurrent ? colors.gold : colors.line }]}
            >
              <Txt style={styles.digit}>{digit}</Txt>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={handleOtpChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          autoFocus
          caretHidden
          style={styles.hiddenInput}
        />
      </Pressable>

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
  cells: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  cell: { width: 44, height: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  digit: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 36, color: colors.text },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  resend: { flexDirection: 'row', alignItems: 'center', marginTop: space.xxl },
});
