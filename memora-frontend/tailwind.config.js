/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-black': '#000000',
        'cyber-dark': '#0a0a0a',
        'cyber-gray': '#1a1a1a',
        'cyber-light': '#2a2a2a',
        'cyber-blue': '#00d4ff',
        'cyber-green': '#00ff88',
        'cyber-white': '#ffffff',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        'cyber': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'grid-pulse': 'grid-pulse 2s ease-in-out infinite',
        'neon-glow': 'neon-glow 1.5s ease-in-out infinite alternate',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
      },
      keyframes: {
        'grid-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        'neon-glow': {
          '0%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '100%': { boxShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'terminal-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
