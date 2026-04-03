/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './public/**/*.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colours matching CSS variables in App.jsx / landing
        brand: {
          blue:    '#3b82f6',
          indigo:  '#6366f1',
          emerald: '#10b981',
          purple:  '#8b5cf6',
          amber:   '#f59e0b',
          red:     '#ef4444',
          cyan:    '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'grad-blue':  'linear-gradient(135deg, #60a5fa, #818cf8)',
        'grad-green': 'linear-gradient(135deg, #34d399, #06b6d4)',
      },
      animation: {
        'ping-slow': 'ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
