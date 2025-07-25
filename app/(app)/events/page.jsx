// app/(app)/events/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../components/MainLayout';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import Modal from '../../../components/Modal'; // Assuming this is your general modal component
import InvoiceModal from '../../../components/InvoiceModal'; // Import the new InvoiceModal
import Link from 'next/link';

export default function EventsPage() {
    const { user } = useAuth(); 
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // Renamed for clarity
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false); // New state for invoice modal
    const [selectedEventForInvoice, setSelectedEventForInvoice] = useState(null); // New state to hold event for invoice

    const [newEventName, setNewEventName] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [newEventBudget, setNewEventBudget] = useState(0);

    // Wrap fetchEvents in useCallback
    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'events'), where('eventManagerId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const fetchedEvents = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setEvents(fetchedEvents);
        } catch (error) {
            console.error('Error fetching events:', error);
            toast.error('Failed to fetch events.');
        } finally {
            setLoading(false);
        }
    }, [user]); // Add user to useCallback dependencies

    useEffect(() => {
        if (user) {
            fetchEvents();
        }
    }, [user, fetchEvents]); // Include fetchEvents in useEffect dependencies

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error('You must be logged in to create an event.');
            return;
        }
        if (newEventBudget <= 0) {
            toast.error('Budget must be greater than 0.');
            return;
        }

        setLoading(true);
        try {
            // New events will simply be created as active.
            await addDoc(collection(db, 'events'), {
                name: newEventName,
                date: newEventDate,
                location: newEventLocation,
                budget: newEventBudget,
                currentSpend: 0,
                isActive: true, // This event will be active
                eventManagerId: user.uid,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            toast.success('Event created successfully and set as active!');
            setIsCreateModalOpen(false); // Close the create event modal
            setNewEventName('');
            setNewEventDate('');
            setNewEventLocation('');
            setNewEventBudget(0);
            fetchEvents(); // Refresh the list to show the new active event
        } catch (error) {
            console.error('Error creating event:', error);
            toast.error('Failed to create event.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetActiveEvent = async (eventId) => {
        if (!user) return;
        setLoading(true);
        try {
            // Activate the selected event.
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, { isActive: true, updatedAt: Timestamp.now() });
            toast.success('Event set as active!');
            fetchEvents(); // Refresh the list
        } catch (error) {
            console.error('Error setting active event:', error);
            toast.error('Failed to set event as active.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivateEvent = async (eventId) => {
        if (!user) return;
        setLoading(true);
        try {
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, { isActive: false, updatedAt: Timestamp.now() });
            toast.success('Event deactivated successfully!');
            fetchEvents(); // Refresh the list
        } catch (error) {
            console.error('Error deactivating event:', error);
            toast.error('Failed to deactivate event.');
        } finally {
            setLoading(false);
        }
    };

    // Function to open the invoice modal
    const handleOpenInvoiceModal = (event) => {
        setSelectedEventForInvoice(event);
        setIsInvoiceModalOpen(true);
    };

    // Function to close the invoice modal
    const handleCloseInvoiceModal = () => {
        setIsInvoiceModalOpen(false);
        setSelectedEventForInvoice(null);
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="p-6 text-cream-white">Loading events...</div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-cream-white">Your Events</h1>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200"
                    >
                        Create New Event
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.length === 0 ? (
                        <p className="text-cream-white col-span-full text-center">No events found. Create your first event!</p>
                    ) : (
                        events
                            .sort((a, b) => (b.isActive ? 1 : a.isActive ? -1 : 0) || b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
                            .map((event) => (
                                <div
                                    key={event.id}
                                    className={`bg-deep-navy p-6 rounded-lg shadow-md border ${event.isActive ? 'border-secondary-gold ring-2 ring-secondary-gold' : 'border-dark-charcoal'} transform hover:scale-[1.02] transition-transform duration-200`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-xl font-semibold text-cream-white">
                                            {event.name}
                                        </h2>
                                        {event.isActive && (
                                            <span className="bg-primary-gold text-rich-black text-xs font-bold px-3 py-1 rounded-full">
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-cream-white mb-1">
                                        <span className="font-semibold text-primary-gold">Date:</span> {new Date(event.date).toLocaleDateString()}
                                    </p>
                                    <p className="text-cream-white mb-1">
                                        <span className="font-semibold text-primary-gold">Location:</span> {event.location}
                                    </p>
                                    <p className="text-cream-white mb-1">
                                        <span className="font-semibold text-primary-gold">Budget:</span> R {event.budget.toLocaleString()}
                                    </p>
                                    <p className="text-cream-white mb-4">
                                        <span className="font-semibold text-primary-gold">Spend:</span> R {event.currentSpend.toLocaleString()}
                                    </p>
                                    
                                    {/* Action Buttons */}
                                    <div className="space-y-3"> {/* Added a div for spacing between buttons */}
                                        {event.isActive ? (
                                            <button
                                                onClick={() => handleDeactivateEvent(event.id)}
                                                className="w-full bg-burgundy hover:bg-red-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
                                                disabled={loading}
                                            >
                                                Deactivate Event
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleSetActiveEvent(event.id)}
                                                className="w-full bg-secondary-gold hover:bg-primary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
                                                disabled={loading}
                                            >
                                                Set as Active Event
                                            </button>
                                        )}
                                        {/* Invoice Button - Bold and Visible */}
                                        <button
                                            onClick={() => handleOpenInvoiceModal(event)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
                                            disabled={loading}
                                        >
                                            Generate Invoice
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}
                </div>

                {/* Create New Event Modal */}
                <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                    <h2 className="text-2xl font-bold text-cream-white mb-6">Create New Event</h2>
                    <form onSubmit={handleCreateEvent} className="space-y-4">
                        <div>
                            <label htmlFor="eventName" className="block text-cream-white text-sm font-bold mb-2">
                                Event Name
                            </label>
                            <input
                                type="text"
                                id="eventName"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newEventName}
                                onChange={(e) => setNewEventName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="eventDate" className="block text-cream-white text-sm font-bold mb-2">
                                Event Date
                            </label>
                            <input
                                type="date"
                                id="eventDate"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newEventDate}
                                onChange={(e) => setNewEventDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="eventLocation" className="block text-cream-white text-sm font-bold mb-2">
                                Location
                            </label>
                            <input
                                type="text"
                                id="eventLocation"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newEventLocation}
                                onChange={(e) => setNewEventLocation(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="eventBudget" className="block text-cream-white text-sm font-bold mb-2">
                                Bar Budget (R)
                            </label>
                            <input
                                type="number"
                                id="eventBudget"
                                className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
                                value={newEventBudget === 0 ? '' : newEventBudget}
                                onChange={(e) => setNewEventBudget(parseFloat(e.target.value) || 0)}
                                min="1"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Creating...' : 'Create Event'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Invoice Generation Modal */}
                {selectedEventForInvoice && (
                    <InvoiceModal
                        isOpen={isInvoiceModalOpen}
                        onClose={handleCloseInvoiceModal}
                        event={selectedEventForInvoice}
                    />
                )}
            </div>
        </MainLayout>
    );
}
