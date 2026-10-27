import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerContactStepSchema } from '@lotmorewins/validation';
import type { PartnerReferredByPayload } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import apiClient from '../../lib/api';
import { useOnboardingStore } from '../../store/onboarding-store';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { ReferredByFields, type ReferredByErrors } from '../../components/onboarding/ReferredByFields';
import { Button, Field } from '../../components/ui';

type Errors = { name?: string; email?: string; mobile?: string };

/** Shown under the email field when the entered details already belong to a partner. */
function takenMessage(emailTaken: boolean, mobileTaken: boolean): string | null {
  if (emailTaken && mobileTaken) return 'This email and mobile number are already registered. Please sign in instead.';
  if (emailTaken) return 'This email is already registered. Please sign in instead.';
  if (mobileTaken) return 'This mobile number is already registered. Please sign in instead.';
  return null;
}

/**
 * Step 1: name, email and mobile (all required), and who referred the partner (optional). The UPI ID
 * is not asked for at registration; the dashboard and wallet prompt partners to add it in Profile.
 * An email or mobile number that is already registered stops here, before the remaining steps.
 */
export default function DetailsScreen() {
  const router = useRouter();
  const stored = useOnboardingStore();

  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [mobile, setMobile] = useState(stored.mobile);
  const [referredBy, setReferredBy] = useState<PartnerReferredByPayload | null>(stored.referredBy);
  const [errors, setErrors] = useState<Errors>({});
  const [referredByErrors, setReferredByErrors] = useState<ReferredByErrors>({});
  const [taken, setTaken] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);

  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'email' || key === 'mobile') setTaken(null);
  };

  const handleContinue = async () => {
    const parsed = partnerContactStepSchema.safeParse({ name, email, mobile, referredBy });
    if (!parsed.success) {
      const next: Errors = {};
      const nextReferredBy: ReferredByErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'referredBy') nextReferredBy[issue.path[1] as keyof ReferredByErrors] ??= issue.message;
        else next[issue.path[0] as keyof Errors] ??= issue.message;
      }
      setReferredByErrors(nextReferredBy);
      if (!name.trim()) next.name = 'Please enter your full name';
      if (!email.trim()) next.email = 'Please enter your email address';
      if (!mobile.trim()) next.mobile = 'Please enter your mobile number';
      setErrors(next);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setChecking(true);
    try {
      const res = await apiClient.checkPartnerRegistration({ mobile: parsed.data.mobile, email: parsed.data.email });
      const message = takenMessage(res.data.emailTaken, res.data.mobileTaken);
      if (message) {
        setTaken(message);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
    } catch {
      // The check could not run (offline, or an older server): carry on. Registration itself
      // still rejects an email or mobile number that is already registered.
    } finally {
      setChecking(false);
    }

    stored.setContact({ ...parsed.data, referredBy: parsed.data.referredBy ?? null, upiId: '' });
    router.push('/onboarding/location');
  };

  return (
    <OnboardingShell
      step="details"
      title="Let’s get you started"
      subtitle="Tell us who you are. Name, email and mobile are required."
      footer={<Button label="Continue" onPress={handleContinue} loading={checking} />}
    >
      <Field
        label="Full name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          clear('name');
        }}
        placeholder="Your full name"
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={errors.name}
      />
      <Field
        ref={emailRef}
        label="Email address"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clear('email');
        }}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => mobileRef.current?.focus()}
        error={errors.email ?? taken ?? undefined}
      />
      <Field
        ref={mobileRef}
        label="Mobile number"
        prefix="+91"
        value={mobile}
        onChangeText={(v) => {
          setMobile(v.replace(/\D/g, '').slice(0, 10));
          clear('mobile');
        }}
        placeholder="10-digit number"
        keyboardType="phone-pad"
        maxLength={10}
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="done"
        error={errors.mobile}
      />
      <ReferredByFields
        value={referredBy}
        onChange={(value) => {
          setReferredBy(value);
          setReferredByErrors({});
        }}
        errors={referredByErrors}
      />
    </OnboardingShell>
  );
}
