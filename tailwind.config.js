/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0B1F5B',
        accent: '#5D5FEF',
        'accent-light': '#7879F1',
        background: '#F8F9FF',
        muted: '#6E6E6E',
        success: '#4ADE80',
        warning: '#FACC15',
        danger: '#F87171',
      },
    },
  },
  plugins: [],
};
