/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gov-blue': '#0A3D62',
        'gov-blue-light': '#0E4D7A',
        'gov-blue-dark': '#062740',
        'gov-navy': '#0A3D62',
        'gov-saffron': '#FF9933',
        'gov-green': '#138808',
        'gov-green-light': '#e8f5e9',
        'gov-orange-light': '#fff3e0',
        'gov-grey': '#f5f5f5',
        'gov-border': '#e0e0e0',
        'gov-text': '#333333',
        'gov-text-light': '#666666',
      },
      fontFamily: {
        gov: ['Noto Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}