/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
        display: ['Manrope', 'Cairo', 'sans-serif'],
        body: ['Inter', 'Cairo', 'sans-serif'],
      },
      // تغيير اللون الأزرق الافتراضي إلى Teal (اللون الرسمي لدولفين)
      // هذا يجعل جميع كلاسات blue-* في التطبيق تصبح teal تلقائياً
      colors: {
        blue: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Design System: Dolphin Deep — Tonal Architecture
        ds: {
          surface:    '#f8f9fa',
          'surface-low': '#f3f4f5',
          'surface-card': '#ffffff',
          'surface-high': '#e1e3e4',
          'surface-dim': '#d9dadb',
          primary:    '#0040a1',
          'primary-c': '#0056d2',
          'on-surface':  '#191c1d',
          'on-surface-v': '#44474a',
          outline:    '#c4c7c9',
        },
      },
      boxShadow: {
        'ambient': '0 4px 20px rgba(25,28,29,0.06), 0 12px 40px rgba(25,28,29,0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
