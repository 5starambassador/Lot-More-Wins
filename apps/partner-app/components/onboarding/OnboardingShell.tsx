import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Screen, TopBar, Txt } from '../ui';
import { colors, GUTTER, space } from '../../theme/tokens';

/** Every partner registers through the same five steps. */
const STEPS = ['details', 'location', 'birthday', 'verify', 'password'] as const;
export type OnboardingStep = (typeof STEPS)[number];

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
  hero,
  children,
  footer,
}: {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  /** Artwork shown above the title (the birthday step's gift). */
  hero?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const index = STEPS.indexOf(step);

  return (
    <Screen padded={false} footer={footer}>
      <TopBar right={<Txt variant="caption" tone="muted">{`${index + 1} of ${STEPS.length}`}</Txt>} />
      <View style={styles.progressWrap}>
        <Progress current={index + 1} total={STEPS.length} />
      </View>
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.body, hero ? styles.bodyWithHero : null]}>
        {hero}
        <Txt variant="title" align={hero ? 'center' : undefined}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="body" tone="secondary" align={hero ? 'center' : undefined} style={styles.subtitle}>
            {subtitle}
          </Txt>
        ) : null}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: GUTTER },
  track: { height: 2, backgroundColor: colors.hairline, borderRadius: 1, overflow: 'hidden' },
  fill: { height: 2, backgroundColor: colors.gold },
  body: { paddingHorizontal: GUTTER, paddingTop: space.xxl },
  bodyWithHero: { paddingTop: space.md },
  subtitle: { marginTop: space.xs },
  content: { marginTop: space.xxl },
});
