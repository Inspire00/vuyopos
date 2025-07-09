// app/(app)/past-events/page.jsx
'use client';

import { useState, useEffect } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link'; // Import Link for navigation

export default function PastEventsPage() {
  const { user } = useAuth();
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPastEvents();
    }
  }, [user]);

  const fetchPastEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Query for events that are NOT active and belong to the current user
      const q = query(
        collection(db, 'events'),
        where('eventManagerId', '==', user.uid),
        where('isActive', '==', false)
        // You might want to add orderBy('date', 'desc') here if you store date as a Firestore Timestamp
        // For string dates, you'd sort in memory.
      );
      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // If date is stored as a string (YYYY-MM-DD), sort in memory
      // Sort by date in descending order (most recent past event first)
      fetchedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPastEvents(fetchedEvents);
    } catch (error) {
      console.error('Error fetching past events:', error);
      toast.error('Failed to fetch past events.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-xl text-center">Loading past events...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold text-cream-white mb-6">Your Past Events</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pastEvents.length === 0 ? (
            <p className="text-cream-white col-span-full text-center">
              No past events found. Events become "past" when you set another event as current.
            </p>
          ) : (
            pastEvents.map((event) => (
              // Wrap the event card in a Link component
              <Link href={`/past-events/${event.id}`} key={event.id} className="block">
                <div
                  className="bg-deep-navy p-6 rounded-lg shadow-md border border-dark-charcoal transform hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                >
                  <h2 className="text-xl font-semibold text-cream-white mb-4">
                    {event.name}
                  </h2>
                  <p className="text-cream-white mb-1">
                    <span className="font-semibold text-primary-gold">Date:</span> {new Date(event.date).toLocaleDateString()}
                  </p>
                  <p className="text-cream-white mb-1">
                    <span className="font-semibold text-primary-gold">Location:</span> {event.location}
                  </p>
                  <p className="text-cream-white mb-1">
                    <span className="font-semibold text-primary-gold">Initial Budget:</span> R {event.budget.toLocaleString()}
                  </p>
                  <p className="text-cream-white mb-4">
                    <span className="font-semibold text-primary-gold">Final Spend:</span> R {event.currentSpend.toLocaleString()}
                  </p>
                  <span className="text-primary-gold hover:text-secondary-gold underline text-sm">View Details</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
