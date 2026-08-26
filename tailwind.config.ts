import type { Config } from 'tailwindcss';

/**
 * FanHour brand system.
 * Riyadh Emerald (FanHour green) + Cyber Amethyst (FanHour purple) are the
 * platform identity. Al Hazem colours are used only as contextual accents
 * (see `hazem` tokens) — see docs/ARCHITECTURE.md §Brand.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // FanHour official core palette (Brand Manual v1.2 §C6).
        brand: {
          green: '#00E28A', // Emerald
          greenDeep: '#009966',
          greenDim: 'rgba(0,226,138,0.14)',
          purple: '#A855FF', // Amethyst
          purpleDeep: '#5B21B6',
          purpleDim: 'rgba(168,85,255,0.14)',
        },
        // Al Hazem contextual accent — approved club gold (crest #FCBA13).
        // Used only in club-specific zones; never alters the FanHour palette.
        hazem: {
          primary: '#FCBA13',
          accent: '#FFFFFF',
        },
        // Midnight / Onyx product frame (§C6).
        surface: {
          base: '#0A0E1A', // Midnight
          onyx: '#06070D', // Onyx
          card: '#101522',
          card2: '#151B2A',
          border: '#2A3242',
        },
        content: {
          primary: '#FFFFFF',
          secondary: '#B8C2D1',
          muted: '#5C6678',
        },
        state: {
          success: '#00E28A',
          warn: '#FFC857',
          danger: '#FF6B6B',
          info: '#56B4FF',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
