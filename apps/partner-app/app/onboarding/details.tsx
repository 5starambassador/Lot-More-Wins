import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerContactStepSchema } from '@lotmorewins/validation';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { Button, Field } from '../../components/ui';

type Errors = { name?: string; email?: string; mobile?: string };

/** Step 1: name, email and mobile. All three are required. */
export default function DetailsScreen() {
  const router = useRouter();
  const stored = useOnboardingStore();

  const [name, setName] = useState(stored.name);
  const [email, setEmail] = useState(stored.email);
  const [mobile, setMobile] = useState(stored.mobile);
  const [errors, setErrors] = useState<Errors>({});
  const emailRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);

  const clear = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  const handleContinue = async () => {
    const parsed = partnerContactStepSchema.safeParse({ name, email, mobile });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] ??= issue.message;
      if (!name.trim()) next.name = 'Please enter your full name';
      if (!email.trim()) next.email = 'Please enter your email address';
      if (!mobile.trim()) next.mobile = 'Please enter your mobile number';
      setErrors(next);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    stored.setContact(parsed.data);
    router.push('/onboarding/location');
  };

  return (
    <OnboardingShell
      step="details"
      title="Let’s get you started"
      subtitle="Tell us who you are. All three details are required."
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
        onSubmitEditing={handleContinue}
        error={errors.mobile}
      />
    </OnboardingShell>
  );
}
