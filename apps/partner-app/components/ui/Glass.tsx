import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { colors, radius } from '../../theme/tokens';

// Gradients fall back to the flat `backgroundColor` beside them where they are not supported.
/** The pane itself: light catching the top-left corner, clearing towards the bottom-right. */
const PANE = {
  backgroundColor: colors.glass,
  experimental_backgroundImage:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.09) 42%, rgba(255, 255, 255, 0.04) 100%)',
} as ViewStyle;
const PANE_PRESSED = {
  backgroundColor: colors.glassPressed,
  experimental_backgroundImage:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.16) 42%, rgba(255, 255, 255, 0.10) 100%)',
} as ViewStyle;
/** A soft glow falling from the top edge and fading out, in place of a hard band. */
const SHEEN = {
  experimental_backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 100%)',
} as ViewStyle;
/** The bevel: a hairline of light along the top edge, brightest in the middle, with a warm gold tint. */
const EDGE = {
  backgroundColor: colors.glassBorder,
  experimental_backgroundImage:
    'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 246, 214, 0.85) 50%, rgba(255, 255, 255, 0) 100%)',
} as ViewStyle;

/**
 * Frosted-glass panel: a translucent pane lit from the top-left, a fine rim, a soft sheen
 * and a hairline of light along the top edge. Pressable when `onPress` is given; it
 * brightens and settles slightly while pressed.
 */
export function Glass({
  children,
  onPress,
  accessibilityLabel,
  style,
  rounded = radius.xl,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}) {
  const light = (
    <>
      <View pointerEvents="none" style={[styles.sheen, SHEEN]} />
      <View pointerEvents="none" style={[styles.edge, EDGE, { left: rounded, right: rounded }]} />
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.glass, PANE, { borderRadius: rounded }, style]}>
        {light}
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.glass, pressed ? PANE_PRESSED : PANE, { borderRadius: rounded }, pressed && styles.pressed, style]}
    >
      {light}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.glassBorder,
  },
  pressed: { transform: [{ scale: 0.985 }], borderColor: colors.goldLine },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  // Inset by the corner radius so the line stays on the straight part of the top edge.
  edge: { position: 'absolute', top: 0, height: 1 },
});
