import sharedPreset from '../../packages/config/tailwind-preset.js';

/** Partner App brand tokens, mirrored from apps/partner-app/theme/tokens.ts. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [sharedPreset],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#750505', deep: '#430202', top: '#8C0A0A', night: '#2A0101' },
        surface: { DEFAULT: '#8E1010', raised: '#9A1818' },
        maroon: { DEFAULT: '#B01E1E', bright: '#E0453F' },
        gilt: { DEFAULT: '#F5C542', bright: '#FFDD75', muted: '#B8922F', deep: '#8E6B1F', pale: '#FFE9A8' },
        ivory: { DEFAULT: '#F5EDE0', soft: '#F6DCD6', muted: '#EBB8B0' },
        ink: '#1A0A0D',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        stage: '76rem',
      },
    },
  },
  plugins: [],
};
