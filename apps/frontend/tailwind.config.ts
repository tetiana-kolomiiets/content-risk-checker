import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fafafa',
        surface: '#ffffff',
        border: {
          DEFAULT: '#e5e5e8',
          subtle: '#f1f1f3',
          strong: '#d4d4d8',
        },
        text: {
          primary: '#0a0a0c',
          secondary: '#71717a',
          tertiary: '#a1a1aa',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#5558e3',
        },
        risk: {
          low: '#059669',
          medium: '#d97706',
          high: '#dc2626',
        },
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '14px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
      },
      boxShadow: {
        focus: '0 0 0 3px rgba(99, 102, 241, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
