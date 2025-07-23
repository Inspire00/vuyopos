// app/(app)/currenteventsdashboard/page.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import Chatbot from '../../../components/Chatbot'; // Import the new Chatbot component
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function CurrentEventsDashboard() {
  const { user } = useAuth();
  // State to hold all active events and their real-time data
  // Structure: { eventId: { eventDetails: {}, beverages: { beverageId: {} } } }
  const [activeEventsData, setActiveEventsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to determine stock status color, text, and animation
  const getStockStatus = useCallback((currentStock, initialStock) => {
    if (initialStock === 0) {
      // Avoid division by zero, handle cases where initial stock might be 0
      return { color: 'text-gray-400', text: 'No Initial Stock', animation: '' };
    }
    const percentageRemaining = (currentStock / initialStock) * 100;

    if (percentageRemaining <= 0) {
      return { color: 'text-burgundy', text: 'Out of Stock', animation: 'animate-glow-burgundy' };
    } else if (percentageRemaining <= 30) { // 1-30% remaining: Critically Low
      return { color: 'text-burgundy', text: 'Critically Low', animation: 'animate-bounce-subtle animate-glow-burgundy' };
    } else if (percentageRemaining <= 60) { // 31-60% remaining: Getting Low
      return { color: 'text-orange-500', text: 'Getting Low', animation: 'animate-pulse-slow animate-glow-amber' };
    } else { // > 60% remaining: Sufficient
      return { color: 'text-green-500', text: 'Sufficient', animation: '' };
    }
  }, []);

  // Main effect to set up real-time listeners for all active events
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsubscribes = []; // Array to hold all unsubscribe functions

    try {
      // 1. Listen for changes in the list of active events for the current user
      const qActiveEvents = query(
        collection(db, 'events'),
        where('eventManagerId', '==', user.uid),
        where('isActive', '==', true)
      );

      const unsubscribeEvents = onSnapshot(qActiveEvents, (snapshot) => {
        const currentActiveEventIds = new Set();
        const newEventDetailsMap = {}; // Temporarily store new/modified event details

        snapshot.docChanges().forEach((change) => {
          const eventId = change.doc.id;
          const eventData = { id: eventId, ...change.doc.data() };
          currentActiveEventIds.add(eventId);

          if (change.type === 'added' || change.type === 'modified') {
            newEventDetailsMap[eventId] = eventData;

            // If it's a new active event or an event that was previously not in activeEventsData,
            // set up a new listener for its beverages.
            // We ensure that the structure for this eventId exists in activeEventsData
            // before trying to access its 'beverages' property.
            if (change.type === 'added' || !activeEventsData[eventId]) {
              console.log(`Setting up beverage listener for new/modified active event: ${eventData.name} (${eventId})`);
              const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', eventId));
              const unsubscribeBeverages = onSnapshot(qBeverages, (bevSnapshot) => {
                const updatedBeverages = {};
                bevSnapshot.forEach(bevDoc => {
                  updatedBeverages[bevDoc.id] = { id: bevDoc.id, ...bevDoc.data() };
                });

                setActiveEventsData(prev => ({
                  ...prev,
                  [eventId]: {
                    ...prev[eventId], // Spread existing data for this eventId (if any)
                    eventDetails: prev[eventId]?.eventDetails || eventData, // Keep existing eventDetails or use new one
                    beverages: updatedBeverages,
                  },
                }));
              }, (err) => {
                console.error(`Error listening to beverages for event ${eventId}:`, err);
                toast.error(`Failed to load beverages for ${eventData.name}.`);
              });
              unsubscribes.push(unsubscribeBeverages); // Add to cleanup list
            }
          } else if (change.type === 'removed') {
            // If an event is removed (deactivated), remove its data from state
            console.log(`Removing data for deactivated event: ${eventData.name} (${eventId})`);
            setActiveEventsData(prev => {
              const newState = { ...prev };
              delete newState[eventId];
              return newState;
            });
            // The beverage listener for this event will be implicitly cleaned up by the overall unsubscribe
          }
        });

        // After processing all changes, update the main activeEventsData state
        // This ensures eventDetails are up-to-date and old events are removed.
        setActiveEventsData(prev => {
          const newState = {};
          // Add/update events that are still active
          snapshot.docs.forEach(doc => {
            const eventId = doc.id;
            newState[eventId] = {
              ...prev[eventId], // Preserve existing beverages data
              eventDetails: { id: eventId, ...doc.data() }, // Update event details
              beverages: prev[eventId]?.beverages || {}, // Ensure beverages object exists
            };
          });
          return newState;
        });
        setLoading(false);
      }, (err) => {
        console.error("Error listening to active events:", err);
        setError("Failed to load active events dashboard.");
        setLoading(false);
      });

      unsubscribes.push(unsubscribeEvents); // Add the main event listener to cleanup list

    } catch (err) {
      console.error("Initial setup error for dashboard:", err);
      setError("An unexpected error occurred during dashboard setup.");
      setLoading(false);
    }

    // Cleanup function: unsubscribe from all listeners when component unmounts or dependencies change
    return () => {
      console.log("Cleaning up dashboard listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, getStockStatus]); // Depend on user and getStockStatus

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-deep-navy">
          <div className="text-center text-cream-white text-lg font-semibold">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
            Loading active events dashboard...
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen bg-deep-navy">
          <div className="text-center text-burgundy text-lg font-semibold">
            Error: {error}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Safely get values from activeEventsData, ensuring it's an object
  const sortedActiveEvents = Object.values(activeEventsData || {}).sort((a, b) => {
    // Sort by creation date, newest first
    const dateA = a.eventDetails?.createdAt?.toDate() || new Date(0);
    const dateB = b.eventDetails?.createdAt?.toDate() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <MainLayout>
      <div className="p-6 bg-rich-black min-h-screen">
        <h1 className="text-4xl font-bold text-cream-white mb-8 text-center">
          Live Event Bars Dashboard
        </h1>

        {sortedActiveEvents.length === 0 ? (
          <div className="bg-deep-navy p-8 rounded-lg text-cream-white text-center border border-primary-gold shadow-lg max-w-2xl mx-auto">
            <p className="text-xl mb-4 font-semibold">No active events currently running.</p>
            <p className="mb-6">
              To see live statistics, please go to the{' '}
              <Link href="/events" className="text-secondary-gold hover:underline font-bold">
                Events page
              </Link>{' '}
              to set an event as active.
            </p>
            <Link href="/events" className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-3 px-6 rounded-lg transition-colors duration-200">
              Go to Events
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {sortedActiveEvents.map(({ eventDetails, beverages }) => {
              if (!eventDetails) return null; // Skip if eventDetails somehow missing

              const budgetPercentage = (eventDetails.currentSpend / eventDetails.budget) * 100;
              const budgetBarColor = budgetPercentage >= 90 ? 'bg-burgundy' : budgetPercentage >= 70 ? 'bg-orange-500' : 'bg-green-500';

              // Safely get values from beverages, ensuring it's an object
              const sortedBeverages = Object.values(beverages || {}).sort((a, b) => {
                // Sort by current stock, lowest first
                return a.currentStock - b.currentStock;
              });

              return (
                <div key={eventDetails.id} className="bg-deep-navy p-6 rounded-lg shadow-xl border border-primary-gold flex flex-col">
                  <h2 className="text-3xl font-bold text-secondary-gold mb-4 text-center">
                    {eventDetails.name}
                  </h2>
                  <p className="text-cream-white text-md mb-2 text-center">
                    Date: {new Date(eventDetails.date).toLocaleDateString()} | Location: {eventDetails.location}
                  </p>

                  {/* Budget Status */}
                  <div className="mb-6 p-4 bg-dark-charcoal rounded-md border border-primary-gold">
                    <h3 className="text-lg font-semibold text-cream-white mb-2">Budget Status</h3>
                    <div className="text-cream-white text-sm mb-2">
                      <span className="font-bold text-secondary-gold">Spent:</span> R {eventDetails.currentSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /{' '}
                      <span className="font-bold text-primary-gold">Budget:</span> R {eventDetails.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="w-full bg-rich-black rounded-full h-3">
                      <div
                        className={`${budgetBarColor} h-3 rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${Math.min(100, budgetPercentage)}%` }}
                      ></div>
                    </div>
                    <p className={`text-right text-sm mt-1 ${budgetPercentage >= 90 ? 'text-burgundy' : 'text-cream-white'}`}>
                      {budgetPercentage.toFixed(2)}% of budget consumed
                    </p>
                  </div>

                  {/* Beverage Stock and Sales */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className="text-xl font-semibold text-cream-white mb-3">Beverage Stock & Sales</h3>
                    {sortedBeverages.length === 0 ? (
                      <p className="text-cream-white text-center py-4">No beverages added for this event.</p>
                    ) : (
                      <ul className="space-y-3">
                        {sortedBeverages.map(beverage => {
                          const { color, text, animation } = getStockStatus(beverage.currentStock, beverage.initialStock); // Get animation class
                          const soldQuantity = beverage.initialStock - beverage.currentStock;

                          return (
                            <li key={beverage.id} className="bg-rich-black p-3 rounded-md border border-dark-charcoal">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-cream-white">{beverage.name}</span>
                                <span className={`text-sm font-bold ${color} ${animation}`}>{text}</span> {/* Apply animation class */}
                              </div>
                              <p className="text-sm text-primary-gold">
                                Stock: {beverage.currentStock} / {beverage.initialStock}
                              </p>
                              <p className="text-sm text-primary-gold">
                                Sold: {soldQuantity}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chatbot Component - only show if user is logged in */}
      {!loading && user && <Chatbot />}

      </div>
    </MainLayout>
  );
}
