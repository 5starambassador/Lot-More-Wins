import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { canvasFill, colors, radius, space } from '../../theme/tokens';
import { BrandLogo } from '../brand/Brand';
import { Button } from './Button';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Inline message above a form or section. */
export function Notice({ tone, message }: { tone: 'error' | 'success' | 'info'; message: string }) {
  const map = {
    error: { bg: colors.dangerSoft, border: 'rgba(232,138,128,0.3)', icon: 'alert-circle-outline' as IconName, color: colors.danger, text: 'danger' as const },
    success: { bg: colors.successSoft, border: 'rgba(156,196,154,0.3)', icon: 'checkmark-circle-outline' as IconName, color: colors.success, text: 'success' as const },
    info: { bg: colors.goldSoft, border: colors.goldLine, icon: 'information-circle-outline' as IconName, color: colors.gold, text: 'secondary' as const },
  }[tone];
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]}
    >
      <Ionicons name={map.icon} size={18} color={map.color} style={styles.noticeIcon} />
      <Txt variant="small" tone={map.text} style={styles.flex}>
        {message}
      </Txt>
    </Animated.View>
  );
}

/** Empty and error states: a quiet icon mark, a clear title, one line of guidance and one action. */
export function StateView({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.state}>
      <View style={[styles.stateMark, tone === 'error' && { borderColor: 'rgba(232,138,128,0.35)' }]}>
        <Ionicons name={icon} size={26} color={tone === 'error' ? colors.danger : colors.gold} />
      </View>
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      {message ? (
        <Txt variant="small" tone="secondary" align="center" style={styles.stateMsg}>
          {message}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" compact style={styles.stateAction} />
      ) : null}
    </Animated.View>
  );
}

export function FullScreenLoader() {
  return (
    <View style={styles.loader}>
      <BrandLogo size={112} />
      <ActivityIndicator color={colors.gold} style={{ marginTop: 28 }} />
    </View>
  );
}

/** Shimmer-free skeleton: a slow opacity pulse that reads as loading without distraction. */
export function Skeleton({ width = '100%', height = 14, style }: { width?: DimensionValue; height?: number; style?: object }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised }, animated, style]} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: space.lg, paddingVertical: space.md }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={44} height={44} />
          <View style={styles.flex}>
            <Skeleton width="60%" />
            <Skeleton width="35%" height={10} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.lg,
  },
  noticeIcon: { marginRight: space.xs, marginTop: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  stateMark: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  stateMsg: { marginTop: space.xs, maxWidth: 300 },
  stateAction: { marginTop: space.xl, minWidth: 160 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', ...canvasFill },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
