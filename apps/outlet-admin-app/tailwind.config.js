const sharedPreset = require('../../packages/config/tailwind-preset.js');

/**
 * Screens are styled with StyleSheet and theme/tokens.ts (the partner app's design system).
 * NativeWind stays configured for compatibility; 'class' dark mode avoids the NativeWind web
 * error thrown under the default 'media' mode. The app has a single (brand) colour scheme.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset'), sharedPreset],
  theme: { extend: {} },
  plugins: [],
};
