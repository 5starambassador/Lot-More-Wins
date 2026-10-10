import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerContactStepSchema } from '@lotmorewins/validation';
import type { PartnerReferredByPayload } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { ReferredByFields, type ReferredByErrors } from '../../components/onboarding/ReferredByFields';
import { Button, Field } from '../../components/ui';

type Errors = { name?: string; email?: string; mobile?: string };

/** Step 1: name, email and mobile (all required), and who referred the partner (optional). */
export default function DetailsScreen() {
  const router = useRouter();
  const stored = useOnboardingStore();

  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [mobile, setMobile] = useState(stored.mobile);
  const [referredBy, setReferredBy] = useState<PartnerReferredByPayload | null>(stored.referredBy);
  const [errors, setErrors] = useState<Errors>({});
  const [referredByErrors, setReferredByErrors] = useState<ReferredByErrors>({});
  const emailRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);

  const clear = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

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
    stored.setContact({ ...parsed.data, referredBy: parsed.data.referredBy ?? null });
    router.push('/onboarding/location');
  };

  return (
    <OnboardingShell
      step="details"
      title="Let’s get you started"
      subtitle="Tell us who you are. Name, email and mobile are required."
      footer={<Button label="Continue" onPress={handleContinue} />}
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
        error={errors.email}
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
