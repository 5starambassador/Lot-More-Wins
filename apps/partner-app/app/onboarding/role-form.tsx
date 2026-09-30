import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import apiClient from '../../lib/api';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { Button, Field, Notice, SectionLabel, Txt } from '../../components/ui';
import { colors, radius, space } from '../../theme/tokens';

export default function RoleFormScreen() {
  const router = useRouter();
  const {
    isAchariyaAssociated,
    role,
    name: storedName,
    mobile: storedMobile,
    email: storedEmail,
    employeeId: storedEmpId,
    admissionNumber: storedAdmNo,
    setFormDetails,
    setOtpInfo,
  } = useOnboardingStore();

  const [name, setName] = useState(storedName || '');
  const [mobile, setMobile] = useState(storedMobile || '');
  const [email, setEmail] = useState(storedEmail || '');
  const [employeeId, setEmployeeId] = useState(storedEmpId || '');
  const [admissionNumber, setAdmissionNumber] = useState(storedAdmNo || '');

  // Institutional Verification State
  const [isVerifyingId, setIsVerifyingId] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [verifiedDetails, setVerifiedDetails] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isStaffOrTeacher = isAchariyaAssociated && (role === 'STAFF' || role === 'TEACHER');
  const isParent = isAchariyaAssociated && role === 'PARENT';

  // Handle live Employee ID verification
  const handleVerifyEmployee = async () => {
    if (!employeeId.trim()) {
      setIdError('Please enter your Employee ID');
      return;
    }
    setIdError(null);
    setIsVerifyingId(true);
    try {
      const res = await apiClient.validateEmployee({
        employeeId: employeeId.trim(),
        role: role as 'STAFF' | 'TEACHER',
      });

      if (res.success && res.data) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIdVerified(true);
        setVerifiedDetails(`${res.data.name} (${res.data.department || res.data.role})`);
        if (!name) setName(res.data.name);
        if (res.data.email && !email) setEmail(res.data.email);
        if (res.data.phone && !mobile) setMobile(res.data.phone);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIdVerified(false);
        setIdError(res.message || 'Employee ID not found');
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIdVerified(false);
      setIdError(err.message || 'Verification failed. Please check Employee ID.');
    } finally {
      setIsVerifyingId(false);
    }
  };

  // Handle live Admission Number verification
  const handleVerifyAdmission = async () => {
    if (!admissionNumber.trim()) {
      setIdError("Please enter your Child's Admission Number");
      return;
    }
    setIdError(null);
    setIsVerifyingId(true);
    try {
      const res = await apiClient.validateAdmission({
        admissionNumber: admissionNumber.trim(),
      });

      if (res.success && res.data) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIdVerified(true);
        setVerifiedDetails(`Student: ${res.data.studentName} (${res.data.grade || 'Enrolled'})`);
        if (res.data.parentName && !name) setName(res.data.parentName);
        if (res.data.parentEmail && !email) setEmail(res.data.parentEmail);
        if (res.data.parentPhone && !mobile) setMobile(res.data.parentPhone);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIdVerified(false);
        setIdError(res.message || 'Admission Number not found');
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIdVerified(false);
      setIdError(err.message || 'Verification failed. Please check Admission Number.');
    } finally {
      setIsVerifyingId(false);
    }
  };

  // Validate form fields and proceed to OTP
  const handleContinue = async () => {
    setFormError(null);

    // 1. Mandatory Institutional ID verification check
    if (isStaffOrTeacher && !idVerified) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFormError('Please verify your Employee ID before continuing');
      return;
    }

    if (isParent && !idVerified) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFormError("Please verify your Child's Admission Number before continuing");
      return;
    }

    // 2. Validate common fields
    if (!name.trim() || name.trim().length < 2) {
      setFormError('Please enter your full name (minimum 2 characters)');
      return;
    }

    const cleanMobile = mobile.trim();
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setFormError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('Please enter a valid email address');
      return;
    }

    // 3. Save to onboarding store
    setFormDetails({
      name: name.trim(),
      mobile: cleanMobile,
      email: cleanEmail,
      employeeId: isStaffOrTeacher ? employeeId.trim().toUpperCase() : undefined,
      admissionNumber: isParent ? admissionNumber.trim().toUpperCase() : undefined,
      verifiedIdentityTitle: verifiedDetails,
    });

    // 4. Request OTP from server
    setIsSubmitting(true);
    try {
      const res = await apiClient.sendOtp({
        identifier: cleanMobile,
        name: name.trim(),
        email: cleanEmail,
      });

      if (res.success) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const channelLabel = res.mode === 'whatsapp' ? 'WhatsApp' : 'Email';
        setOtpInfo(channelLabel, res.expiresAt, res.mode);
        router.push('/onboarding/verify-otp');
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFormError(res.message || 'Failed to send OTP code');
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFormError(err.message || 'Network error sending OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleTitle = () => {
    if (!isAchariyaAssociated) return 'Your details';
    if (role === 'PARENT') return 'Verify your child’s enrolment';
    return 'Verify your employment';
  };

  const idLabel = isParent ? "Child's admission number" : 'Employee ID';
  const idValue = isParent ? admissionNumber : employeeId;
  const onIdChange = (val: string) => {
    if (isParent) setAdmissionNumber(val.toUpperCase());
    else setEmployeeId(val.toUpperCase());
    setIdVerified(false);
    setIdError(null);
  };

  const verifyAccessory = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={idVerified ? 'Verified' : `Verify ${idLabel}`}
      onPress={isParent ? handleVerifyAdmission : handleVerifyEmployee}
      disabled={isVerifyingId || idVerified}
      hitSlop={8}
      style={styles.verifyBtn}
    >
      {isVerifyingId ? (
        <ActivityIndicator size="small" color={colors.gold} />
      ) : idVerified ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
      ) : (
        <Txt variant="smallMedium" tone="gold">
          Verify
        </Txt>
      )}
    </Pressable>
  );

  return (
    <OnboardingShell
      step="details"
      title={getRoleTitle()}
      subtitle={
        isAchariyaAssociated
          ? 'We check this against Achariya records, then collect your contact details.'
          : 'We’ll send a verification code to confirm it’s you.'
      }
      footer={<Button label="Send verification code" onPress={handleContinue} loading={isSubmitting} />}
    >
      {formError && <Notice tone="error" message={formError} />}

      {(isStaffOrTeacher || isParent) && (
        <View style={styles.section}>
          <SectionLabel label="Identity" />
          <Field
            label={idLabel}
            value={idValue}
            onChangeText={onIdChange}
            placeholder={isParent ? 'e.g. ACH-ADM-3001' : 'e.g. ACH-STF-101'}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={isParent ? handleVerifyAdmission : handleVerifyEmployee}
            error={idError}
            accessory={verifyAccessory}
          />
          {idVerified && verifiedDetails && (
            <Animated.View entering={FadeIn.duration(250)} style={styles.verified}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
              <View style={styles.flex}>
                <Txt variant="caption" tone="muted">
                  Verified record
                </Txt>
                <Txt variant="smallMedium">{verifiedDetails}</Txt>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      <View style={styles.section}>
        {(isStaffOrTeacher || isParent) && <SectionLabel label="Contact" />}
        <Field
          label={isParent ? 'Parent or guardian name' : 'Full name'}
          value={name}
          onChangeText={setName}
          placeholder="As on your official records"
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
        />
        <Field
          label="Mobile number"
          prefix="+91"
          value={mobile}
          onChangeText={setMobile}
          placeholder="10-digit number"
          keyboardType="phone-pad"
          maxLength={10}
          textContentType="telephoneNumber"
          autoComplete="tel"
        />
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
        />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginBottom: space.md },
  verifyBtn: { paddingHorizontal: space.md, height: 54, justifyContent: 'center' },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    marginTop: -space.xs,
    marginBottom: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(156,196,154,0.3)',
    backgroundColor: colors.successSoft,
  },
});
