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
        // FanHour platform brand
        brand: {
          green: '#00E676',
          greenDim: 'rgba(0,230,118,0.14)',
          purple: '#6515EE',
          purpleDim: 'rgba(101,21,238,0.14)',
        },
        // Al Hazem contextual accent (club green/white — neutral placeholders,
        // replace with approved club palette before launch).
        hazem: {
          primary: '#0B6E4F',
          accent: '#F4F4F5',
        },
        surface: {
          base: '#0A0A0F',
          card: '#121218',
          card2: '#181822',
          border: '#242433',
        },
        content: {
          primary: '#FFFFFF',
          secondary: '#B7B7C6',
          muted: '#7A7A8C',
        },
        state: {
          success: '#00E676',
          warn: '#FF9800',
          danger: '#FF5470',
          info: '#42A5F5',
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
