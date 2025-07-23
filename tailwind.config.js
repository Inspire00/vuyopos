/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // Ensure this path is correct for your app directory
  ],
  theme: {
    extend: {
      colors: {
        'rich-black': '#0D1117',
        'deep-navy': '#161B22',
        'dark-charcoal': '#21262D',
        'cream-white': '#F0F6FC',
        'primary-gold': '#FFD700',   // A vibrant gold
        'secondary-gold': '#DAA520', // A slightly darker, more muted gold
        'burgundy': '#991B1B',       // A deep red for critical alerts
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      // 👇👇👇 Ensure this 'keyframes' block is exactly as shown 👇👇👇
      keyframes: {
        'glow-amber': {
          '0%, 100%': { textShadow: '0 0 5px rgba(251, 191, 36, 0.5)' }, // Tailwind amber-400 equivalent
          '50%': { textShadow: '0 0 15px rgba(251, 191, 36, 0.9)' },
        },
        'glow-burgundy': {
          '0%, 100%': { textShadow: '0 0 5px rgba(153, 27, 27, 0.5)' }, // Tailwind red-700 equivalent
          '50%': { textShadow: '0 0 15px rgba(153, 27, 27, 0.9)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' }, // Very slight upward bounce
        },
      },
      // 👇👇👇 Ensure this 'animation' block is exactly as shown 👇👇👇
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // 'pulse' is a default Tailwind animation
        'bounce-subtle': 'bounce-subtle 1.5s ease-in-out infinite',
        'glow-amber': 'glow-amber 2s ease-in-out infinite',
        'glow-burgundy': 'glow-burgundy 2s ease-in-out infinite',
      },
      // 👆👆👆 End of animation configuration 👆👆👆
    },
  },
  plugins: [],
};