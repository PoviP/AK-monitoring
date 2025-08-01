/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wow: {
          gold: '#ffd100',
          blue: '#0070dd',
          purple: '#a335ee',
          orange: '#ff8000',
          green: '#1eff00',
        }
      }
    },
  },
  plugins: [],
}