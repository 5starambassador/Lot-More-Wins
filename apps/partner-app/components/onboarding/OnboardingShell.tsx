import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { Screen, TopBar, Txt } from '../ui';
import { useOnboardingStore } from '../../store/onboarding-store';
import { colors, GUTTER, radius, space } from '../../theme/tokens';

export type OnboardingStep = 'affiliation' | 'role' | 'details' | 'verify' | 'password';

/** The Achariya branch has an extra role step, so the count reflects the path actually taken. */
function stepsFor(isAchariya: boolean): OnboardingStep[] {
  return isAchariya ? ['affiliation', 'role', 'details', 'verify', 'password'] : ['affiliation', 'details', 'verify', 'password'];
}

function Progress({ current, total }: { current: number; total: number }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useAnimatedStyle(() => ({ width: withTiming((trackWidth * current) / total, { duration: 350 }) }));
  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  footer,
}: {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const isAchariya = useOnboardingStore((s) => s.isAchariyaAssociated);
  // Until the affiliation is chosen the longer path is assumed.
  const steps = stepsFor(step === 'affiliation' ? true : isAchariya);
  const index = Math.max(0, steps.indexOf(step));

  return (
    <Screen padded={false} footer={footer}>
      <TopBar right={<Txt variant="caption" tone="muted">{`${index + 1} of ${steps.length}`}</Txt>} />
      <View style={styles.progressWrap}>
        <Progress current={index + 1} total={steps.length} />
      </View>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        <Txt variant="title">{title}</Txt>
        {subtitle ? (
          <Txt variant="body" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Txt>
        ) : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Screen>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A selectable option: hairline-bordered row with a gold icon, never a heavy card. */
export function ChoiceRow({
  icon,
  title,
  description,
  meta,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <View style={styles.choiceIcon}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <View style={styles.choiceText}>
        <Txt variant="bodyMedium">{title}</Txt>
        <Txt variant="small" tone="secondary">
          {description}
        </Txt>
        {meta ? (
          <Txt variant="caption" tone="gold" style={styles.choiceMeta}>
            {meta}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: GUTTER },
  track: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  fill: { height: 2, backgroundColor: colors.gold },
  body: { paddingHorizontal: GUTTER, paddingTop: space.xxl },
  subtitle: { marginTop: space.xs },
  content: { marginTop: space.xxl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
  },
  choicePressed: { borderColor: colors.gold, backgroundColor: colors.surfacePressed },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1, gap: 2 },
  choiceMeta: { marginTop: 4, fontFamily: 'Poppins_500Medium' },
});
