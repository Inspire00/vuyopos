// app/(app)/dashboard/page.jsx
'use client';

import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import MainLayout from '../../../components/MainLayout';
import Link from 'next/link'; // Import Link component

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rich-black text-cream-white text-xl">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold text-cream-white mb-6">Welcome, {user.email}!</h1>
        <p className="text-lg text-cream-white">
          This is your dashboard. Start by creating a new event or managing existing ones.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {/* Current Event Card - Now clickable */}
          <Link href="/events" className="block"> {/* Wrap the entire div with Link */}
            <div className="bg-deep-navy p-6 rounded-lg shadow-md border border-primary-gold hover:border-secondary-gold transform hover:scale-[1.02] transition-transform duration-200 cursor-pointer">
              <h2 className="text-xl font-semibold text-secondary-gold mb-4">Current Event</h2>
              <p className="text-cream-white">No active event. Create one now!</p>
              <p className="text-primary-gold hover:text-secondary-gold underline mt-2">Go to Events</p> {/* Keep this text as a visual cue */}
            </div>
          </Link>

          {/* Past Events Card - Now clickable */}
          <Link href="/past-events" className="block"> {/* Updated href to /past-events */}
            <div className="bg-deep-navy p-6 rounded-lg shadow-md border border-primary-gold hover:border-secondary-gold transform hover:scale-[1.02] transition-transform duration-200 cursor-pointer">
              <h2 className="text-xl font-semibold text-secondary-gold mb-4">Past Events</h2>
              <p className="text-cream-white">View your event history.</p>
              <p className="text-primary-gold hover:text-secondary-gold underline mt-2">View History</p>
            </div>
          </Link>

          {/* Manage Beverages Card - Now clickable */}
          <Link href="/beverages" className="block"> {/* Wrap the entire div with Link */}
            <div className="bg-deep-navy p-6 rounded-lg shadow-md border border-primary-gold hover:border-secondary-gold transform hover:scale-[1.02] transition-transform duration-200 cursor-pointer">
              <h2 className="text-xl font-semibold text-secondary-gold mb-4">Manage Beverages</h2>
              <p className="text-cream-white">Add or update your drink menu.</p>
              <p className="text-primary-gold hover:text-secondary-gold underline mt-2">Manage Beverages</p> {/* Keep this text as a visual cue */}
            </div>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
