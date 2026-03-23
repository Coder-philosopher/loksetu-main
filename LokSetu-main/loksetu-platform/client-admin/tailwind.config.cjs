/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LokSetu Tricolor Government Palette
        'dash-primary': '#0A3D62',       // Dark Navy (Accent)
        'dash-primary-light': '#0E4D7A', // Lighter navy for hover
        'dash-primary-dark': '#062740',  // Darker navy for footer
        'dash-accent': '#FF9933',        // Saffron - primary accent
        'dash-success': '#138808',       // Indian Green
        'dash-warning': '#f59e0b',       // Amber - warning
        'dash-danger': '#dc2626',        // Red - alert/danger
        'dash-surface': '#f8fafc',       // Light gray background
        'dash-card': '#ffffff',          // Card background
        'dash-border': '#e2e8f0',        // Subtle border
        'dash-text': '#1e293b',          // Primary text (slate-800)
        'dash-text-secondary': '#64748b', // Secondary text (slate-500)
        'dash-muted': '#94a3b8',         // Muted text (slate-400)
        'dash-saffron': '#FF9933',       // Tricolor Saffron
        'dash-green': '#138808',         // Tricolor Green
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}