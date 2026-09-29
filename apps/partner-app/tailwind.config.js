const sharedPreset = require('../../packages/config/tailwind-preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset'), sharedPreset],
  theme: {
    extend: {},
  },
  plugins: [],
};
