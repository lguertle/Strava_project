/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      "light",
      "dark",
      {
        strava: {
          "primary": "#FC4C02",          // Strava orange
          "primary-focus": "#E34402",
          "primary-content": "#ffffff",
          "secondary": "#0D66D0",        // Blue for buttons
          "secondary-focus": "#0A4FA4",
          "secondary-content": "#ffffff",
          "accent": "#27AE60",           // Green for highlights
          "accent-focus": "#219653",
          "accent-content": "#ffffff",
          "neutral": "#3D4451",
          "neutral-focus": "#2A2E37",
          "neutral-content": "#ffffff",
          "base-100": "#FFFFFF",
          "base-200": "#F2F2F2",
          "base-300": "#E5E5E5",
          "base-content": "#1A1A1A",
          "info": "#3ABFF8",
          "success": "#36D399",
          "warning": "#FBBD23",
          "error": "#F87272",
        },
      },
    ],
    darkTheme: "dark",
  },
} 