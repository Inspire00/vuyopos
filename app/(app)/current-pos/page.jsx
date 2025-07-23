// app/(app)/current-pos/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot, runTransaction, Timestamp, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link';
// import Image from 'next/image'; // Removed Next.js Image import

export default function CurrentPOSPage() {
  const { user } = useAuth();
  const [allActiveEvents, setAllActiveEvents] = useState([]); // Stores all active events for the user
  const [selectedEventId, setSelectedEventId] = useState(''); // Stores the ID of the currently selected active event for POS
  const [currentEventData, setCurrentEventData] = useState(null); // Stores the full data of the selected active event
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingQuantities, setEditingQuantities] = useState({});

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editedBudget, setEditedBudget] = useState('');

  const allCategories = useMemo(() => {
    const categories = new Set();
    beverages.forEach(b => categories.add(b.category));
    return ['All', ...Array.from(categories)].sort();
  }, [beverages]);

  const filteredBeverages = useMemo(() => {
    if (selectedCategory === 'All') {
      return beverages;
    }
    return beverages.filter(b => b.category === selectedCategory);
  }, [beverages, selectedCategory]);

  const currentOrderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  }, [orderItems]);

  // Function to fetch all active events for the user
  const fetchAllActiveEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const qEvents = query(collection(db, 'events'), where('eventManagerId', '==', user.uid), where('isActive', '==', true));
      const eventSnapshot = await getDocs(qEvents);
      const fetchedEvents = eventSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllActiveEvents(fetchedEvents);

      // If there are active events, set the first one as selected by default
      if (fetchedEvents.length > 0) {
        setSelectedEventId(fetchedEvents[0].id);
      } else {
        setSelectedEventId('');
        setCurrentEventData(null);
      }
    } catch (error) {
      console.error('Error fetching active events:', error);
      toast.error('Failed to load active events.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Effect to initially fetch all active events when user loads
  useEffect(() => {
    if (user) {
      fetchAllActiveEvents();
    }
  }, [user, fetchAllActiveEvents]);

  // Function to set up real-time listeners for the currently selected event and its beverages
  const setupPOSListeners = useCallback(() => {
    let unsubscribeEvent = () => {};
    let unsubscribeBeverages = () => {};

    if (selectedEventId) {
      // Listener for the selected active event document
      unsubscribeEvent = onSnapshot(doc(db, 'events', selectedEventId), (docSnap) => {
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() };
          setCurrentEventData(eventData);
          if (!isEditingBudget) {
            setEditedBudget(String(eventData.budget));
          }
        } else {
          // Selected event was deactivated or deleted
          setCurrentEventData(null);
          setBeverages([]);
          setOrderItems([]); // Clear order if event is gone
          toast(`The selected event (${selectedEventId}) was deactivated or deleted.`, { icon: '⚠️' });
          // Optionally, reset selectedEventId or prompt user to select another
          setSelectedEventId('');
        }
      }, (error) => {
        console.error("Error listening to selected event:", error);
        toast.error("Failed to listen for selected event updates.");
      });

      // Listener for beverages of the selected active event
      const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', selectedEventId));
      unsubscribeBeverages = onSnapshot(qBeverages, (snapshot) => {
        const fetchedBeverages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBeverages(fetchedBeverages);
      }, (error) => {
        console.error("Error listening to beverages:", error);
        toast.error("Failed to listen for beverage updates.");
      });
    } else {
      // No event selected, clear current event data and beverages
      setCurrentEventData(null);
      setBeverages([]);
    }

    // Cleanup function for listeners
    return () => {
      unsubscribeEvent();
      unsubscribeBeverages();
    };
  }, [selectedEventId, isEditingBudget]); // Rerun when selectedEventId or isEditingBudget changes

  // Effect to manage listeners based on selectedEventId
  useEffect(() => {
    const cleanup = setupPOSListeners();
    return cleanup;
  }, [setupPOSListeners]);

  // Effect to synchronize editingQuantities with orderItems
  useEffect(() => {
    const newEditingQuantities = {};
    orderItems.forEach(item => {
      newEditingQuantities[item.beverageId] = String(item.quantity);
    });
    setEditingQuantities(newEditingQuantities);
  }, [orderItems]);

  const handleAddItem = (beverage) => {
    setOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.beverageId === beverage.id);
      const currentBeverageData = beverages.find(b => b.id === beverage.id);

      if (!currentBeverageData || currentBeverageData.currentStock <= 0) {
        toast.error(`No ${beverage.name} in stock!`);
        return prevItems;
      }

      if (existingItem) {
        if (currentBeverageData.currentStock < existingItem.quantity + 1) {
          toast.error(`Not enough ${beverage.name} in stock! Available: ${currentBeverageData.currentStock}`);
          return prevItems;
        }
        return prevItems.map(item =>
          item.beverageId === beverage.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        if (currentBeverageData.currentStock < 1) {
          toast.error(`No ${beverage.name} in stock!`);
          return prevItems;
        }
        return [...prevItems, {
          beverageId: beverage.id,
          name: beverage.name,
          quantity: 1,
          pricePerUnit: beverage.price,
        }];
      }
    });
  };

  const handleUpdateItemQuantity = (beverageId, delta) => {
    setOrderItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.beverageId === beverageId);
      if (itemIndex === -1) return prevItems;

      const item = prevItems[itemIndex];
      const beverageInStock = beverages.find(b => b.id === beverageId);

      if (!beverageInStock) return prevItems;

      const newQuantity = item.quantity + delta;

      if (newQuantity <= 0) {
        setEditingQuantities(prev => {
            const newState = { ...prev };
            delete newState[beverageId];
            return newState;
        });
        return prevItems.filter(i => i.beverageId !== beverageId);
      }
      if (newQuantity > beverageInStock.currentStock) {
        toast.error(`Cannot add more. Only ${beverageInStock.currentStock} left of ${item.name}.`);
        setEditingQuantities(prev => ({ ...prev, [beverageId]: String(beverageInStock.currentStock) }));
        return prevItems.map(i =>
          i.beverageId === beverageId
            ? { ...i, quantity: beverageInStock.currentStock }
            : i
        );
      }

      return prevItems.map(i =>
        i.beverageId === beverageId
          ? { ...i, quantity: newQuantity }
          : i
      );
    });
  };

  const handleSetItemQuantity = (beverageId, value) => {
    setEditingQuantities(prev => ({ ...prev, [beverageId]: value }));

    if (value === '') {
      return;
    }

    const parsedQuantity = parseInt(value, 10);

    setOrderItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.beverageId === beverageId);
      if (itemIndex === -1) return prevItems;

      const beverageInStock = beverages.find(b => b.id === beverageId);
      if (!beverageInStock) return prevItems;

      const newQuantity = isNaN(parsedQuantity) || parsedQuantity < 0 ? 0 : parsedQuantity;

      if (newQuantity === 0) {
        setEditingQuantities(prev => {
            const newState = { ...prev };
            delete newState[beverageId];
            return newState;
        });
        return prevItems.filter(i => i.beverageId !== beverageId);
      }

      if (newQuantity > beverageInStock.currentStock) {
        toast.error(`Cannot set quantity to ${newQuantity}. Only ${beverageInStock.currentStock} left of ${beverageInStock.name}.`);
        setEditingQuantities(prev => ({ ...prev, [beverageId]: String(beverageInStock.currentStock) }));
        return prevItems.map(i =>
          i.beverageId === beverageId
            ? { ...i, quantity: beverageInStock.currentStock }
            : i
        );
      }

      return prevItems.map(i =>
        i.beverageId === beverageId
          ? { ...i, quantity: newQuantity }
          : i
      );
    });
  };

  const handleRemoveItem = (beverageId) => {
    setOrderItems(prevItems => prevItems.filter(item => item.beverageId !== beverageId));
    setEditingQuantities(prev => {
        const newState = { ...prev };
        delete newState[beverageId];
        return newState;
    });
  };

  const handleUpdateBudget = async (newValue) => {
    setIsEditingBudget(false);

    const parsedBudget = parseFloat(newValue);

    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      toast.error('Budget must be a positive number.');
      setEditedBudget(String(currentEventData.budget));
      return;
    }

    if (parsedBudget < currentEventData.currentSpend) {
      toast.error(`New budget cannot be less than current spend (R ${currentEventData.currentSpend.toFixed(2)}).`);
      setEditedBudget(String(currentEventData.budget));
      return;
    }

    if (parsedBudget === currentEventData.budget) {
      return;
    }

    setLoading(true);
    try {
      const eventRef = doc(db, 'events', currentEventData.id);
      await updateDoc(eventRef, {
        budget: parsedBudget,
        updatedAt: Timestamp.now(),
      });
      toast.success('Budget updated successfully!');
    } catch (error) {
      console.error('Error updating budget:', error);
      toast.error('Failed to update budget.');
      setEditedBudget(String(currentEventData.budget));
    } finally {
      setLoading(false);
    }
  };

  const handleChargeOrder = async () => {
    if (!currentEventData || orderItems.length === 0) {
      toast.error('No items in order or no active event selected.');
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', currentEventData.id);
        const eventDocPromise = transaction.get(eventRef);

        const beverageDocPromises = orderItems.map(item =>
          transaction.get(doc(db, 'beverages', item.beverageId))
        );

        const [eventDoc, ...beverageDocs] = await Promise.all([eventDocPromise, ...beverageDocPromises]);

        if (!eventDoc.exists()) {
          throw new Error('Active event does not exist!');
        }
        const currentEvent = eventDoc.data();
        const newSpend = currentEvent.currentSpend + currentOrderTotal;

        if (newSpend > currentEvent.budget) {
          console.warn('Warning: This order will exceed the bar budget!');
        }

        const updatedBeveragesData = {};
        const dbOrderItems = [];

        for (let i = 0; i < orderItems.length; i++) {
          const item = orderItems[i];
          const beverageDoc = beverageDocs[i];

          if (!beverageDoc.exists()) {
            throw new Error(`Beverage "${item.name}" not found in database!`);
          }

          const currentBeverage = beverageDoc.data();
          const newStock = currentBeverage.currentStock - item.quantity;

          if (newStock < 0) {
            throw new Error(`Not enough stock for "${item.name}". Available: ${currentBeverage.currentStock}, Ordered: ${item.quantity}.`);
          }
          updatedBeveragesData[item.beverageId] = { currentStock: newStock, updatedAt: Timestamp.now() };
          dbOrderItems.push(item);
        }

        transaction.update(eventRef, {
          currentSpend: newSpend,
          updatedAt: Timestamp.now(),
        });

        for (const beverageId in updatedBeveragesData) {
          const data = updatedBeveragesData[beverageId];
          transaction.update(doc(db, 'beverages', beverageId), data);
        }

        const ordersCollectionRef = collection(db, 'orders');
        transaction.set(doc(ordersCollectionRef), {
          eventId: currentEventData.id, // Use the selected event's ID
          timestamp: Timestamp.now(),
          totalAmount: currentOrderTotal,
          items: dbOrderItems,
          eventManagerId: user.uid,
        });
      });

      toast.success('Order processed successfully!');
      setOrderItems([]);
      setEditingQuantities({});
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error(`Order failed: ${error.message || 'An unknown error occurred.'}`);
    } finally {
      setLoading(false);
    }
  };

  const budgetPercentage = currentEventData ? (currentEventData.currentSpend / currentEventData.budget) * 100 : 0;
  const budgetBarColor = budgetPercentage >= 90 ? 'bg-burgundy' : budgetPercentage >= 70 ? 'bg-orange-500' : 'bg-primary-gold';

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-xl text-center">Loading POS...</div>
      </MainLayout>
    );
  }

  // If no active events exist at all for the user
  if (allActiveEvents.length === 0) {
    return (
      <MainLayout>
        <div className="p-6 bg-deep-navy m-4 rounded-lg text-cream-white text-center border border-burgundy shadow-lg">
          <p className="text-xl mb-4 font-semibold">No active events found.</p>
          <p className="mb-6">
            Please go to the <Link href="/events" className="text-secondary-gold hover:underline font-bold">Events page</Link> to create or set an event as active to use the POS.
          </p>
          <Link href="/events" className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-3 px-6 rounded-lg transition-colors duration-200">
            Go to Events
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-64px)] p-4 space-y-4 lg:space-y-0 lg:space-x-4">
        {/* Left Section: Beverages */}
        <div className="flex-1 bg-deep-navy rounded-lg shadow-xl p-4 lg:p-6 border border-primary-gold overflow-hidden flex flex-col">
          <h2 className="text-2xl font-bold text-cream-white mb-4">
            Current Point of Sale
          </h2>

          {/* Event Selector */}
          <div className="mb-4">
            <label htmlFor="pos-event-select" className="block text-cream-white text-sm font-bold mb-2">
              Select Active Event for POS:
            </label>
            <select
              id="pos-event-select"
              className="shadow border border-dark-charcoal rounded w-full md:w-1/2 py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setOrderItems([]); // Clear order when switching events
                setEditingQuantities({});
              }}
            >
              {allActiveEvents.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} ({new Date(event.date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {currentEventData ? (
            <>
              {/* Budget Tracker for selected event */}
              <div className="mb-6 p-4 bg-dark-charcoal rounded-md border border-primary-gold">
                <h3 className="text-lg font-semibold text-cream-white mb-2">Bar Budget Status: {currentEventData.name}</h3>
                <div className="text-cream-white text-sm mb-2">
                  <span className="font-bold text-secondary-gold">Spent:</span> R {currentEventData.currentSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /{' '}
                  <span className="font-bold text-primary-gold">Budget:</span>{' '}
                  {isEditingBudget ? (
                    <input
                      type="number"
                      value={editedBudget}
                      onChange={(e) => setEditedBudget(e.target.value)}
                      onBlur={(e) => handleUpdateBudget(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      className="bg-rich-black text-primary-gold font-bold py-1 px-2 rounded-md w-28 text-right focus:outline-none focus:border-secondary-gold"
                      min={currentEventData.currentSpend}
                      step="0.01"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="font-bold text-primary-gold cursor-pointer hover:underline"
                      onClick={() => {
                        setIsEditingBudget(true);
                        setEditedBudget(String(currentEventData.budget));
                      }}
                    >
                      R {currentEventData.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
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

              {/* Category Filter */}
              <div className="mb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {allCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mr-2 mb-2 transition-colors duration-200
                      ${selectedCategory === category
                        ? 'bg-secondary-gold text-rich-black shadow-md'
                        : 'bg-dark-charcoal text-cream-white hover:bg-gray-700'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Beverage Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-primary-gold scrollbar-track-dark-charcoal">
                {filteredBeverages.length === 0 ? (
                  <p className="col-span-full text-cream-white text-center py-8">
                    No beverages found for this category or event.
                    <br />
                    <Link href="/beverages" className="text-secondary-gold hover:underline">Add some now!</Link>
                  </p>
                ) : (
                  filteredBeverages.map(beverage => (
                    <button
                      key={beverage.id}
                      onClick={() => handleAddItem(beverage)}
                      className="bg-rich-black p-3 rounded-lg shadow-md border border-dark-charcoal hover:border-secondary-gold transform hover:scale-[1.03] transition-transform duration-200 flex flex-col items-center text-center disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={beverage.currentStock <= 0}
                    >
                      {beverage.imageUrl && (
                        <div className="w-full h-24 sm:h-32 relative mb-2">
                          <img
                            src={beverage.imageUrl}
                            alt={beverage.name}
                            className="object-cover rounded-md mb-2 border border-dark-charcoal w-full h-full" // Use w-full h-full for object-cover
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/128x128/333333/FFFFFF?text=No+Image'; }} // Fallback
                          />
                        </div>
                      )}
                      <h3 className="text-md font-semibold text-cream-white truncate w-full mb-1">{beverage.name}</h3>
                      <p className="text-sm text-primary-gold mb-1">R {beverage.price.toFixed(2)}</p>
                      <p className="text-xs text-cream-white">Stock: {beverage.currentStock}</p>
                      {beverage.currentStock <= 0 && <span className="text-burgundy text-xs font-bold mt-1">OUT OF STOCK</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="bg-deep-navy p-6 rounded-lg text-cream-white text-center border border-burgundy">
              <p className="text-lg mb-4">Please select an active event from the dropdown above to start POS operations.</p>
            </div>
          )}
        </div>

        {/* Right Section: Order Cart */}
        <div className="w-full lg:w-1/3 bg-deep-navy rounded-lg shadow-xl p-4 lg:p-6 border border-primary-gold flex flex-col">
          <h2 className="text-2xl font-bold text-cream-white mb-4">Current Order</h2>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary-gold scrollbar-track-dark-charcoal">
            {orderItems.length === 0 ? (
              <p className="text-cream-white text-center py-8">No items added yet. Click on beverages to add them to the order.</p>
            ) : (
              orderItems.map(item => (
                <div key={item.beverageId} className="flex items-center justify-between bg-rich-black p-3 rounded-md mb-3 border border-dark-charcoal">
                  <div>
                    <p className="text-cream-white font-semibold">{item.name}</p>
                    <p className="text-primary-gold text-sm">R {item.pricePerUnit.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdateItemQuantity(item.beverageId, -1)}
                      className="bg-dark-charcoal text-cream-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={editingQuantities[item.beverageId] !== undefined ? editingQuantities[item.beverageId] : String(item.quantity)}
                      onChange={(e) => handleSetItemQuantity(item.beverageId, e.target.value)}
                      className="bg-rich-black text-cream-white text-lg font-bold w-16 text-center rounded-md border border-dark-charcoal focus:outline-none focus:border-secondary-gold"
                      min="0"
                    />
                    <button
                      onClick={() => handleUpdateItemQuantity(item.beverageId, 1)}
                      className="bg-dark-charcoal text-cream-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.beverageId)}
                      className="bg-burgundy text-cream-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-dark-charcoal">
            <div className="flex justify-between items-center text-cream-white text-2xl font-bold mb-4">
              <span>Total:</span>
              <span>R {currentOrderTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={handleChargeOrder}
              className="w-full bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-4 rounded-lg text-xl transition-colors duration-200 disabled:opacity-50"
              disabled={loading || orderItems.length === 0 || !currentEventData}
            >
              {loading ? 'Processing...' : 'Charge Order'}
            </button>
            <button
              onClick={() => {
                setOrderItems([]);
                setEditingQuantities({});
              }}
              className="w-full bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-3 mt-3 rounded-lg text-lg transition-colors duration-200 disabled:opacity-50"
              disabled={loading || orderItems.length === 0 || !currentEventData}
            >
              Clear Order
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}