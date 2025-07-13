// app/(app)/current-pos/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot, runTransaction, Timestamp, updateDoc } from 'firebase/firestore'; // Added updateDoc
import toast from 'react-hot-toast';
import Link from 'next/link';
// Removed 'Image' import to use standard <img> tag
// import Image from 'next/image';

export default function CurrentPOSPage() {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState(null);
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  // New state to manage the string value of quantity inputs for better UX
  const [editingQuantities, setEditingQuantities] = useState({});

  // New states for budget editing
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editedBudget, setEditedBudget] = useState('');

  // Memoized list of all unique beverage categories for filtering
  const allCategories = useMemo(() => {
    const categories = new Set();
    beverages.forEach(b => categories.add(b.category));
    return ['All', ...Array.from(categories)].sort();
  }, [beverages]);

  // Memoized filtered list of beverages based on selected category
  const filteredBeverages = useMemo(() => {
    if (selectedCategory === 'All') {
      return beverages;
    }
    return beverages.filter(b => b.category === selectedCategory);
  }, [beverages, selectedCategory]);

  // Memoized calculation of the current order's total amount
  const currentOrderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  }, [orderItems]);

  // Effect to fetch active event and set up real-time listeners when user is available
  // Wrapped in useCallback to stabilize the function for useEffect dependency
  const fetchActiveEventAndListenForUpdates = useCallback(() => {
    if (!user) return () => {}; // Return no-op cleanup if no user

    setLoading(true);
    let unsubscribeEvent = () => {}; // Placeholder for event listener unsubscribe
    let unsubscribeBeverages = () => {}; // Placeholder for beverages listener unsubscribe

    const setupListeners = async () => {
      try {
        // 1. Find the active event (one-time fetch)
        const qEvents = query(
          collection(db, 'events'),
          where('eventManagerId', '==', user.uid),
          where('isActive', '==', true)
        );
        const eventSnapshot = await getDocs(qEvents);

        if (eventSnapshot.empty) {
          setActiveEvent(null);
          setBeverages([]);
          setLoading(false);
          return; // No active event, so no listeners to set up
        }

        const activeEvtData = eventSnapshot.docs[0];
        const activeEvtId = activeEvtData.id;

        // 2. Set up real-time listener for the active event document
        unsubscribeEvent = onSnapshot(doc(db, 'events', activeEvtId), (docSnap) => {
          if (docSnap.exists()) {
            const eventData = { id: docSnap.id, ...docSnap.data() };
            setActiveEvent(eventData);
            // When activeEvent updates, ensure editedBudget reflects the current budget
            if (!isEditingBudget) { // Only update if not currently editing to avoid overwriting user input
                setEditedBudget(String(eventData.budget));
            }
          } else {
            // Active event was deleted or deactivated from outside
            setActiveEvent(null);
            setBeverages([]); // Clear beverages if event is gone
            toast('The current event was deactivated or deleted.', { icon: '⚠️' });
            // Also unsubscribe from beverage listener if event is gone
            unsubscribeBeverages();
          }
        }, (error) => {
          console.error("Error listening to active event:", error);
          toast.error("Failed to listen for active event updates.");
        });

        // 3. Set up real-time listener for beverages of the active event
        const qBeverages = query(
          collection(db, 'beverages'),
          where('eventId', '==', activeEvtId)
        );
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

      } catch (error) {
        console.error('Error setting up POS listeners:', error);
        toast.error('Failed to load POS data.');
        // Ensure any partially set up listeners are cleaned up on error
        unsubscribeEvent();
        unsubscribeBeverages();
      } finally {
        setLoading(false);
      }
    };

    setupListeners(); // Call the async function to set up listeners

    // Return a combined cleanup function for the useEffect hook
    return () => {
      unsubscribeEvent();
      unsubscribeBeverages();
    };
  }, [user, isEditingBudget]); // Rerun when user object changes, and when editing state changes

  useEffect(() => {
    if (user) {
      const cleanup = fetchActiveEventAndListenForUpdates();
      return cleanup;
    }
  }, [user, fetchActiveEventAndListenForUpdates]);

  // Effect to synchronize editingQuantities with orderItems
  useEffect(() => {
    const newEditingQuantities = {};
    orderItems.forEach(item => {
      newEditingQuantities[item.beverageId] = String(item.quantity);
    });
    setEditingQuantities(newEditingQuantities);
  }, [orderItems]);


  /**
   * Handles adding a beverage to the current order.
   * Performs stock validation against the current `beverages` state.
   * @param {object} beverage - The beverage object to add.
   */
  const handleAddItem = (beverage) => {
    setOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.beverageId === beverage.id);
      // Find the most current stock data from the `beverages` state
      const currentBeverageData = beverages.find(b => b.id === beverage.id);

      // If beverage data is somehow missing or stock is 0, prevent adding
      if (!currentBeverageData || currentBeverageData.currentStock <= 0) {
        toast.error(`No ${beverage.name} in stock!`);
        return prevItems;
      }

      if (existingItem) {
        // Check if adding one more exceeds current stock
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
        // If it's a new item, ensure there's at least 1 in stock
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

  /**
   * Handles updating the quantity of an item in the current order.
   * @param {string} beverageId - The ID of the beverage to update.
   * @param {number} delta - The change in quantity (+1 for increment, -1 for decrement).
   */
  const handleUpdateItemQuantity = (beverageId, delta) => {
    setOrderItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.beverageId === beverageId);
      if (itemIndex === -1) return prevItems; // Item not found in order

      const item = prevItems[itemIndex];
      // Get the most current stock data from the `beverages` state
      const beverageInStock = beverages.find(b => b.id === beverageId);

      if (!beverageInStock) return prevItems; // Should not happen if item was added correctly

      const newQuantity = item.quantity + delta;

      if (newQuantity <= 0) {
        // If quantity becomes 0 or less, remove the item from the order
        // Also clean up from editingQuantities state
        setEditingQuantities(prev => {
            const newState = { ...prev };
            delete newState[beverageId];
            return newState;
        });
        return prevItems.filter(i => i.beverageId !== beverageId);
      }
      // Check if the new quantity exceeds the available stock
      if (newQuantity > beverageInStock.currentStock) {
        toast.error(`Cannot add more. Only ${beverageInStock.currentStock} left of ${item.name}.`);
        // Update the editingQuantities to reflect the max available, so input snaps back
        setEditingQuantities(prev => ({ ...prev, [beverageId]: String(beverageInStock.currentStock) }));
        return prevItems.map(i =>
          i.beverageId === beverageId
            ? { ...i, quantity: beverageInStock.currentStock } // Set to max available
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

  /**
   * Handles direct input of quantity for an item in the current order.
   * Updates `editingQuantities` immediately for visual feedback.
   * Only updates `orderItems` when a valid number is entered.
   * @param {string} beverageId - The ID of the beverage to update.
   * @param {string} value - The new quantity value from the input field (can be empty string).
   */
  const handleSetItemQuantity = (beverageId, value) => {
    // Update the local editing state immediately for visual feedback
    setEditingQuantities(prev => ({ ...prev, [beverageId]: value }));

    // If the value is an empty string, do not process it further for orderItems update yet
    // This allows the user to clear the field before typing a new number without removing the item
    if (value === '') {
      return;
    }

    const parsedQuantity = parseInt(value, 10);

    setOrderItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.beverageId === beverageId);
      if (itemIndex === -1) return prevItems;

      const beverageInStock = beverages.find(b => b.id === beverageId);
      if (!beverageInStock) return prevItems;

      // If parsedQuantity is NaN (e.g., user types non-numeric characters) or negative, treat as 0 for removal
      const newQuantity = isNaN(parsedQuantity) || parsedQuantity < 0 ? 0 : parsedQuantity;

      if (newQuantity === 0) {
        // If quantity becomes 0 or less, remove the item from the order
        // Also clean up from editingQuantities state
        setEditingQuantities(prev => {
            const newState = { ...prev };
            delete newState[beverageId];
            return newState;
        });
        return prevItems.filter(i => i.beverageId !== beverageId);
      }

      if (newQuantity > beverageInStock.currentStock) {
        toast.error(`Cannot set quantity to ${newQuantity}. Only ${beverageInStock.currentStock} left of ${beverageInStock.name}.`);
        // Revert the input field to the max available stock
        setEditingQuantities(prev => ({ ...prev, [beverageId]: String(beverageInStock.currentStock) }));
        return prevItems.map(i =>
          i.beverageId === beverageId
            ? { ...i, quantity: beverageInStock.currentStock } // Set to max available
            : i
        );
      }

      // If valid and within stock, update the order item's quantity
      return prevItems.map(i =>
        i.beverageId === beverageId
          ? { ...i, quantity: newQuantity }
          : i
      );
    });
  };

  /**
   * Handles removing an item completely from the current order.
   * @param {string} beverageId - The ID of the beverage to remove.
   */
  const handleRemoveItem = (beverageId) => {
    setOrderItems(prevItems => prevItems.filter(item => item.beverageId !== beverageId));
    // Also clean up from editingQuantities state
    setEditingQuantities(prev => {
        const newState = { ...prev };
        delete newState[beverageId];
        return newState;
    });
  };

  /**
   * Handles updating the event budget.
   * @param {string} newValue - The new budget value from the input field.
   */
  const handleUpdateBudget = async (newValue) => {
    setIsEditingBudget(false); // Exit editing mode immediately

    const parsedBudget = parseFloat(newValue);

    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      toast.error('Budget must be a positive number.');
      // Revert the input field to the previous valid budget
      setEditedBudget(String(activeEvent.budget));
      return;
    }

    // Ensure new budget is not less than current spend
    if (parsedBudget < activeEvent.currentSpend) {
      toast.error(`New budget cannot be less than current spend (R ${activeEvent.currentSpend.toFixed(2)}).`);
      // Revert the input field to the previous valid budget
      setEditedBudget(String(activeEvent.budget));
      return;
    }

    // Only update if the value has actually changed to avoid unnecessary writes
    if (parsedBudget === activeEvent.budget) {
      return;
    }

    setLoading(true); // Show loading while saving
    try {
      const eventRef = doc(db, 'events', activeEvent.id);
      await updateDoc(eventRef, {
        budget: parsedBudget,
        updatedAt: Timestamp.now(),
      });
      toast.success('Budget updated successfully!');
    } catch (error) {
      console.error('Error updating budget:', error);
      toast.error('Failed to update budget.');
      // Revert the input field on error
      setEditedBudget(String(activeEvent.budget));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Processes the entire order as a Firestore transaction.
   * Updates event spend, beverage stock, and records the new order.
   */
  const handleChargeOrder = async () => {
    if (!activeEvent || orderItems.length === 0) {
      toast.error('No items in order or no active event.');
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // --- 1. ALL READS FIRST ---
        // Get references to the documents we need to read
        const eventRef = doc(db, 'events', activeEvent.id);
        // Get promise for the active event document
        const eventDocPromise = transaction.get(eventRef);

        // Create an array of promises for all beverage documents in the order
        const beverageDocPromises = orderItems.map(item =>
          transaction.get(doc(db, 'beverages', item.beverageId))
        );

        // Await all read promises simultaneously
        const [eventDoc, ...beverageDocs] = await Promise.all([eventDocPromise, ...beverageDocPromises]);

        // --- 2. VALIDATION AND CALCULATIONS (after all reads are complete) ---
        // Validate event existence
        if (!eventDoc.exists()) {
          throw new Error('Active event does not exist!');
        }
        const currentEvent = eventDoc.data();
        const newSpend = currentEvent.currentSpend + currentOrderTotal;

        // Warn if budget is exceeded (this warning will be caught by the outer catch and shown as a toast)
        if (newSpend > currentEvent.budget) {
          console.warn('Warning: This order will exceed the bar budget!');
          // You could choose to throw an error here to prevent the transaction if budget is strict
          // throw new Error('Budget exceeded!');
        }

        const updatedBeveragesData = {}; // Object to store new stock values for each beverage
        const dbOrderItems = []; // Array to store final order items for the new order document

        // Iterate through order items to validate stock and prepare updates
        for (let i = 0; i < orderItems.length; i++) {
          const item = orderItems[i];
          const beverageDoc = beverageDocs[i]; // Get the pre-fetched beverage document

          if (!beverageDoc.exists()) {
            throw new Error(`Beverage "${item.name}" not found in database!`);
          }

          const currentBeverage = beverageDoc.data();
          const newStock = currentBeverage.currentStock - item.quantity;

          if (newStock < 0) {
            throw new Error(`Not enough stock for "${item.name}". Available: ${currentBeverage.currentStock}, Ordered: ${item.quantity}.`);
          }
          // Store the new stock and update timestamp for later write
          updatedBeveragesData[item.beverageId] = { currentStock: newStock, updatedAt: Timestamp.now() };
          dbOrderItems.push(item); // Add item to the list for the order record
        }

        // --- 3. ALL WRITES LAST (after all reads and validations are complete) ---
        // Update the event's current spend
        transaction.update(eventRef, {
          currentSpend: newSpend,
          updatedAt: Timestamp.now(),
        });

        // Update stock for each beverage in the order
        for (const beverageId in updatedBeveragesData) {
          const data = updatedBeveragesData[beverageId];
          transaction.update(doc(db, 'beverages', beverageId), data);
        }

        // Create a new order document
        const ordersCollectionRef = collection(db, 'orders');
        transaction.set(doc(ordersCollectionRef), {
          eventId: activeEvent.id,
          timestamp: Timestamp.now(),
          totalAmount: currentOrderTotal,
          items: dbOrderItems,
          eventManagerId: user.uid, // Store event manager ID for easier query/security later
        });
      });

      // If transaction succeeds
      toast.success('Order processed successfully!');
      setOrderItems([]); // Clear the order cart
      setEditingQuantities({}); // Clear editing quantities too
    } catch (error) {
      console.error('Transaction failed:', error);
      // Display a user-friendly error message from the thrown error or a generic one
      toast.error(`Order failed: ${error.message || 'An unknown error occurred.'}`);
    } finally {
      setLoading(false); // Always stop loading
    }
  };

  // Calculate budget percentage for the progress bar
  const budgetPercentage = activeEvent ? (activeEvent.currentSpend / activeEvent.budget) * 100 : 0;
  // Determine budget bar color based on percentage
  const budgetBarColor = budgetPercentage >= 90 ? 'bg-burgundy' : budgetPercentage >= 70 ? 'bg-orange-500' : 'bg-primary-gold';

  // Loading state UI
  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 text-cream-white text-xl text-center">Loading POS...</div>
      </MainLayout>
    );
  }

  // No active event UI
  if (!activeEvent) {
    return (
      <MainLayout>
        <div className="p-6 bg-deep-navy m-4 rounded-lg text-cream-white text-center border border-burgundy shadow-lg">
          <p className="text-xl mb-4 font-semibold">No active event found.</p>
          <p className="mb-6">
            Please go to the <Link href="/events" className="text-secondary-gold hover:underline font-bold">Events page</Link> to create or set an event as current to use the POS.
          </p>
          <Link href="/events" className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-3 px-6 rounded-lg transition-colors duration-200">
            Go to Events
          </Link>
        </div>
      </MainLayout>
    );
  }

  // Main POS UI
  return (
    <MainLayout>
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-64px)] p-4 space-y-4 lg:space-y-0 lg:space-x-4">
        {/* Left Section: Beverages */}
        <div className="flex-1 bg-deep-navy rounded-lg shadow-xl p-4 lg:p-6 border border-primary-gold overflow-hidden flex flex-col">
          <h2 className="text-2xl font-bold text-cream-white mb-4">
            Beverages ({activeEvent.name})
          </h2>

          {/* Budget Tracker */}
          <div className="mb-6 p-4 bg-dark-charcoal rounded-md border border-primary-gold">
            <h3 className="text-lg font-semibold text-cream-white mb-2">Bar Budget Status</h3>
            <div className="text-cream-white text-sm mb-2">
              <span className="font-bold text-secondary-gold">Spent:</span> R {activeEvent.currentSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /{' '}
              <span className="font-bold text-primary-gold">Budget:</span>{' '}
              {isEditingBudget ? (
                <input
                  type="number"
                  value={editedBudget}
                  onChange={(e) => setEditedBudget(e.target.value)}
                  onBlur={(e) => handleUpdateBudget(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.target.blur(); // Trigger onBlur to save
                    }
                  }}
                  className="bg-rich-black text-primary-gold font-bold py-1 px-2 rounded-md w-28 text-right focus:outline-none focus:border-secondary-gold"
                  min={activeEvent.currentSpend} // Minimum value is current spend
                  step="0.01"
                  autoFocus // Automatically focus when it becomes an input
                />
              ) : (
                <span
                  className="font-bold text-primary-gold cursor-pointer hover:underline"
                  onClick={() => {
                    setIsEditingBudget(true);
                    setEditedBudget(String(activeEvent.budget)); // Initialize input with current budget
                  }}
                >
                  R {activeEvent.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary-gold scrollbar-track-dark-charcoal">
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
                    <img // Using <img> tag for maximum compatibility during troubleshooting
                      src={beverage.imageUrl}
                      alt={beverage.name}
                      className="w-full h-24 sm:h-32 object-cover rounded-md mb-2 border border-dark-charcoal"
                    />
                  )}
                  <h3 className="text-md font-semibold text-cream-white truncate w-full mb-1">{beverage.name}</h3>
                  <p className="text-sm text-primary-gold mb-1">R {beverage.price.toFixed(2)}</p>
                  <p className="text-xs text-cream-white">Stock: {beverage.currentStock}</p>
                  {beverage.currentStock <= 0 && <span className="text-burgundy text-xs font-bold mt-1">OUT OF STOCK</span>}
                </button>
              ))
            )}
          </div>
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
                    {/* Quantity Input Field - now controlled by editingQuantities state */}
                    <input
                      type="number"
                      // Use editingQuantities for the input's value, falling back to item.quantity
                      value={editingQuantities[item.beverageId] !== undefined ? editingQuantities[item.beverageId] : String(item.quantity)}
                      onChange={(e) => handleSetItemQuantity(item.beverageId, e.target.value)}
                      className="bg-rich-black text-cream-white text-lg font-bold w-16 text-center rounded-md border border-dark-charcoal focus:outline-none focus:border-secondary-gold"
                      min="0" // Allow 0 for explicit removal via input
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
              disabled={loading || orderItems.length === 0}
            >
              {loading ? 'Processing...' : 'Charge Order'}
            </button>
            <button
              onClick={() => {
                setOrderItems([]); // Clear the order cart
                setEditingQuantities({}); // Clear editing quantities too
              }}
              className="w-full bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-3 mt-3 rounded-lg text-lg transition-colors duration-200 disabled:opacity-50"
              disabled={loading || orderItems.length === 0}
            >
              Clear Order
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
