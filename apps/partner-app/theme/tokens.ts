/**
 * Lot More Wins — Partner brand tokens.
 * A neutral warm-black canvas, brand red (#D12426) accents and an antique gold used sparingly for
 * what matters: primary actions, rewards, highlights and hairline detailing.
 */

export const colors = {
  // Canvas & surfaces (deep red, surfaces a step lighter)
  canvas: '#750505',
  surface: '#820C0C',
  surfaceRaised: '#8F1414',
  surfacePressed: '#9C1B1B',

  // Brighter red for accents that sit on the dark-red canvas
  maroon: '#B01E1E',
  maroonBright: '#E0453F',
  maroonSoft: 'rgba(0, 0, 0, 0.14)',

  // Antique gold
  gold: '#C8A15A',
  goldBright: '#E3C48A',
  goldMuted: '#8E7442',
  goldSoft: 'rgba(200, 161, 90, 0.12)',
  goldLine: 'rgba(200, 161, 90, 0.28)',

  // Lines
  hairline: 'rgba(245, 237, 224, 0.08)',
  line: 'rgba(245, 237, 224, 0.14)',

  // Text (ivory on maroon)
  text: '#F5EDE0',
  textSecondary: '#F6DCD6',
  textMuted: '#EBB8B0',
  textOnGold: '#1A0A0D',

  // Feedback (tuned to sit quietly within the palette)
  success: '#9CC49A',
  successSoft: 'rgba(156, 196, 154, 0.12)',
  danger: '#E88A80',
  dangerSoft: 'rgba(232, 138, 128, 0.12)',

  white: '#FFFFFF',
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Horizontal page gutter used by every screen. */
export const GUTTER = space.xl;
