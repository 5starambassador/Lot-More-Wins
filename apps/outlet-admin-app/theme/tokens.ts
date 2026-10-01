/**
 * Lot More Wins — brand tokens (shared look with the partner app).
 * A neutral warm-black canvas, brand red (#D12426) accents and a bright gold used sparingly for
 * what matters: primary actions, rewards, highlights and hairline detailing.
 */

import type { ViewStyle } from 'react-native';

export const colors = {
  // Canvas & surfaces (deep red, surfaces a step lighter)
  canvas: '#750505',
  canvasDeep: '#430202',
  surface: '#8E1010',
  surfaceRaised: '#9A1818',
  surfacePressed: '#A62020',

  // Brighter red for accents that sit on the dark-red canvas
  maroon: '#B01E1E',
  maroonBright: '#E0453F',
  maroonSoft: 'rgba(0, 0, 0, 0.14)',

  // Bright gold
  gold: '#F5C542',
  goldBright: '#FFDD75',
  goldMuted: '#B8922F',
  goldSoft: 'rgba(245, 197, 66, 0.14)',
  goldLine: 'rgba(245, 197, 66, 0.36)',

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

/** Full-screen background: the canvas red as a top-to-bottom gradient, ending in canvasDeep. */
export const canvasFill = {
  backgroundColor: colors.canvas,
  experimental_backgroundImage: 'linear-gradient(180deg, #8C0A0A 0%, #750505 40%, #430202 100%)',
} as ViewStyle;

/**
 * The gradient gold border: paint it on a wrapper and inset the content by the border width.
 * Falls back to flat gold where gradients are not supported.
 */
export const goldFrame = {
  backgroundColor: colors.gold,
  experimental_backgroundImage: 'linear-gradient(125deg, #FFE9A8 0%, #B8922F 22%, #FFF6D6 45%, #F5C542 62%, #8E6B1F 82%, #FFDD75 100%)',
} as ViewStyle;

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
