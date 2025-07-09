// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // Add your image domains here.
      // For Firebase Storage, it's typically something like:
       "firebasestorage.googleapis.com",
      
      // "lh3.googleusercontent.com", // If you use Google accounts for profile pictures etc.
      // Example: "your-project-id.appspot.com" (if you're using default Firebase Storage URLs)
      // IMPORTANT: Replace with the actual domain(s) where your beverage images are hosted.
      // You can find this by inspecting the src of one of your images when it loads in a browser.
    ],
  },
};