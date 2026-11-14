import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { colors, radius } from '../../theme/tokens';

/*
 * "Liquid glass" without a blur library (expo-blur is not a dependency): the frosted look is
 * built from layers that are all cheap to draw, so it is fine on long lists on Android too.
 *
 *   pane      translucent ivory fill, brighter where the light enters at the top-left
 *   depth     a soft drop shadow under the pane, plus inset highlights along the top and left
 *             edges and a faint inset shade along the bottom (boxShadow, new architecture)
 *   rim       a 1px border lit along the top and left, fading along the right and bottom
 *   sheen     a glow falling from the top edge
 *   streak    a diagonal band of reflected light across the upper-left (skipped when `lite`)
 *   caustic   warm light gathering along the bottom edge, as it does in thick glass (skipped when `lite`)
 *   edge      a hairline of warm light along the straight part of the top edge
 *
 * Gradients and box shadows fall back to the flat colours beside them where they are not supported.
 */
const PANE = {
  backgroundColor: colors.glass,
  experimental_backgroundImage:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.10) 40%, rgba(255, 255, 255, 0.05) 70%, rgba(255, 255, 255, 0.08) 100%)',
} as ViewStyle;
const PANE_PRESSED = {
  backgroundColor: colors.glassPressed,
  experimental_backgroundImage:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.30) 0%, rgba(255, 255, 255, 0.18) 40%, rgba(255, 255, 255, 0.11) 70%, rgba(255, 255, 255, 0.14) 100%)',
} as ViewStyle;
const DEPTH = {
  boxShadow:
    '0px 10px 24px -8px rgba(20, 2, 2, 0.55), inset 0px 1px 0px rgba(255, 255, 255, 0.30), inset 1px 0px 0px rgba(255, 255, 255, 0.14), inset 0px -1px 0px rgba(0, 0, 0, 0.14)',
} as ViewStyle;
const DEPTH_LITE = {
  boxShadow: '0px 6px 14px -6px rgba(20, 2, 2, 0.5), inset 0px 1px 0px rgba(255, 255, 255, 0.28)',
} as ViewStyle;
const SHEEN = {
  experimental_backgroundImage: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 55%, rgba(255, 255, 255, 0) 100%)',
} as ViewStyle;
const STREAK = {
  experimental_backgroundImage:
    'linear-gradient(115deg, rgba(255, 255, 255, 0) 18%, rgba(255, 255, 255, 0.09) 30%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0) 52%)',
} as ViewStyle;
const CAUSTIC = {
  experimental_backgroundImage: 'linear-gradient(0deg, rgba(255, 228, 190, 0.12) 0%, rgba(255, 228, 190, 0) 100%)',
} as ViewStyle;
const EDGE = {
  backgroundColor: colors.glassBorder,
  experimental_backgroundImage:
    'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 246, 214, 0.9) 50%, rgba(255, 255, 255, 0) 100%)',
} as ViewStyle;

const RIMS = {
  light: {
    borderTopColor: colors.glassRimLit,
    borderLeftColor: colors.glassRimSide,
    borderRightColor: colors.glassRimShade,
    borderBottomColor: colors.glassRimShade,
  },
  gold: {
    borderTopColor: 'rgba(255, 221, 117, 0.75)',
    borderLeftColor: 'rgba(255, 221, 117, 0.5)',
    borderRightColor: colors.goldLine,
    borderBottomColor: colors.goldLine,
  },
} satisfies Record<string, ViewStyle>;
const RIM_PRESSED: ViewStyle = {
  borderTopColor: colors.gold,
  borderLeftColor: colors.goldLine,
  borderRightColor: colors.goldLine,
  borderBottomColor: colors.goldLine,
};

/**
 * Frosted "liquid glass" panel (see the layer notes above). Pressable when `onPress` is given;
 * it brightens, picks up a gold rim and settles slightly while pressed.
 * `lite` drops the two decorative layers for surfaces repeated many times, like list tiles.
 */
export function Glass({
  children,
  onPress,
  accessibilityLabel,
  style,
  rounded = radius.xl,
  rim = 'light',
  lite = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
  rim?: keyof typeof RIMS;
  lite?: boolean;
}) {
  const light = (
    <>
      <View pointerEvents="none" style={[styles.sheen, SHEEN]} />
      {lite ? null : (
        <>
          <View pointerEvents="none" style={[styles.fill, STREAK]} />
          <View pointerEvents="none" style={[styles.caustic, CAUSTIC]} />
        </>
      )}
      <View pointerEvents="none" style={[styles.edge, EDGE, { left: rounded, right: rounded }]} />
    </>
  );
  const base = [styles.glass, lite ? DEPTH_LITE : DEPTH, RIMS[rim], { borderRadius: rounded }];
  if (!onPress) {
    return (
      <View style={[...base, PANE, style]}>
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
      style={({ pressed }) => [...base, pressed ? PANE_PRESSED : PANE, pressed && styles.pressed, style]}
    >
      {light}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  pressed: { transform: [{ scale: 0.985 }], ...RIM_PRESSED },
  fill: { ...StyleSheet.absoluteFillObject },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  caustic: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%' },
  // Inset by the corner radius so the line stays on the straight part of the top edge.
  edge: { position: 'absolute', top: 0, height: 1 },
});
