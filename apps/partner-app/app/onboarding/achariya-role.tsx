import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import type { PartnerRole } from '@lotmorewins/types';
import { ChoiceRow, OnboardingShell } from '../../components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../store/onboarding-store';

const ROLES: { role: PartnerRole; icon: ComponentProps<typeof Ionicons>['name']; title: string; desc: string; meta: string }[] = [
  { role: 'STAFF', icon: 'briefcase-outline', title: 'Staff', desc: 'Administrative or operational staff at an Achariya institution.', meta: 'Employee ID required' },
  { role: 'TEACHER', icon: 'school-outline', title: 'Teacher', desc: 'Academic faculty across Achariya schools and colleges.', meta: 'Employee ID required' },
  { role: 'PARENT', icon: 'people-outline', title: 'Parent', desc: 'Parent or guardian of an enrolled student.', meta: "Child's admission number required" },
];

export default function AchariyaRoleScreen() {
  const router = useRouter();
  const setRole = useOnboardingStore((s) => s.setRole);

  return (
    <OnboardingShell step="role" title="Which describes you?" subtitle="We'll verify this against official Achariya records on the next step.">
      {ROLES.map((item) => (
        <ChoiceRow
          key={item.role}
          icon={item.icon}
          title={item.title}
          description={item.desc}
          meta={item.meta}
          onPress={() => {
            setRole(item.role);
            router.push('/onboarding/role-form');
          }}
        />
      ))}
    </OnboardingShell>
  );
}
