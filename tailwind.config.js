// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-gold': '#B8860B', // Darker Gold for accents
        'secondary-gold': '#D4AF37', // Lighter Gold for highlights
        'rich-black': '#0D1117', // Deep, sophisticated black for backgrounds/text
        'deep-navy': '#1A2E44', // Dark blue for sections
        'cream-white': '#F5F5DC', // Off-white for text/background elements
        'dark-charcoal': '#36454F', // Dark gray for subtle contrasts
        'burgundy': '#800020', // For alert or important highlights
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'), // Add this for scrollbar styling
  ],
};