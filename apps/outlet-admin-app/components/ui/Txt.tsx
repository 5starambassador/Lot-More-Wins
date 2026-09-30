import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

/**
 * Typography scale. Every piece of text in the app goes through this component so the
 * Poppins weights, sizes and line heights stay consistent.
 */
const variants = {
  display: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  smallMedium: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, textTransform: 'uppercase' },
  figure: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  mono: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 1.2 },
} satisfies Record<string, TextStyle>;

export type TxtVariant = keyof typeof variants;

const tones = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  gold: colors.gold,
  onGold: colors.textOnGold,
  success: colors.success,
  danger: colors.danger,
} as const;

export type TxtTone = keyof typeof tones;

export function Txt({
  variant = 'body',
  tone = 'default',
  align,
  style,
  ...rest
}: TextProps & { variant?: TxtVariant; tone?: TxtTone; align?: TextStyle['textAlign'] }) {
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[variants[variant], { color: tones[tone] }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
