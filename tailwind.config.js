/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,jsx,ts,tsx}",
    "!./node_modules/**/*",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        mono: ['Share Tech Mono', 'monospace'],
        body: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        acer: {
          red: '#FF1A1A',
          orange: '#FF6600',
          amber: '#FF9900',
          dark: '#0a0a0a',
          panel: '#111111',
          border: '#2a1a0a',
          glow: '#FF4400',
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'flicker': 'flicker 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,68,0,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255,68,0,0.8)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.8' },
          '94%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
