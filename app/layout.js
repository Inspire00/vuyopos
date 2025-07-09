// app/layout.jsx
import { Inter } from 'next/font/google';
import './globals.css'; // Path change: no 'src/'
import { AuthProvider } from '../context/AuthContext'; // Path change: relative path
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Bar POS - Event Manager',
  description: 'Luxurious Bar POS for Event Management',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Favicon for browser tab */}
        <link rel="icon" href="/images/ic_launcher_round.png" type="image/png" />
        {/* Web App Manifest for PWA features and desktop icon */}
        <link rel="manifest" href="/manifest.json" />
      </head>

      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}