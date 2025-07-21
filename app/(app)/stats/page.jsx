// StatsPage.jsx
"use client"; // Mark as a Client Component

import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Import Firebase instances from your central setup
import { db } from '../../../lib/firebase';
// Import useAuth from your AuthContext
import { useAuth } from '../../../context/AuthContext';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import CustomBarChart from '../../../components/BarChart'; // Corrected import path for BarChart component
import toast from 'react-hot-toast'; // Import toast for notifications
import ChatbotModal from '../../../components/ChatBotModal'; // Import the new ChatbotModal

/**
 * StatsPage component provides an interface for analyzing past event data.
 * It fetches event, beverage, and order data from Firestore,
 * aggregates beverage consumption, and displays it in a bar chart.
 * Users can filter the data by event name and beverage type (All, Non-Alcoholic, Alcoholic).
 */
const StatsPage = () => {
  // Use useAuth hook to get user and authentication loading state
  const { user, loading: authLoading } = useAuth();

  // --- Data State ---
  // Stores all raw past event data (events, beverages, orders)
  const [allEventsRawData, setAllEventsRawData] = useState({ events: [], beverages: {}, orders: [] });
  // Stores the processed data ready for the chart, after filtering and grouping
  const [processedChartData, setProcessedChartData] = useState([]);
  
  // Input for filtering by event name
  const [eventNameFilter, setEventNameFilter] = useState('');
  // New state for filtering by beverage type (All, non-alcoholic, alcoholic)
  const [selectedBeverageTypeFilter, setSelectedBeverageTypeFilter] = useState('All');

  // --- UI State ---
  // Combine authLoading with data fetching loading
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(''); // General messages to the user
  // State to control Chatbot Modal visibility
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Define beverage categories by type for consistent grouping
  const beverageTypeCategories = useMemo(() => ({
    'non-alcoholic': ['Juice', 'Fizzy', 'Coffee', 'Water', 'Other Non-Alcoholic'],
    'alcoholic': ['Red Wine', 'White Wine', 'Beers', 'Ciders', 'Strong Drink', 'Other Alcoholic'],
  }), []);

  // --- Data Fetching Logic (using useCallback for stability) ---
  const fetchAllPastEventsData = useCallback(async () => {
    // Only proceed if user is authenticated and db is available
    if (authLoading || !user || !db) {
      console.log("Auth not ready, user not available, or db not initialized. Skipping data fetch.");
      return;
    }

    setDataLoading(true); // Set data loading true when starting fetch
    setError(null);
    setMessage('');

    try {
      const userId = user.uid; // Get UID from authenticated user
      console.log("Fetching all past events data for user:", userId);
      const eventsRef = collection(db, 'events');
      const qEvents = query(eventsRef, where('eventManagerId', '==', userId), where('isActive', '==', false));
      
      // Use onSnapshot for real-time updates
      const unsubscribeEvents = onSnapshot(qEvents, async (eventSnapshot) => {
        const events = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${events.length} past events.`);

        if (events.length === 0) {
          setAllEventsRawData({ events: [], beverages: {}, orders: [] });
          setDataLoading(false);
          setMessage("No past events found for analysis. Please ensure you have deactivated events.");
          return;
        }

        const allBeverages = {};
        const allOrders = [];
        const eventIds = events.map(e => e.id);

        if (eventIds.length > 0) {
          // Fetch beverages
          const qBeverages = query(collection(db, 'beverages'), where('eventId', 'in', eventIds));
          const unsubscribeBeverages = onSnapshot(qBeverages, (beverageSnapshot) => {
            beverageSnapshot.forEach(doc => {
              allBeverages[doc.id] = doc.data();
            });
            console.log(`Found ${Object.keys(allBeverages).length} beverages across past events.`);
            
            // Fetch orders (nested to ensure beverages are somewhat ready)
            const qOrders = query(collection(db, 'orders'), where('eventId', 'in', eventIds));
            const unsubscribeOrders = onSnapshot(qOrders, (orderSnapshot) => {
              orderSnapshot.forEach(doc => {
                allOrders.push(doc.data());
              });
              console.log(`Found ${allOrders.length} orders across past events.`);

              setAllEventsRawData({ events, beverages: allBeverages, orders: allOrders });
              setDataLoading(false); // Data loading complete
              setMessage('');
            }, (err) => {
              console.error("Error fetching orders:", err);
              setError("Failed to load order data.");
              setDataLoading(false);
            });
            return unsubscribeOrders;
          }, (err) => {
            console.error("Error fetching beverages:", err);
            setError("Failed to load beverage data.");
            setDataLoading(false);
          });
          return unsubscribeBeverages;
        } else {
          setDataLoading(false);
          setMessage("No past events found for analysis.");
        }
      }, (err) => {
        console.error("Error fetching events:", err);
        setError("Failed to load event data.");
        setDataLoading(false);
      });

      return () => unsubscribeEvents(); // Cleanup function for event listener
    } catch (err) {
      console.error("Error in fetchAllPastEventsData:", err);
      setError("An unexpected error occurred while fetching data.");
      setDataLoading(false);
    }
  }, [authLoading, user]); // Dependencies for useCallback: user and authLoading

  useEffect(() => {
    // Only attempt to fetch data if Firebase is initialized and user is available
    if (!authLoading && user) {
      fetchAllPastEventsData();
    }
  }, [authLoading, user, fetchAllPastEventsData]); // Re-run when auth state or memoized fetch function changes

  // --- Data Processing and Filtering Logic (using useCallback for stability) ---
  const aggregateAndFilterChartData = useCallback(() => {
    const { events, beverages, orders } = allEventsRawData;
    let filteredEvents = events;

    // 1. Apply event name filter
    if (eventNameFilter) {
      const lowerCaseFilter = eventNameFilter.toLowerCase();
      filteredEvents = events.filter(event =>
        event.name && event.name.toLowerCase().includes(lowerCaseFilter)
      );
    }

    // 2. Aggregate sales by beverage category and type
    const salesByCategoryAndType = {
      'non-alcoholic': {},
      'alcoholic': {},
      'All': {} // For overall view, aggregates all categories regardless of type
    };

    filteredEvents.forEach(event => {
      const eventOrders = orders.filter(order => order.eventId === event.id);
      
      eventOrders.forEach(order => {
        order.items.forEach(item => {
          const beverageData = beverages[item.beverageId];
          if (beverageData) {
            const category = beverageData.category || 'Unknown Category';
            const type = beverageData.type || 'Unknown Type'; // 'alcoholic' or 'non-alcoholic'
            const quantity = item.quantity || 0;

            // Aggregate for specific type
            if (salesByCategoryAndType[type]) {
              salesByCategoryAndType[type][category] = (salesByCategoryAndType[type][category] || 0) + quantity;
            }
            // Aggregate for 'All' view
            salesByCategoryAndType['All'][category] = (salesByCategoryAndType['All'][category] || 0) + quantity;
          }
        });
      });
    });

    // 3. Prepare data for the chart based on selectedBeverageTypeFilter
    let chartData = [];
    const selectedSales = salesByCategoryAndType[selectedBeverageTypeFilter] || {};
    
    chartData = Object.entries(selectedSales)
      .map(([name, totalSold]) => ({ name, totalSold }))
      .sort((a, b) => b.totalSold - a.totalSold); // Sort descending

    setProcessedChartData(chartData);

    // Update messages based on filter results
    if (eventNameFilter && chartData.length === 0 && events.length > 0) {
      setMessage(`No data found for event matching "${eventNameFilter}" in the selected beverage type. Showing overall data if available.`);
    } else if (chartData.length === 0 && events.length === 0) {
      setMessage("No past events or sales data available for analysis.");
    } else if (chartData.length === 0 && (selectedBeverageTypeFilter !== 'All' || eventNameFilter)) {
      setMessage(`No sales data found for the selected filter combination (Type: ${selectedBeverageTypeFilter}, Event: "${eventNameFilter || 'All'}").`);
    } else {
      setMessage(''); // Clear message if data is found
    }
  }, [allEventsRawData, eventNameFilter, selectedBeverageTypeFilter, beverageTypeCategories]);

  useEffect(() => {
    aggregateAndFilterChartData();
  }, [aggregateAndFilterChartData]);

  // --- Render Logic ---
  // Show loading if authentication is still in progress OR data is being fetched
  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="text-center text-gray-700 text-lg font-semibold">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          {authLoading ? 'Authenticating...' : 'Loading past event data...'}
        </div>
      </div>
    );
  }

  // If not loading and no user, redirect to login (handled by AuthContext/MainLayout)
  if (!user) {
    return null; // MainLayout or AuthProvider should handle redirection
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 p-4">
        <div className="text-center text-red-700 text-lg font-semibold">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 sm:p-10 font-inter text-gray-800">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <header className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Past Events Statistics</h1>
          <p className="text-lg">Analyze beverage consumption across your past events.</p>
        </header>

        <main className="p-6">
          {/* Filter Inputs */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg shadow-inner">
            <label htmlFor="event-filter" className="block text-lg font-medium text-blue-800 mb-2">
              Filter by Event Name:
            </label>
            <input
              type="text"
              id="event-filter"
              className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition duration-200 ease-in-out text-gray-700 placeholder-gray-400"
              placeholder="e.g., Summer Fest, Winter Gala"
              value={eventNameFilter}
              onChange={(e) => setEventNameFilter(e.target.value)}
            />

            <div className="mt-6">
              <label className="block text-lg font-medium text-blue-800 mb-2">
                Filter by Beverage Type:
              </label>
              <div className="flex flex-wrap gap-3">
                {['All', 'non-alcoholic', 'alcoholic'].map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedBeverageTypeFilter(type)}
                    className={`px-5 py-2 rounded-full font-semibold text-sm transition-all duration-200 ease-in-out shadow-md
                      ${selectedBeverageTypeFilter === type
                        ? 'bg-blue-600 text-white transform scale-105'
                        : 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                      }`}
                  >
                    {type === 'All' ? 'All Beverages' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {message && (
              <p className="mt-3 text-sm text-blue-600 italic">{message}</p>
            )}
          </div>

          {/* Bar Chart Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-center text-blue-700 mb-6">
              Beverage Consumption Breakdown ({selectedBeverageTypeFilter === 'All' ? 'All Types' : selectedBeverageTypeFilter.charAt(0).toUpperCase() + selectedBeverageTypeFilter.slice(1)} )
            </h2>
            {processedChartData.length > 0 ? (
              <CustomBarChart data={processedChartData} />
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
                <p className="text-lg font-medium">No beverage consumption data to display for this selection.</p>
                <p className="text-sm mt-2">Try adjusting your filters or ensure there are sales recorded for your past events.</p>
              </div>
            )}
          </section>

          {/* Additional Insights (Placeholder for future expansion) */}
          <section className="p-4 bg-gray-50 rounded-lg shadow-inner border border-gray-200">
            <h3 className="text-xl font-semibold text-blue-700 mb-4">Quick Insights:</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Overall analysis of all past events for trends.</li>
              <li>Identify top-selling beverages to inform future stock decisions.</li>
              <li>Compare performance across different event types or seasons.</li>
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              *This page provides a visual overview. For more detailed reports and projections, use the AI Chatbot.
            </p>
          </section>
        </main>

        <footer className="bg-gray-800 text-white p-4 text-center text-sm flex justify-between items-center">
          <p>&copy; {new Date().getFullYear()} Bar POS Analytics. All rights reserved.</p>
          {/* Chat with AI Button */}
          <button
            onClick={() => setIsChatModalOpen(true)}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.516 12.095 2 11.101 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9a1 1 0 100-2 1 1 0 000 2zm7-2a1 1 0 10-2 0 1 1 0 002 0zm-4 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>Chat with AI</span>
          </button>
        </footer>
      </div>

      {/* Chatbot Modal */}
      {user && ( // Only render if user exists, so user.email is available
        <ChatbotModal
          isOpen={isChatModalOpen}
          onClose={() => setIsChatModalOpen(false)}
          userEmail={user.email}
        />
      )}
    </div>
  );
};

export default StatsPage;
