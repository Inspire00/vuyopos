// app/(app)/currenteventsdashboard/page.jsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import Chatbot from '../../../components/Chatbot';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Helper function for budget bar color - NOT A HOOK, so it can be called conditionally
const getBudgetBarColorClass = (budgetPercentage) => {
    if (budgetPercentage < 50) {
        return 'bg-green-500';
    } else if (budgetPercentage >= 50 && budgetPercentage < 70) {
        return 'bg-amber-500'; // Amber for 50-69%
    } else { // >= 70%
        return 'bg-burgundy'; // Burgundy (red) for >= 70%
    }
};

export default function CurrentEventsDashboard() {
    const { user } = useAuth();
    // State to hold all active events and their real-time data
    // Structure: { eventId: { eventDetails: {}, beverages: { beverageId: {} }, orders: { orderId: {} }, mostSoldBeverages: [], leastSoldBeverage: null, hasSalesData: boolean } }
    const [activeEventsData, setActiveEventsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Refs to store unsubscribe functions for nested listeners, keyed by eventId
    const eventBeverageUnsubs = useRef({});
    const eventOrderUnsubs = useRef({});

    // Helper function to determine stock status color, text, and animation
    const getStockStatus = useCallback((currentStock, initialStock) => {
        if (initialStock === 0) {
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

    // Sales analysis function - takes raw orders and beverages (as a map) for an event
    const analyzeSalesData = useCallback((currentBeverages, orderMap) => {
        const beverageSales = new Map(); // Map: beverageId -> { name, imageUrl, price, totalQuantitySold }
        let totalSalesCount = 0;

        // Iterate over orderMap values (which are order objects)
        Object.values(orderMap || {}).forEach(order => {
            order.items.forEach(item => {
                totalSalesCount += item.quantity;
                if (beverageSales.has(item.beverageId)) {
                    const existing = beverageSales.get(item.beverageId);
                    existing.totalQuantitySold += item.quantity;
                    beverageSales.set(item.beverageId, existing);
                } else {
                    // Get full beverage data from the passed currentBeverages map
                    const fullBeverageData = currentBeverages[item.beverageId];
                    beverageSales.set(item.beverageId, {
                        beverageId: item.beverageId,
                        name: item.name,
                        imageUrl: fullBeverageData?.imageUrl || 'https://placehold.co/128x128/333333/FFFFFF?text=No+Image', // Fallback
                        price: item.pricePerUnit,
                        totalQuantitySold: item.quantity
                    });
                }
            });
        });

        if (totalSalesCount === 0) {
            return { mostSoldBeverages: [], leastSoldBeverage: null, hasSalesData: false };
        }

        const salesArray = Array.from(beverageSales.values());

        // Sort by totalQuantitySold descending for most sold
        salesArray.sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
        const mostSold = salesArray.slice(0, 2); // Get top 2

        // Filter for beverages with actual sales to find the least sold among them
        const soldBeverages = salesArray.filter(b => b.totalQuantitySold > 0);
        let leastSold = null;
        if (soldBeverages.length > 0) {
            // Sort by totalQuantitySold ascending for least sold (among those that sold)
            soldBeverages.sort((a, b) => a.totalQuantitySold - b.totalQuantitySold);
            leastSold = soldBeverages[0];
        }

        return { mostSoldBeverages: mostSold, leastSoldBeverage: leastSold, hasSalesData: true };
    }, []); // No dependencies that change frequently, as data is passed as arguments

    // Main effect to set up real-time listeners for all active events
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const qActiveEvents = query(
            collection(db, 'events'),
            where('eventManagerId', '==', user.uid),
            where('isActive', '==', true)
        );

        const unsubscribeEvents = onSnapshot(qActiveEvents, (snapshot) => {
            const currentActiveEventIds = new Set();
            const newActiveEventsData = {}; // Build the new state here

            snapshot.forEach(eventDoc => {
                const eventId = eventDoc.id;
                const eventData = { id: eventId, ...eventDoc.data() };
                currentActiveEventIds.add(eventId);

                // Initialize or update event details in the new state
                newActiveEventsData[eventId] = {
                    ...activeEventsData[eventId], // Preserve existing nested data (beverages, orders, sales analysis)
                    eventDetails: eventData, // Update event details
                    beverages: activeEventsData[eventId]?.beverages || {}, // Ensure beverages object exists
                    orders: activeEventsData[eventId]?.orders || {}, // Ensure orders object exists
                    // Preserve existing sales analysis results until new data arrives
                    mostSoldBeverages: activeEventsData[eventId]?.mostSoldBeverages || [],
                    leastSoldBeverage: activeEventsData[eventId]?.leastSoldBeverage || null,
                    hasSalesData: activeEventsData[eventId]?.hasSalesData || false,
                };

                // Setup or update beverage listener for this event
                if (!eventBeverageUnsubs.current[eventId]) {
                    const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', eventId));
                    const unsubBev = onSnapshot(qBeverages, (bevSnapshot) => {
                        const updatedBeverages = {};
                        bevSnapshot.forEach(bevDoc => {
                            updatedBeverages[bevDoc.id] = { id: bevDoc.id, ...bevDoc.data() };
                        });

                        setActiveEventsData(prev => {
                            const eventEntry = prev[eventId] || {};
                            // Re-analyze sales with the newly updated beverage data and existing orders
                            const salesAnalysis = analyzeSalesData(updatedBeverages, eventEntry.orders || {});
                            return {
                                ...prev,
                                [eventId]: {
                                    ...eventEntry,
                                    beverages: updatedBeverages,
                                    ...salesAnalysis, // Update sales analysis results
                                }
                            };
                        });
                    }, (err) => {
                        console.error(`Error listening to beverages for event ${eventId}:`, err);
                        toast.error(`Failed to load beverages for ${eventData.name}.`);
                    });
                    eventBeverageUnsubs.current[eventId] = unsubBev;
                }

                // Setup or update order listener for this event
                if (!eventOrderUnsubs.current[eventId]) {
                    const qOrders = query(collection(db, 'orders'), where('eventId', '==', eventId));
                    const unsubOrder = onSnapshot(qOrders, (orderSnapshot) => {
                        const updatedOrders = {};
                        orderSnapshot.forEach(orderDoc => {
                            updatedOrders[orderDoc.id] = { id: orderDoc.id, ...orderDoc.data() };
                        });

                        setActiveEventsData(prev => {
                            const eventEntry = prev[eventId] || {};
                            // Analyze sales with the newly updated order data and existing beverages
                            const salesAnalysis = analyzeSalesData(eventEntry.beverages || {}, updatedOrders);
                            return {
                                ...prev,
                                [eventId]: {
                                    ...eventEntry,
                                    orders: updatedOrders, // Store orders temporarily (can be removed if not needed for direct display)
                                    ...salesAnalysis, // Update sales analysis results
                                }
                            };
                        });
                    }, (err) => {
                        console.error(`Error listening to orders for event ${eventId}:`, err);
                        toast.error(`Failed to load sales data for ${eventData.name}.`);
                    });
                    eventOrderUnsubs.current[eventId] = unsubOrder;
                }
            });

            // Clean up listeners for events that are no longer active
            Object.keys(activeEventsData).forEach(eventId => {
                if (!currentActiveEventIds.has(eventId)) {
                    // This event was active, but is no longer in the snapshot, so it's deactivated/removed
                    if (eventBeverageUnsubs.current[eventId]) {
                        eventBeverageUnsubs.current[eventId]();
                        delete eventBeverageUnsubs.current[eventId];
                    }
                    if (eventOrderUnsubs.current[eventId]) {
                        eventOrderUnsubs.current[eventId]();
                        delete eventOrderUnsubs.current[eventId];
                    }
                    delete newActiveEventsData[eventId]; // Remove from the new state
                }
            });

            setActiveEventsData(newActiveEventsData); // Set the new, complete state
            setLoading(false);
        }, (err) => {
            console.error("Error listening to active events:", err);
            setError("Failed to load active events dashboard.");
            setLoading(false);
        });

        // Cleanup function for the main events listener
        return () => {
            console.log("Cleaning up all dashboard listeners.");
            unsubscribeEvents(); // Unsubscribe the main event listener
            // Unsubscribe all nested beverage listeners
            Object.values(eventBeverageUnsubs.current).forEach(unsub => unsub());
            eventBeverageUnsubs.current = {}; // Clear the ref
            // Unsubscribe all nested order listeners
            Object.values(eventOrderUnsubs.current).forEach(unsub => unsub());
            eventOrderUnsubs.current = {}; // Clear the ref
        };
    }, [user, analyzeSalesData]); // Depend on user and analyzeSalesData

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
                        {sortedActiveEvents.map(({ eventDetails, beverages, mostSoldBeverages, leastSoldBeverage, hasSalesData }) => {
                            if (!eventDetails) return null; // Skip if eventDetails somehow missing

                            // Budget calculation for this specific event
                            const budgetPercentage = (eventDetails.currentSpend / eventDetails.budget) * 100;
                            // Use the helper function here
                            const budgetBarColor = getBudgetBarColorClass(budgetPercentage);

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
                                        <h3 className="text-lg font-semibold text-cream-white mb-2">Bar Budget Status</h3>
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

                                    {/* Beverage Stock Section */}
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-6">
                                        <h3 className="text-xl font-semibold text-cream-white mb-3">Beverage Stock Levels</h3>
                                        {sortedBeverages.length === 0 ? (
                                            <p className="text-cream-white text-center py-4">No beverages added for this event.</p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {sortedBeverages.map(beverage => {
                                                    const { color, text, animation } = getStockStatus(beverage.currentStock, beverage.initialStock);
                                                    const soldQuantity = beverage.initialStock - beverage.currentStock;

                                                    return (
                                                        <li key={beverage.id} className="bg-rich-black p-3 rounded-md border border-dark-charcoal">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-semibold text-cream-white">{beverage.name}</span>
                                                                <span className={`text-sm font-bold ${color} ${animation}`}>{text}</span>
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

                                    {/* Sales Statistics Section */}
                                    <div className="mt-auto pt-6 border-t border-dark-charcoal">
                                        <h3 className="text-xl font-semibold text-cream-white mb-3">Sales Performance</h3>
                                        {!hasSalesData ? (
                                            <p className="text-cream-white text-center py-4">No sales data recorded for this event yet.</p>
                                        ) : (
                                            <>
                                                {mostSoldBeverages && mostSoldBeverages.length > 0 && (
                                                    <div className="mb-4">
                                                        <h4 className="text-lg font-semibold text-secondary-gold mb-2">Crowd Favourite Beverages</h4>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            {mostSoldBeverages.map(beverage => (
                                                                <div key={beverage.beverageId} className="flex items-center bg-rich-black p-3 rounded-md border border-dark-charcoal">
                                                                    <img
                                                                        src={beverage.imageUrl}
                                                                        alt={beverage.name}
                                                                        className="w-10 h-10 object-contain rounded-md mr-3 border border-gray-700"
                                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/40x40/333333/FFFFFF?text=No+Image'; }}
                                                                    />
                                                                    <div>
                                                                        <p className="text-cream-white font-semibold">{beverage.name}</p>
                                                                        <p className="text-primary-gold text-sm">Sold: {beverage.totalQuantitySold}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {leastSoldBeverage && (
                                                    <div>
                                                        <h4 className="text-lg font-semibold text-burgundy mb-2">Unpopular Beverage</h4>
                                                        <div className="flex items-center bg-rich-black p-3 rounded-md border border-dark-charcoal">
                                                            <img
                                                                src={leastSoldBeverage.imageUrl}
                                                                alt={leastSoldBeverage.name}
                                                                className="w-10 h-10 object-contain rounded-md mr-3 border border-gray-700"
                                                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/40x40/333333/FFFFFF?text=No+Image'; }}
                                                            />
                                                            <div>
                                                                <p className="text-cream-white font-semibold">{leastSoldBeverage.name}</p>
                                                                <p className="text-primary-gold text-sm">Sold: {leastSoldBeverage.totalQuantitySold}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
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
