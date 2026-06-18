/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          checkin: '#4CAF50',
          dark: '#2d5016',
        },
        blue: {
          healing: '#2E75B6',
        },
      },
      fontSize: {
        'senior-sm': '16px',
        'senior-base': '18px',
        'senior-lg': '22px',
        'senior-xl': '26px',
        'senior-2xl': '32px',
      },
    },
  },
  plugins: [],
};
