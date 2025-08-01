'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot, runTransaction, Timestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@radix-ui/react-dialog';

export default function TablesPage() {
    const { user } = useAuth();
    const [allActiveEvents, setAllActiveEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [currentEventData, setCurrentEventData] = useState(null);
    const [beverages, setBeverages] = useState([]);
    const [tables, setTables] = useState([]);
    const [selectedTableId, setSelectedTableId] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [editingQuantities, setEditingQuantities] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [newTableNumber, setNewTableNumber] = useState('');
    const [selectedHistoryTableId, setSelectedHistoryTableId] = useState(null);

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

            if (fetchedEvents.length > 0) {
                setSelectedEventId(fetchedEvents[0].id);
                setCurrentEventData(fetchedEvents[0]);
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

    useEffect(() => {
        if (user) {
            fetchAllActiveEvents();
        }
    }, [user, fetchAllActiveEvents]);

    const setupListeners = useCallback(() => {
        let unsubscribeEvent = () => {};
        let unsubscribeBeverages = () => {};
        let unsubscribeTables = () => {};

        if (selectedEventId) {
            unsubscribeEvent = onSnapshot(doc(db, 'events', selectedEventId), (docSnap) => {
                if (docSnap.exists()) {
                    setCurrentEventData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setCurrentEventData(null);
                    setBeverages([]);
                    setTables([]);
                    toast(`The selected event (${selectedEventId}) was deactivated or deleted.`, { icon: '⚠️' });
                    setSelectedEventId('');
                }
            }, (error) => {
                console.error("Error listening to selected event:", error);
                toast.error("Failed to listen for selected event updates.");
            });

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

            const qTables = query(collection(db, 'tables'), where('eventId', '==', selectedEventId));
            unsubscribeTables = onSnapshot(qTables, (snapshot) => {
                const fetchedTables = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setTables(fetchedTables);
            }, (error) => {
                console.error("Error listening to tables:", error);
                toast.error("Failed to listen for table updates.");
            });
        } else {
            setCurrentEventData(null);
            setBeverages([]);
            setTables([]);
        }

        return () => {
            unsubscribeEvent();
            unsubscribeBeverages();
            unsubscribeTables();
        };
    }, [selectedEventId]);

    useEffect(() => {
        const cleanup = setupListeners();
        return cleanup;
    }, [setupListeners]);

    useEffect(() => {
        if (selectedTableId) {
            const table = tables.find(t => t.id === selectedTableId);
            if (table) {
                setOrderItems(table.orderItems || []);
                const newEditingQuantities = {};
                (table.orderItems || []).forEach(item => {
                    newEditingQuantities[item.beverageId] = String(item.quantity);
                });
                setEditingQuantities(newEditingQuantities);
            } else {
                setOrderItems([]);
                setEditingQuantities({});
            }
        }
    }, [selectedTableId, tables]);

    const handleAddItem = (beverage) => {
        if (!selectedTableId) {
            toast.error('Please select a table first.');
            return;
        }

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

    const handleSaveOrder = async () => {
        if (!selectedTableId || !currentEventData) {
            toast.error('No table or event selected.');
            return;
        }

        setLoading(true);
        try {
            const tableRef = doc(db, 'tables', selectedTableId);
            await updateDoc(tableRef, {
                orderItems,
                totalAmount: currentOrderTotal,
                updatedAt: Timestamp.now(),
            });
            toast.success('Table order updated successfully!');
        } catch (error) {
            console.error('Error saving order:', error);
            toast.error('Failed to save order.');
        } finally {
            setLoading(false);
        }
    };

    const handleChargeTable = async () => {
        if (!selectedTableId || !currentEventData || orderItems.length === 0) {
            toast.error('No items in order, no table selected, or no active event.');
            return;
        }

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                const eventRef = doc(db, 'events', currentEventData.id);
                const tableRef = doc(db, 'tables', selectedTableId);
                const eventDocPromise = transaction.get(eventRef);
                const tableDocPromise = transaction.get(tableRef);
                const beverageDocPromises = orderItems.map(item =>
                    transaction.get(doc(db, 'beverages', item.beverageId))
                );

                const [eventDoc, tableDoc, ...beverageDocs] = await Promise.all([eventDocPromise, tableDocPromise, ...beverageDocPromises]);

                if (!eventDoc.exists()) {
                    throw new Error('Active event does not exist!');
                }
                if (!tableDoc.exists()) {
                    throw new Error('Selected table does not exist!');
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

                transaction.update(tableRef, {
                    isOpen: false,
                    orderItems,
                    totalAmount: currentOrderTotal,
                    updatedAt: Timestamp.now(),
                });

                const ordersCollectionRef = collection(db, 'orders');
                transaction.set(doc(ordersCollectionRef), {
                    eventId: currentEventData.id,
                    tableId: selectedTableId,
                    timestamp: Timestamp.now(),
                    totalAmount: currentOrderTotal,
                    items: dbOrderItems,
                    eventManagerId: user.uid,
                });
            });

            toast.success('Table charged and closed successfully!');
            setOrderItems([]);
            setEditingQuantities({});
            setSelectedTableId(null);
        } catch (error) {
            console.error('Transaction failed:', error);
            toast.error(`Charge failed: ${error.message || 'An unknown error occurred.'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTable = async () => {
        if (!selectedEventId || !newTableNumber.trim()) {
            toast.error('Please select an event and enter a table number.');
            return;
        }

        const tableNumber = newTableNumber.trim();
        if (tables.some(t => t.tableNumber === tableNumber && t.eventId === selectedEventId)) {
            toast.error(`Table ${tableNumber} already exists for this event.`);
            return;
        }

        setLoading(true);
        try {
            const tablesCollectionRef = collection(db, 'tables');
            const newTableRef = doc(tablesCollectionRef);
            await setDoc(newTableRef, {
                eventId: selectedEventId,
                tableNumber,
                isOpen: true,
                orderItems: [],
                totalAmount: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                eventManagerId: user.uid,
            });
            toast.success(`Table ${tableNumber} created successfully!`);
            setNewTableNumber('');
        } catch (error) {
            console.error('Error creating table:', error);
            toast.error('Failed to create table.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTable = async (tableId) => {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;

        if (table.orderItems?.length > 0 || table.totalAmount > 0) {
            toast.error('Cannot delete table with active orders. Clear or charge the tab first.');
            return;
        }

        setLoading(true);
        try {
            await deleteDoc(doc(db, 'tables', tableId));
            toast.success(`Table ${table.tableNumber} deleted successfully!`);
            if (selectedTableId === tableId) {
                setSelectedTableId(null);
                setOrderItems([]);
                setEditingQuantities({});
            }
        } catch (error) {
            console.error('Error deleting table:', error);
            toast.error('Failed to delete table.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="p-6 text-cream-white text-xl text-center">Loading Tables...</div>
            </MainLayout>
        );
    }

    if (allActiveEvents.length === 0) {
        return (
            <MainLayout>
                <div className="p-6 bg-deep-navy m-4 rounded-lg text-cream-white text-center border border-burgundy shadow-lg">
                    <p className="text-xl mb-4 font-semibold">No active events found.</p>
                    <p className="mb-6">
                        Please go to the <Link href="/events" className="text-secondary-gold hover:underline font-bold">Events page</Link> to create or set an event as active to manage tables.
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
                {/* Left Section: Tables and Beverages */}
                <div className="flex-1 bg-deep-navy rounded-lg shadow-xl p-4 lg:p-6 border border-primary-gold overflow-hidden flex flex-col">
                    <h2 className="text-2xl font-bold text-cream-white mb-4">Table Management</h2>

                    {/* Event Selector */}
                    <div className="mb-4">
                        <label htmlFor="table-event-select" className="block text-cream-white text-sm font-bold mb-2">
                            Select Active Event:
                        </label>
                        <select
                            id="table-event-select"
                            className="shadow border border-dark-charcoal rounded w-full md:w-1/2 py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                            value={selectedEventId}
                            onChange={(e) => {
                                setSelectedEventId(e.target.value);
                                setSelectedTableId(null);
                                setOrderItems([]);
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
                            {/* Create Table */}
                            <div className="mb-6 p-4 bg-dark-charcoal rounded-md border border-primary-gold">
                                <h3 className="text-lg font-semibold text-cream-white mb-2">Create New Table</h3>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={newTableNumber}
                                        onChange={(e) => setNewTableNumber(e.target.value)}
                                        placeholder="Table Number"
                                        className="flex-1 bg-rich-black text-cream-white py-2 px-3 rounded-md border border-dark-charcoal focus:outline-none focus:border-secondary-gold"
                                    />
                                    <button
                                        onClick={handleCreateTable}
                                        className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                                        disabled={loading || !newTableNumber.trim()}
                                    >
                                        Add Table
                                    </button>
                                </div>
                            </div>

                            {/* Table List */}
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-cream-white mb-2">Tables</h3>
                                {tables.length === 0 ? (
                                    <p className="text-cream-white">No tables created for this event.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {tables.map(table => (
                                            <div
                                                key={table.id}
                                                className={`p-3 rounded-md border flex justify-between items-center cursor-pointer transition-colors duration-200 ${
                                                    selectedTableId === table.id
                                                        ? 'bg-secondary-gold text-rich-black border-secondary-gold'
                                                        : table.isOpen
                                                        ? 'bg-rich-black border-dark-charcoal hover:border-primary-gold'
                                                        : 'bg-gray-600 border-gray-500 text-gray-300'
                                                }`}
                                                onClick={() => table.isOpen && setSelectedTableId(table.id)}
                                            >
                                                <span className="font-semibold">Table {table.tableNumber}</span>
                                                {table.isOpen ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTable(table.id);
                                                        }}
                                                        className="text-burgundy hover:text-red-700 text-sm"
                                                        disabled={loading}
                                                    >
                                                        &times;
                                                    </button>
                                                ) : (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <button
                                                                className="text-secondary-gold hover:underline text-sm"
                                                                onClick={() => setSelectedHistoryTableId(table.id)}
                                                            >
                                                                View History
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                                            <div className="bg-deep-navy p-6 rounded-lg max-w-md w-full relative overflow-y-auto max-h-[80vh]">
                                                                <DialogClose asChild>
                                                                    <button
                                                                        className="absolute top-2 right-2 text-cream-white hover:text-red-500 text-2xl font-bold"
                                                                        aria-label="Close"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </DialogClose>
                                                                <h3 className="text-xl font-bold mb-4">Table {table.tableNumber} History</h3>
                                                                {table.orderItems && table.orderItems.length > 0 ? (
                                                                    <>
                                                                        {table.orderItems.map(item => (
                                                                            <div key={item.beverageId} className="flex justify-between mb-2">
                                                                                <span>{item.name} x{item.quantity}</span>
                                                                                <span>R {(item.quantity * item.pricePerUnit).toFixed(2)}</span>
                                                                            </div>
                                                                        ))}
                                                                        <div className="mt-4 border-t border-gray-500 pt-2 font-bold">
                                                                            Total: R {table.totalAmount.toFixed(2)}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <p>No items consumed.</p>
                                                                )}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
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
                                                        className="object-cover rounded-md mb-2 border border-dark-charcoal w-full h-full"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/128x128/333333/FFFFFF?text=No+Image'; }}
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
                            <p className="text-lg mb-4">Please select an active event from the dropdown above to manage tables.</p>
                        </div>
                    )}
                </div>

                {/* Right Section: Table Order */}
                <div className="w-full lg:w-1/3 bg-deep-navy rounded-lg shadow-xl p-4 lg:p-6 border border-primary-gold flex flex-col">
                    <h2 className="text-2xl font-bold text-cream-white mb-4">
                        {selectedTableId ? `Table ${tables.find(t => t.id === selectedTableId)?.tableNumber || ''} Order` : 'Select a Table'}
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary-gold scrollbar-track-dark-charcoal">
                        {selectedTableId ? (
                            orderItems.length === 0 ? (
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
                            )
                        ) : (
                            <p className="text-cream-white text-center py-8">Please select a table to view or edit its order.</p>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-dark-charcoal">
                        <div className="flex justify-between items-center text-cream-white text-2xl font-bold mb-4">
                            <span>Total:</span>
                            <span>R {currentOrderTotal.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={handleSaveOrder}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-cream-white font-bold py-3 rounded-lg text-lg transition-colors duration-200 disabled:opacity-50"
                            disabled={loading || !selectedTableId || !currentEventData}
                        >
                            Save Order
                        </button>
                        <button
                            onClick={handleChargeTable}
                            className="w-full bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-4 mt-3 rounded-lg text-xl transition-colors duration-200 disabled:opacity-50"
                            disabled={loading || orderItems.length === 0 || !selectedTableId || !currentEventData}
                        >
                            {loading ? 'Processing...' : 'Charge & Close Tab'}
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}