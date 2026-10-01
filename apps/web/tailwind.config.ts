import type { Config } from 'tailwindcss';
import sharedPreset from '../../packages/config/tailwind-preset.js';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /** Brand maroon. 700 is the primary action colour; 900/950 carry the navigation chrome. */
        maroon: {
          50: '#FBF3F4',
          100: '#F5E4E7',
          200: '#EBC6CD',
          300: '#D899A5',
          400: '#BC5D71',
          500: '#9E2F48',
          600: '#831D36',
          700: '#6B1429',
          800: '#520F20',
          900: '#3A0B17',
          950: '#26060E',
        },
        /** Brand gold. 400–500 on maroon; 600–700 when gold must read as text on light surfaces. */
        gold: {
          50: '#FFFAE5',
          100: '#FFF2BF',
          200: '#FFE68A',
          300: '#FFD95A',
          400: '#F7C531',
          500: '#E5AC10',
          600: '#B8860B',
          700: '#8F6708',
          800: '#6B4D0A',
          900: '#473308',
        },
        /** Warm neutrals for the workspace. */
        stone: {
          25: '#FCFBF9',
          50: '#F7F5F2',
          100: '#EFEBE6',
          150: '#E8E2DA',
          200: '#DDD5CB',
          300: '#C6BCB0',
          400: '#A29789',
          500: '#7F756A',
          600: '#5F574E',
          700: '#453F38',
          800: '#2D2924',
          900: '#1C1916',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 3px)',
      },
      backgroundImage: {
        /** Dark-red chrome (navigation, brand panel, toasts) as a top-to-bottom gradient. */
        'brand-gradient': 'linear-gradient(180deg, #8C0A0A 0%, #750505 40%, #430202 100%)',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(28, 25, 22, 0.04)',
        raised: '0 12px 32px -12px rgba(38, 6, 14, 0.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'rise-in': 'rise-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
