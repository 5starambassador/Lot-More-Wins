import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from '../../lib/haptics';
import { colors, radius, space } from '../../theme/tokens';
import { Txt } from './Txt';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const palette: Record<Variant, { bg: string; border: string; text: 'onGold' | 'gold' | 'default' | 'danger'; spinner: string }> = {
  primary: { bg: colors.gold, border: colors.gold, text: 'onGold', spinner: colors.textOnGold },
  secondary: { bg: 'transparent', border: colors.goldLine, text: 'gold', spinner: colors.gold },
  ghost: { bg: 'transparent', border: 'transparent', text: 'default', spinner: colors.text },
  danger: { bg: 'transparent', border: 'rgba(232,138,128,0.35)', text: 'danger', spinner: colors.danger },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Primary actions are solid gold; secondary actions are gold hairline outlines. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  trailing,
  compact = false,
  haptic = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => (scale.value = withTiming(0.98, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.base,
        compact && styles.compact,
        { backgroundColor: p.bg, borderColor: p.border },
        inactive && !loading && styles.disabled,
        animated,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.spinner} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Txt variant={compact ? 'smallMedium' : 'bodyMedium'} tone={p.text} style={variant === 'primary' ? styles.primaryLabel : undefined}>
            {label}
          </Txt>
          {trailing}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  compact: { height: 40, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  disabled: { opacity: 0.4 },
  primaryLabel: { fontFamily: 'Poppins_600SemiBold' },
});
