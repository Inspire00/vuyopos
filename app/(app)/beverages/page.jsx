// app/(app)/beverages/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext'; // Corrected path based on your provided code
import { db, storage } from '../../../lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import toast from 'react-hot-toast';
import Modal from '../../../components/Modal'; // Assumes components/Modal.jsx exists
import Link from 'next/link';
import RestockModal from '../../../components/RestockModal'; // Assumes components/RestockModal.jsx exists
import AddMultipleBeveragesModal from '../../../components/AddMultipleBeveragesModal'; // NEW: Import the multi-add modal
import { v4 as uuidv4 } from 'uuid'; // For single add image unique filenames

export default function BeveragesPage() {
    const { user } = useAuth();
    const [allActiveEvents, setAllActiveEvents] = useState([]); // Stores all active events
    const [selectedEventId, setSelectedEventId] = useState(''); // Stores the ID of the currently selected active event
    const [currentEventData, setCurrentEventData] = useState(null); // Stores the full data of the selected active event
    const [beverages, setBeverages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSingleAddModalOpen, setIsSingleAddModalOpen] = useState(false); // Renamed for clarity
    const [isMultipleAddModalOpen, setIsMultipleAddModalOpen] = useState(false); // NEW: State for multi-add modal
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [beverageToRestock, setBeverageToRestock] = useState(null);

    // State for adding a single beverage (matching your provided code)
    const [newBeverageName, setNewBeverageName] = useState('');
    const [newBeverageCategory, setNewBeverageCategory] = useState('Other Non-Alcoholic');
    const [newBeverageType, setNewBeverageType] = useState('non-alcoholic');
    const [newBeverageQuantity, setNewBeverageQuantity] = useState(0);
    const [newBeveragePrice, setNewBeveragePrice] = useState(0);
    const [newBeverageImage, setNewBeverageImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const beverageCategories = useMemo(() => ({
        'non-alcoholic': ['Juice', 'Fizzy', 'Coffee', 'Water', 'Other Non-Alcoholic'],
        'alcoholic': ['Red Wine', 'White Wine', 'Beers', 'Ciders', 'Strong Drink', 'Other Alcoholic'],
    }), []);

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
                // Convert Firestore Timestamp to JS Date for consistent date handling
                date: doc.data().date instanceof Timestamp ? doc.data().date.toDate().toISOString().split('T')[0] : doc.data().date,
            }));
            setAllActiveEvents(fetchedEvents);

            // If there are active events, set the first one as selected by default
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

    // Function to fetch beverages for the currently selected event
    const fetchBeveragesForSelectedEvent = useCallback(async () => {
        if (!selectedEventId) {
            setBeverages([]);
            return;
        }
        setLoading(true);
        try {
            const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', selectedEventId));
            const beverageSnapshot = await getDocs(qBeverages);
            const fetchedBeverages = beverageSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setBeverages(fetchedBeverages);
        } catch (error) {
            console.error('Error fetching beverages for selected event:', error);
            toast.error('Failed to load beverages.');
        } finally {
            setLoading(false);
        }
    }, [selectedEventId]);

    // Effect to initially fetch all active events when user loads
    useEffect(() => {
        if (user) {
            fetchAllActiveEvents();
        }
    }, [user, fetchAllActiveEvents]);

    // Effect to re-fetch beverages whenever the selectedEventId changes
    useEffect(() => {
        fetchBeveragesForSelectedEvent();
        // Update currentEventData when selectedEventId changes
        const selectedEvent = allActiveEvents.find(event => event.id === selectedEventId);
        setCurrentEventData(selectedEvent || null);
    }, [selectedEventId, fetchBeveragesForSelectedEvent, allActiveEvents]);


    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewBeverageImage(file);
            setImagePreview(URL.createObjectURL(file));
        } else {
            setNewBeverageImage(null);
            setImagePreview(null);
        }
    };

    const handleCreateBeverage = async (e) => {
        e.preventDefault();
        if (!user || !selectedEventId) {
            toast.error('Please select an active event to add beverages to.');
            return;
        }
        if (newBeverageQuantity <= 0 || newBeveragePrice <= 0) {
            toast.error('Quantity and Price must be greater than 0.');
            return;
        }

        setLoading(true);
        let imageUrl = '';
        if (newBeverageImage) {
            try {
                // Match your existing filename format: name_timestamp.extension
                const fileExtension = newBeverageImage.name.split('.').pop();
                const uniqueFileName = `${newBeverageName.replace(/\s/g, '_')}_${Date.now()}.${fileExtension}`;
                const imageRef = ref(storage, `beverages/${selectedEventId}/${uniqueFileName}`);
                await uploadBytes(imageRef, newBeverageImage);
                imageUrl = await getDownloadURL(imageRef);
            } catch (uploadError) {
                console.error('Error uploading image:', uploadError);
                toast.error('Failed to upload image. Beverage will be added without image.');
                setLoading(false);
                return;
            }
        }

        try {
            await addDoc(collection(db, 'beverages'), {
                eventId: selectedEventId,
                name: newBeverageName,
                category: newBeverageCategory,
                type: newBeverageType,
                imageUrl: imageUrl,
                initialStock: newBeverageQuantity,
                currentStock: newBeverageQuantity,
                price: newBeveragePrice,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            toast.success('Beverage added successfully!');
            setIsSingleAddModalOpen(false); // Use the correct state variable
            setNewBeverageName('');
            setNewBeverageCategory('Other Non-Alcoholic');
            setNewBeverageType('non-alcoholic');
            setNewBeverageQuantity(0);
            setNewBeveragePrice(0);
            setNewBeverageImage(null);
            setImagePreview(null);
            fetchBeveragesForSelectedEvent(); // Re-fetch beverages for the current selected event
        } catch (error) {
            console.error('Error creating beverage:', error);
            toast.error('Failed to add beverage.');
        } finally {
            setLoading(false);
        }
    };

    // Function to open the restock modal for a specific beverage
    const handleOpenRestockModal = (beverage) => {
        setBeverageToRestock(beverage);
        setIsRestockModalOpen(true);
    };

    // Function to handle the restock confirmation from the modal
    const handleRestockConfirm = async (additionalQuantity, password) => {
        // --- SECURITY WARNING ---
        // Hardcoding password "2018" in client-side code is highly insecure.
        // For a production application, password validation should always happen on a secure backend
        // (e.g., Cloud Function, Firebase Security Rules, or a dedicated authentication service)
        // and ideally involve hashing and proper user authentication/authorization.
        // This implementation is for demonstration purposes based on the request.
        // --- END SECURITY WARNING ---

        if (password !== '2018') {
            toast.error('Incorrect password. Stock update denied.');
            return;
        }

        if (!beverageToRestock || additionalQuantity <= 0) {
            toast.error('Invalid restock request.');
            return;
        }

        setLoading(true); // Set loading for the restock operation
        try {
            await runTransaction(db, async (transaction) => {
                const beverageRef = doc(db, 'beverages', beverageToRestock.id);
                const beverageDoc = await transaction.get(beverageRef);

                if (!beverageDoc.exists()) {
                    throw new Error('Beverage not found!');
                }

                const currentBeverageData = beverageDoc.data();
                const newInitialStock = currentBeverageData.initialStock + additionalQuantity;
                const newCurrentStock = currentBeverageData.currentStock + additionalQuantity;

                transaction.update(beverageRef, {
                    initialStock: newInitialStock,
                    currentStock: newCurrentStock,
                    updatedAt: Timestamp.now(),
                });
            });

            toast.success(`${beverageToRestock.name} stock updated successfully! New total: ${beverageToRestock.currentStock + additionalQuantity}`);
            setIsRestockModalOpen(false);
            setBeverageToRestock(null);
            fetchBeveragesForSelectedEvent(); // Re-fetch beverages to show updated stock
        } catch (error) {
            console.error('Error restocking beverage:', error);
            toast.error(`Failed to restock ${beverageToRestock.name}: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Function to handle deleting a beverage
    const handleDeleteBeverage = async (beverageId, beverageName, imageUrl) => {
        if (!user) {
            toast.error('You must be logged in to delete beverages.');
            return;
        }

        // Using a custom modal for confirmation instead of window.confirm
        toast((t) => (
            <div className="bg-deep-navy p-4 rounded-lg shadow-lg text-cream-white flex flex-col items-center">
                <p className="mb-4 text-center">Are you sure you want to delete <span className="font-bold text-primary-gold">{beverageName}</span>? This action cannot be undone.</p>
                <div className="flex space-x-4">
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            setLoading(true);
                            try {
                                // Delete from Firestore
                                await deleteDoc(doc(db, 'beverages', beverageId));

                                // Delete image from Storage if it exists
                                if (imageUrl) {
                                    try {
                                        // Parse the image URL to get the path in storage
                                        const storagePath = decodeURIComponent(imageUrl.split('/o/')[1].split('?')[0]);
                                        const imageRef = ref(storage, storagePath);
                                        await deleteObject(imageRef);
                                        console.log('Image deleted from storage successfully.');
                                    } catch (storageError) {
                                        console.warn('Could not delete image from storage (it might not exist or permissions issue):', storageError);
                                        // Don't block deletion if image deletion fails
                                    }
                                }

                                toast.success(`${beverageName} deleted successfully!`);
                                fetchBeveragesForSelectedEvent(); // Re-fetch beverages to update the list
                            } catch (error) {
                                console.error('Error deleting beverage:', error);
                                toast.error(`Failed to delete ${beverageName}: ${error.message}`);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="bg-burgundy hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: Infinity }); // Make toast persistent until user acts
    };


    if (loading) {
        return (
            <MainLayout>
                <div className="p-6 text-cream-white">Loading beverages...</div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-cream-white">Beverage Management</h1>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                        <button
                            onClick={() => {
                                if (!selectedEventId) {
                                    toast.error('Please select an active event first to add beverages.');
                                    return;
                                }
                                setIsSingleAddModalOpen(true); // Open the single add modal
                            }}
                            className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200"
                            disabled={!selectedEventId || loading} // Disable if no event is selected
                        >
                            Add New Beverage
                        </button>
                        {/* NEW: Button for Add Multiple Beverages Modal */}
                        <button
                            onClick={() => {
                                if (!selectedEventId) {
                                    toast.error('Please select an active event first to add beverages.');
                                    return;
                                }
                                setIsMultipleAddModalOpen(true); // Open the multiple add modal
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
                            disabled={!selectedEventId || loading} // Disable if no event is selected
                        >
                            Add Multiple Beverages
                        </button>
                    </div>
                </div>

                {allActiveEvents.length === 0 ? (
                    <div className="bg-deep-navy p-6 rounded-lg text-cream-white text-center border border-burgundy">
                        <p className="text-lg mb-4">No active events found.</p>
                        <p>Please go to the <Link href="/events" className="text-secondary-gold hover:underline">Events page</Link> to create or set an event as active before managing beverages.</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <label htmlFor="event-select" className="block text-cream-white text-sm font-bold mb-2">
                                Select Active Event:
                            </label>
                            <select
                                id="event-select"
                                className="shadow border border-dark-charcoal rounded w-full md:w-1/2 py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
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
                                <h2 className="text-2xl font-bold text-secondary-gold mb-4">Beverages for: {currentEventData.name}</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {beverages.length === 0 ? (
                                        <p className="col-span-full text-cream-white text-center">No beverages added for this event yet.</p>
                                    ) : (
                                        beverages.map((beverage) => (
                                            <div key={beverage.id} className="bg-deep-navy p-4 rounded-lg shadow-md border border-dark-charcoal hover:border-secondary-gold transform hover:scale-[1.02] transition-transform duration-200">
                                                {beverage.imageUrl && (
                                                    <div className="w-full h-52 relative mb-3">
                                                        <img
                                                            src={beverage.imageUrl}
                                                            alt={beverage.name}
                                                            className="object-cover rounded-md border border-dark-charcoal w-full h-full"
                                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/128x128/333333/FFFFFF?text=No+Image'; }} // Fallback
                                                        />
                                                    </div>
                                                )}
                                                <h3 className="text-xl font-semibold text-cream-white truncate mb-1">{beverage.name}</h3>
                                                <p className="text-sm text-primary-gold mb-2">{beverage.category} ({beverage.type})</p>
                                                <p className="text-cream-white">Stock: <span className="font-bold">{beverage.currentStock}</span></p>
                                                <p className="text-cream-white">Price: <span className="font-bold">R {beverage.price.toFixed(2)}</span></p>
                                                <div className="flex space-x-2 mt-4">
                                                    <button
                                                        onClick={() => handleOpenRestockModal(beverage)}
                                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-2 rounded transition-colors duration-200 disabled:opacity-50"
                                                        disabled={loading}
                                                    >
                                                        Restock
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBeverage(beverage.id, beverage.name, beverage.imageUrl)}
                                                        className="flex-1 bg-burgundy hover:bg-red-700 text-white text-sm font-bold py-2 px-2 rounded transition-colors duration-200 disabled:opacity-50"
                                                        disabled={loading}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="bg-deep-navy p-6 rounded-lg text-cream-white text-center border border-burgundy">
                                <p className="text-lg mb-4">No event selected or event data missing.</p>
                                <p>Please select an active event from the dropdown above.</p>
                            </div>
                        )}
                    </>
                )}

                {/* Modal for adding a single new beverage (existing functionality) */}
                <Modal isOpen={isSingleAddModalOpen} onClose={() => {
                    setIsSingleAddModalOpen(false);
                    setImagePreview(null);
                    setNewBeverageImage(null);
                    // Reset single add form fields
                    setNewBeverageName('');
                    setNewBeverageCategory('Other Non-Alcoholic');
                    setNewBeverageType('non-alcoholic');
                    setNewBeverageQuantity(0);
                    setNewBeveragePrice(0);
                }}>
                    <h2 className="text-2xl font-bold text-cream-white mb-6">Add New Beverage</h2>
                    <form onSubmit={handleCreateBeverage} className="space-y-4">
                        <div>
                            <label htmlFor="beverageName" className="block text-cream-white text-sm font-bold mb-2">
                                Beverage Name
                            </label>
                            <input
                                type="text"
                                id="beverageName"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newBeverageName}
                                onChange={(e) => setNewBeverageName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="beverageType" className="block text-cream-white text-sm font-bold mb-2">
                                Type
                            </label>
                            <select
                                id="beverageType"
                                className="shadow border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newBeverageType}
                                onChange={(e) => {
                                    setNewBeverageType(e.target.value);
                                    setNewBeverageCategory(beverageCategories[e.target.value][0]);
                                }}
                                required
                            >
                                <option value="non-alcoholic">Non-Alcoholic</option>
                                <option value="alcoholic">Alcoholic</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="beverageCategory" className="block text-cream-white text-sm font-bold mb-2">
                                Category
                            </label>
                            <select
                                id="beverageCategory"
                                className="shadow border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newBeverageCategory}
                                onChange={(e) => setNewBeverageCategory(e.target.value)}
                                required
                            >
                                {beverageCategories[newBeverageType].map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="beverageQuantity" className="block text-cream-white text-sm font-bold mb-2">
                                Initial Stock Quantity
                            </label>
                            <input
                                type="number"
                                id="beverageQuantity"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newBeverageQuantity === 0 ? '' : newBeverageQuantity}
                                onChange={(e) => setNewBeverageQuantity(parseInt(e.target.value) || 0)}
                                min="1"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="beveragePrice" className="block text-cream-white text-sm font-bold mb-2">
                                Selling Price (R)
                            </label>
                            <input
                                type="number"
                                id="beveragePrice"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newBeveragePrice === 0 ? '' : newBeveragePrice}
                                onChange={(e) => setNewBeveragePrice(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.01"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="beverageImage" className="block text-cream-white text-sm font-bold mb-2">
                                Beverage Image
                            </label>
                            <input
                                type="file"
                                id="beverageImage"
                                accept="image/*"
                                className="block w-full text-cream-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-dark-charcoal file:text-primary-gold hover:file:bg-gray-700"
                                onChange={handleImageChange}
                            />
                            {imagePreview && (
                                <div className="mt-4 relative w-32 h-32">
                                    <img src={imagePreview} alt="Image Preview" className="object-cover rounded-md border border-dark-charcoal w-full h-full" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSingleAddModalOpen(false);
                                    setImagePreview(null);
                                    setNewBeverageImage(null);
                                }}
                                className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Adding...' : 'Add Beverage'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* NEW: Add Multiple Beverages Modal */}
                {selectedEventId && currentEventData && (
                    <AddMultipleBeveragesModal
                        isOpen={isMultipleAddModalOpen}
                        onClose={() => setIsMultipleAddModalOpen(false)}
                        eventId={selectedEventId}
                        onBeveragesAdded={fetchBeveragesForSelectedEvent} // Refresh the list after multiple additions
                    />
                )}

                {/* Restock Modal */}
                {beverageToRestock && (
                    <RestockModal
                        isOpen={isRestockModalOpen}
                        onClose={() => setIsRestockModalOpen(false)}
                        beverage={beverageToRestock}
                        onConfirm={handleRestockConfirm}
                        isLoading={loading}
                    />
                )}
            </div>
        </MainLayout>
    );
}
