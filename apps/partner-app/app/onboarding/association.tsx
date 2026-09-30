import { useRouter } from 'expo-router';
import { ChoiceRow, OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../store/onboarding-store';

export default function AssociationScreen() {
  const router = useRouter();
  const setAssociation = useOnboardingStore((s) => s.setAssociation);

  const handleSelect = (isAssociated: boolean) => {
    setAssociation(isAssociated);
    router.push(isAssociated ? '/onboarding/achariya-role' : '/onboarding/role-form');
  };

  return (
    <OnboardingShell
      step="affiliation"
      title="Are you part of the Achariya community?"
      subtitle="Achariya staff, teachers and parents are verified against institutional records and receive member benefits."
    >
      <ChoiceRow
        icon="ribbon-outline"
        title="Yes, I'm with Achariya"
        description="Staff, teacher, or parent of an enrolled student."
        meta="Member benefits"
        onPress={() => handleSelect(true)}
      />
      <ChoiceRow
        icon="person-outline"
        title="No, I'm joining independently"
        description="Join the partner programme without an Achariya affiliation."
        onPress={() => handleSelect(false)}
      />
    </OnboardingShell>
  );
}
