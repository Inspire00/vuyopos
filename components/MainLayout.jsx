// components/MainLayout.jsx
'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Chatbot from './Chatbot'; // Import the new Chatbot component
import Image from 'next/image'; // Import Image component for optimized images

export default function MainLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully!');
      router.push('/login');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-rich-black">
      {/* Sidebar */}
      <aside className="w-64 bg-deep-navy border-r border-primary-gold p-6 flex flex-col justify-between">
        <div>
          <div className="text-cream-white text-2xl font-bold mb-8 text-center flex items-center justify-center">
            <Image
            src="/images/ic_launcher_round.png" // Ensure this path is correct relative to your public directory
              alt="Vuyo POS Logo"
              width={36} // Significantly reduced size
              height={36} // Significantly reduced size
              className="rounded-full mr-2 object-cover" // Make it rounded and add margin-right
          />
            <span className="text-primary-gold">Vuyo</span> POS
          </div>
          <nav>
            <ul>
              <li className="mb-4">
                <Link href="/dashboard" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">📊</span> Dashboard
                </Link>
              </li>
              <li className="mb-4">
                <Link href="/events" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">🎉</span> Events
                </Link>
              </li>
              <li className="mb-4">
                <Link href="/beverages" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">🍹</span> Beverages
                </Link>
              </li>
              <li className="mb-4">
                <Link href="/current-pos" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">💰</span> Current Event POS
                </Link>
              </li>
              <li className="mb-4">
                <Link href="/past-events" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">📜</span> Past Events
                </Link>
              </li>

              <li className="mb-4">
                <Link href="/stats" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">🛒</span> Past Events
                </Link>
              </li>


               <li className="mb-4">
                <Link href="/suppliers" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">🛒</span> Suppliers
                </Link>
              </li>

              <li className="mb-4">
                <Link href="/staffing" className="flex items-center text-cream-white hover:text-secondary-gold transition-colors duration-200">
                  <span className="mr-2">👩🏼‍🤝‍🧑🏻</span> Find Staff
                </Link>
              </li>


            </ul>
          </nav>
        </div>

         {/* Chair Image Container - Fixed height */}
        <div className="w-full flex-1 relative rounded-lg shadow-lg mt-5 mb-5 flex items-center justify-center overflow-hidden">
          <Image
            src="/images/Chair.png" // Ensure this path is correct relative to your public directory
            alt="Decorative Chair Image"
            fill // Make the image fill its parent container
            className="rounded-lg object-cover" // object-contain to ensure the whole image is visible
          />
        </div>

        {user && (
          <div className="mt-8">
            <p className="text-cream-white text-sm mb-2">Logged in as:</p>
            <p className="text-secondary-gold font-medium mb-4 truncate">{user.email}</p>
            <button
              onClick={handleLogout}
              className="w-full bg-burgundy hover:bg-red-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-deep-navy p-4 shadow-md border-b border-primary-gold flex items-center justify-between">
          <h1 className="text-cream-white text-2xl font-bold">
            Bar Management System
          </h1>
          <div className="text-primary-gold">
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Chatbot Component - only show if user is logged in */}
      {!loading && user && <Chatbot />}
    </div>
  );
}
