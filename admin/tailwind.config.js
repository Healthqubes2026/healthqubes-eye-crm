/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#EEF4FF',
          100: '#D9E7FF',
          200: '#BBCFFF',
          400: '#6B9EFF',
          500: '#2E6BE6',
          600: '#1B55C8',
          700: '#1240A0',
          800: '#0D2E78',
          900: '#071D52',
        },
        teal: {
          50:  '#E0F7F2',
          400: '#2DC79A',
          600: '#0F8C6A',
          800: '#064D3C',
        },
        surface: {
          0:   '#FFFFFF',
          50:  '#F7F8FA',
          100: '#EDEEF2',
          200: '#E0E2E9',
          300: '#C8CBD6',
          600: '#6B7280',
          800: '#1F2937',
          900: '#111827',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { transform: 'scale(1)', opacity: 0.8 }, '50%': { transform: 'scale(1.5)', opacity: 0.3 } },
      },
    },
  },
  plugins: [],
};
