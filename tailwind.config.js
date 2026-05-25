/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'lime-neon': '#CCFF00',
        'app-dark': '#0F0F0F',
        'app-card': '#1C1C1E',
        'app-subtext': '#8F9098',
        /* ── Neon accent ────────────────────────────── */
        neon: {
          DEFAULT: '#CCFF00',
          dim:     'rgba(204,255,0,0.50)',
          glow:    'rgba(204,255,0,0.25)',
          50:      '#F7FFD6',
          100:     '#EEFF99',
          200:     '#CCFF00',
          300:     '#A3CC00',
          400:     '#7A9900',
          500:     '#526600',
        },
        /* ── Cyber dark surfaces ─────────────────────── */
        cyber: {
          bg:      '#0F0F0F',
          surface: '#1C1C1E',
          raised:  '#242428',
          border:  'rgba(255,255,255,0.07)',
        },

        /* ── Habit calendar states (Design Guide §2) ─ */
        missed:           '#3A3A3E',   // Level 0: no hecho
        regular:          '#689F38',   // Level 1: regular
        good:             '#8BC34A',   // Level 2: bien
        /* excellent     = lime-neon #CCFF00 (alias: neon.DEFAULT) */
        'progress-track': '#2A2A2E',   // progress bar track bg

        /* ── Keep existing colour ramps for habit PALETTE ── */
        brand: {
          50:  '#f5f7f2',
          100: '#e7ecdf',
          200: '#ccd8be',
          300: '#a9be96',
          400: '#829f6c',
          500: '#637f50',
          600: '#4e653f',
          700: '#3f5135',
          800: '#35432e',
          900: '#2e3a2a',
          950: '#171f14',
        },
        ink: {
          900: '#272522',
          950: '#151412',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'SF Pro Text', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono:    ['SFMono-Regular', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      screens: { xs: '480px' },

      borderRadius: {
        xs:   '0.375rem',
        sm:   '0.5rem',
        md:   '0.625rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },

      boxShadow: {
        /* Existing */
        hairline: '0 0 0 1px rgba(255,255,255,0.06)',
        soft:     '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.30)',
        float:    '0 16px 48px rgba(0,0,0,0.55)',
        /* Neon glow effects */
        'neon':       '0 0 20px rgba(204,255,0,0.35), 0 0 60px rgba(204,255,0,0.12)',
        'neon-sm':    '0 0 10px rgba(204,255,0,0.28)',
        'neon-ring':  '0 0 0 1.5px rgba(204,255,0,0.7)',
        'glow':       '0 0 0 1px rgba(204,255,0,0.14), 0 0 28px rgba(204,255,0,0.22)',
        /* Dark card elevation */
        'dark-sm':    '0 2px 8px rgba(0,0,0,0.40)',
        'dark-md':    '0 4px 16px rgba(0,0,0,0.50)',
        'dark-lg':    '0 8px 32px rgba(0,0,0,0.60)',
      },

      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'press': {
          '0%':   { transform: 'scale(1)' },
          '100%': { transform: 'scale(0.985)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.94)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'pop': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-10px)' },
          '40%, 80%': { transform: 'translateX(10px)' },
        },
        'neon-pulse': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 12px rgba(204,255,0,0.35)' },
          '50%':      { opacity: '0.8', boxShadow: '0 0 24px rgba(204,255,0,0.55)' },
        },
      },

      animation: {
        'slide-up':    'slide-up 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in':     'fade-in 0.22s ease-out',
        'scale-in':    'scale-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'press':       'press 0.12s ease-out',
        'pop':         'pop 0.28s ease-out',
        'shake':       'shake 0.4s ease-out',
        'neon-pulse':  'neon-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
