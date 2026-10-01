import { useState } from 'react';
import { useRouter } from 'expo-router';
import { partnerAddressStepSchema } from '@lotmorewins/validation';
import * as Haptics from '../../lib/haptics';
import { useOnboardingStore } from '../../store/onboarding-store';
import { OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { AddressFields, Button, type AddressErrors, type AddressValue } from '../../components/ui';

/** Step 2: city, state and pincode, typed or filled in from the device location. */
export default function LocationScreen() {
  const router = useRouter();
  const stored = useOnboardingStore();

  const [address, setAddress] = useState<AddressValue>({ city: stored.city, state: stored.state, pincode: stored.pincode });
  const [errors, setErrors] = useState<AddressErrors>({});

  const handleContinue = async () => {
    const parsed = partnerAddressStepSchema.safeParse(address);
    if (!parsed.success) {
      const next: AddressErrors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof AddressValue] ??= issue.message;
      setErrors(next);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    stored.setAddress(parsed.data);
    router.push('/onboarding/birthday');
  };

  return (
    <OnboardingShell
      step="location"
      title="Where are you based?"
      subtitle="Use your current location to fill this in, or type it yourself."
      footer={<Button label="Continue" onPress={handleContinue} />}
    >
      <AddressFields
        value={address}
        onChange={(next) => {
          setAddress(next);
          setErrors({});
        }}
        errors={errors}
      />
    </OnboardingShell>
  );
}
