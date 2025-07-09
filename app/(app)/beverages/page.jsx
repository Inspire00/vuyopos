// app/(app)/beverages/page.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../../../components/MainLayout'; // Path change: relative path
import { useAuth } from '../../../context/AuthContext'; // Path change: relative path
import { db, storage } from '../../../lib/firebase'; // Path change: relative path
import { collection, addDoc, getDocs, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import Modal from '../../../components/Modal'; // Path change: relative path
import Link from 'next/link';

export default function BeveragesPage() {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState(null);
  const [beverages, setBeverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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


  useEffect(() => {
    if (user) {
      fetchActiveEventAndBeverages();
    }
  }, [user]);

  const fetchActiveEventAndBeverages = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const qEvents = query(collection(db, 'events'), where('eventManagerId', '==', user.uid), where('isActive', '==', true));
      const eventSnapshot = await getDocs(qEvents);
      if (eventSnapshot.empty) {
        setActiveEvent(null);
        setBeverages([]);
        setLoading(false);
        return;
      }
      const activeEvt = { id: eventSnapshot.docs[0].id, ...eventSnapshot.docs[0].data() };
      setActiveEvent(activeEvt);

      const qBeverages = query(collection(db, 'beverages'), where('eventId', '==', activeEvt.id));
      const beverageSnapshot = await getDocs(qBeverages);
      const fetchedBeverages = beverageSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBeverages(fetchedBeverages);

    } catch (error) {
      console.error('Error fetching active event or beverages:', error);
      toast.error('Failed to load event data.');
    } finally {
      setLoading(false);
    }
  };

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
    if (!user || !activeEvent) {
      toast.error('Please select or create an active event first.');
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
        const imageRef = ref(storage, `beverages/${activeEvent.id}/${newBeverageImage.name}_${Date.now()}`);
        await uploadBytes(imageRef, newBeverageImage);
        imageUrl = await getDownloadURL(imageRef);
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        toast.error('Failed to upload image.');
        setLoading(false);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'beverages'), {
        eventId: activeEvent.id,
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
      setIsModalOpen(false);
      setNewBeverageName('');
      setNewBeverageCategory('Other Non-Alcoholic');
      setNewBeverageType('non-alcoholic');
      setNewBeverageQuantity(0);
      setNewBeveragePrice(0);
      setNewBeverageImage(null);
      setImagePreview(null);
      fetchActiveEventAndBeverages();
    } catch (error) {
      console.error('Error creating beverage:', error);
      toast.error('Failed to add beverage.');
    } finally {
      setLoading(false);
    }
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
          <button
            onClick={() => {
              if (!activeEvent) {
                toast.error('Please create or select an active event first to add beverages.');
                return;
              }
              setIsModalOpen(true);
            }}
            className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200"
          >
            Add New Beverage
          </button>
        </div>

        {!activeEvent ? (
          <div className="bg-deep-navy p-6 rounded-lg text-cream-white text-center border border-burgundy">
            <p className="text-lg mb-4">No active event found.</p>
            <p>Please go to the <Link href="/events" className="text-secondary-gold hover:underline">Events page</Link> to create or set an event as current before adding beverages.</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-secondary-gold mb-4">Beverages for: {activeEvent.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {beverages.length === 0 ? (
                <p className="text-cream-white col-span-full text-center">No beverages added for this event yet.</p>
              ) : (
                beverages.map((beverage) => (
                  <div key={beverage.id} className="bg-deep-navy p-4 rounded-lg shadow-md border border-dark-charcoal hover:border-secondary-gold transform hover:scale-[1.02] transition-transform duration-200">
                    {beverage.imageUrl && (
                      <img
                        src={beverage.imageUrl}
                        alt={beverage.name}
                        className="w-full h-32 object-cover rounded-md mb-3 border border-dark-charcoal"
                      />
                    )}
                    <h3 className="text-xl font-semibold text-cream-white truncate mb-1">{beverage.name}</h3>
                    <p className="text-sm text-primary-gold mb-2">{beverage.category} ({beverage.type})</p>
                    <p className="text-cream-white">Stock: <span className="font-bold">{beverage.currentStock}</span></p>
                    <p className="text-cream-white">Price: <span className="font-bold">R {beverage.price.toFixed(2)}</span></p>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <Modal isOpen={isModalOpen} onClose={() => {
          setIsModalOpen(false);
          setImagePreview(null);
          setNewBeverageImage(null);
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
                <div className="mt-4">
                  <img src={imagePreview} alt="Image Preview" className="max-w-xs h-32 object-cover rounded-md border border-dark-charcoal" />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
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
      </div>
    </MainLayout>
  );
}