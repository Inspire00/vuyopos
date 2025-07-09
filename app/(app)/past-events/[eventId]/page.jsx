// app/(app)/past-events/[eventId]/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Import useCallback
import MainLayout from '../../../../components/MainLayout';
import { useAuth } from '../../../../context/AuthContext';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function PastEventDetailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId; // Get the eventId from the URL

  const [eventDetails, setEventDetails] = useState(null);
  const [beveragesData, setBeveragesData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auditedStocks, setAuditedStocks] = useState({}); // New state for audited stock

  // Wrap fetchEventData in useCallback
  const fetchEventData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Event Details
      const eventRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists() || eventSnap.data().eventManagerId !== user.uid) {
        throw new Error('Event not found or you do not have permission to view it.');
      }
      setEventDetails({ id: eventSnap.id, ...eventSnap.data() });

      // 2. Fetch Beverages associated with this event
      const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', eventId));
      const beverageSnapshot = await getDocs(qBeverages);
      const fetchedBeverages = beverageSnapshot.docs.map(doc => {
        // IMPORTANT: Ensure doc.id is valid and a non-empty string before returning the object
        if (!doc.id || typeof doc.id !== 'string' || doc.id.trim() === '') {
          console.error("Firestore document has invalid, missing, or empty ID and will be skipped:", doc.id, doc.data());
          return null; // Return null for invalid documents
        }
        return { id: doc.id, ...doc.data() };
      }).filter(Boolean); // Filter out any null entries (documents with invalid IDs)

      // --- NEW DEBUGGING LOG ---
      console.log('Fetched Beverages after filter:', fetchedBeverages);
      // --- END NEW DEBUGGING LOG ---

      setBeveragesData(fetchedBeverages);

      // Initialize auditedStocks state
      const initialAuditedStocks = {};
      fetchedBeverages.forEach(b => {
        // Ensure b.id exists, is a string, and is not empty before using it as a key
        if (b.id && typeof b.id === 'string' && b.id.trim() !== '') {
          // Ensure the value stored is always a number
          initialAuditedStocks[b.id] = b.auditedStock !== undefined && typeof b.auditedStock === 'number'
            ? b.auditedStock
            : (b.currentStock !== undefined && typeof b.currentStock === 'number' ? b.currentStock : 0);
        } else {
          // This warning should ideally not be hit if the .map().filter(Boolean) worked correctly
          console.warn("Skipping beverage during auditedStocks initialization due to invalid ID (should have been filtered):", b);
        }
      });
      setAuditedStocks(initialAuditedStocks);

      // 3. Fetch Orders associated with this event
      const qOrders = query(collection(db, 'orders'), where('eventId', '==', eventId));
      const orderSnapshot = await getDocs(qOrders);
      const fetchedOrders = orderSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrdersData(fetchedOrders);

    } catch (err) {
      console.error('Error fetching event details:', err);
      setError(err.message || 'Failed to load event details.');
      toast.error(err.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  }, [user, eventId]); // Add user and eventId to useCallback dependencies

  useEffect(() => {
    if (!user) {
      router.push('/login'); // Redirect to login if not authenticated
      return;
    }
    if (eventId) {
      fetchEventData();
    }
  }, [user, eventId, router, fetchEventData]); // Include fetchEventData in useEffect dependencies

  /**
   * Handles changes to the audited stock input field.
   * Ensures the value stored is always a number (or 0 if input is invalid/empty).
   * @param {string} beverageId - The ID of the beverage being audited.
   * @param {string} value - The input value (string).
   */
  const handleAuditedStockChange = (beverageId, value) => {
    // IMPORTANT: Add validation for beverageId right at the start
    if (!beverageId || typeof beverageId !== 'string' || beverageId.trim() === '') {
      console.warn(`handleAuditedStockChange received invalid beverageId: "${beverageId}". Skipping update.`);
      return; // Do not proceed if beverageId is invalid
    }

    const parsedValue = parseInt(value, 10);
    setAuditedStocks(prev => ({
      ...prev,
      // If parsedValue is NaN or less than 0, set to 0. Otherwise, use parsedValue.
      [beverageId]: isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue
    }));
  };

  /**
   * Saves the audited stock counts to Firestore.
   */
  const handleSaveAuditedStock = async () => {
    setLoading(true);
    try {
      const updates = [];
      // --- DEBUGGING LOG ---
      console.log('auditedStocks state before update loop:', auditedStocks);
      // --- END DEBUGGING LOG ---

      // Iterate over the keys of auditedStocks to ensure valid beverageIds
      for (const beverageId of Object.keys(auditedStocks)) {
        // Robust validation for beverageId and the value before updating
        // Ensure beverageId is a non-empty string
        if (!beverageId || typeof beverageId !== 'string' || beverageId.trim() === '') {
          console.warn(`Skipping update for invalid or empty beverageId: "${beverageId}"`);
          continue; // Skip this iteration if beverageId is invalid
        }

        const auditedValue = auditedStocks[beverageId];
        // Ensure the value to be saved is a valid number
        if (typeof auditedValue !== 'number' || isNaN(auditedValue)) {
            console.warn(`Skipping update for invalid audited stock value for beverage ${beverageId}: "${auditedValue}"`);
            continue; // Skip if the value is not a valid number
        }

        // --- DEBUGGING LOGS ---
        console.log(`Attempting to update beverage ID: "${beverageId}" with auditedStock: ${auditedValue}`);
        // --- END DEBUGGING LOGS ---

        const beverageRef = doc(db, 'beverages', beverageId);
        updates.push(updateDoc(beverageRef, {
          auditedStock: auditedValue,
          lastAuditedAt: Timestamp.now() // Record when it was last audited
        }));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        toast.success('Audited stock counts saved successfully!');
        // Re-fetch data to ensure UI is consistent with saved data and any potential new timestamps
        fetchEventData();
      } else {
        toast('No valid stock counts to save.', { icon: 'ℹ️' });
      }

    } catch (error) {
      console.error('Error saving audited stock:', error);
      toast.error('Failed to save audited stock counts: ' + (error.message || 'An unknown error occurred.'));
    } finally {
      setLoading(false);
    }
  };

  // Memoized calculation for beverage breakdown
  const beverageBreakdown = useMemo(() => {
    if (!beveragesData.length) {
      return [];
    }

    const breakdownMap = new Map(beveragesData.map(b => [
      b.id,
      {
        id: b.id, // <--- ADDED: Ensure the ID is part of the value object
        name: b.name,
        initialStock: b.initialStock,
        soldQuantity: 0,
        closingStock: b.currentStock,
        // Ensure auditedStock is a number for display, defaulting to 0 if state is empty string
        auditedStock: auditedStocks[b.id] !== undefined ? auditedStocks[b.id] : (b.auditedStock !== undefined ? b.auditedStock : b.currentStock),
        totalRevenue: 0,
        price: b.price
      }
    ]));

    ordersData.forEach(order => {
      order.items.forEach(item => {
        const existing = breakdownMap.get(item.beverageId);
        if (existing) {
          existing.soldQuantity += item.quantity;
          existing.totalRevenue += item.quantity * item.pricePerUnit;
        }
      });
    });

    return Array.from(breakdownMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [beveragesData, ordersData, auditedStocks]);

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-xl text-center">Loading event details...</div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-center">
          <p className="text-xl font-semibold mb-4">Error: {error}</p>
          <Link href="/past-events" className="text-secondary-gold hover:underline">Go back to Past Events</Link>
        </div>
      </MainLayout>
    );
  }

  if (!eventDetails) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-center">
          <p className="text-xl font-semibold mb-4">Event details not available.</p>
          <Link href="/past-events" className="text-secondary-gold hover:underline">Go back to Past Events</Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <Link href="/past-events" className="text-primary-gold hover:text-secondary-gold flex items-center mb-4">
          <span className="mr-2">&larr;</span> Back to Past Events
        </Link>
        <h1 className="text-3xl font-bold text-cream-white mb-4">Event Report: {eventDetails.name}</h1>
        <p className="text-lg text-cream-white mb-2">
          <span className="font-semibold text-primary-gold">Date:</span> {new Date(eventDetails.date).toLocaleDateString()}
        </p>
        <p className="text-lg text-cream-white mb-2">
          <span className="font-semibold text-primary-gold">Location:</span> {eventDetails.location}
        </p>
        <p className="text-lg text-cream-white mb-2">
          <span className="font-semibold text-primary-gold">Initial Budget:</span> R {eventDetails.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-lg text-cream-white mb-6">
          <span className="font-semibold text-primary-gold">Final Spend:</span> R {eventDetails.currentSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>

        <h2 className="text-2xl font-bold text-secondary-gold mb-4">Beverage Sales Breakdown</h2>

        {beverageBreakdown.length === 0 ? (
          <p className="text-cream-white text-center py-8">No beverage sales data available for this event.</p>
        ) : (
          <div className="overflow-x-auto bg-deep-navy rounded-lg shadow-xl border border-primary-gold">
            <table className="min-w-full divide-y divide-dark-charcoal">
              <thead className="bg-dark-charcoal">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Beverage
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Price (R)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Opening Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Sold
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Closing Stock (System)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Audited Stock Count
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-cream-white uppercase tracking-wider">
                    Revenue (R)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-charcoal">
                {beverageBreakdown.map((item) => {
                  // Validate item.id directly before rendering the row
                  // This check is now redundant if the ID is correctly passed, but good for defensive coding
                  if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
                    console.warn('Skipping rendering of beverage item due to invalid ID (should be fixed now):', item);
                    return null; // Skip rendering this row
                  }
                  return (
                    <tr key={item.id} className="hover:bg-rich-black">
                      <td className="px-6 py-4 whitespace-nowrap text-cream-white font-medium">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-primary-gold">
                        {item.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-cream-white">
                        {item.initialStock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-cream-white">
                        {item.soldQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-cream-white">
                        {item.closingStock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          // Ensure value is always a number or empty string if 0, for input display
                          value={auditedStocks[item.id] === 0 ? '0' : (auditedStocks[item.id] || '')}
                          onChange={(e) => handleAuditedStockChange(item.id, e.target.value)}
                          className="w-24 p-1 rounded bg-rich-black text-cream-white border border-dark-charcoal focus:outline-none focus:border-secondary-gold text-center"
                          min="0"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-secondary-gold">
                        {item.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {beverageBreakdown.length > 0 && (
          <div className="mt-6 text-right">
            <button
              onClick={handleSaveAuditedStock}
              className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Audited Stock Counts'}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
