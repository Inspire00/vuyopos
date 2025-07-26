'use client';

import { useState, useMemo } from 'react';
import Modal from './Modal';
import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

export default function AddMultipleBeveragesModal({ isOpen, onClose, eventId, onBeveragesAdded }) {
    const beverageCategoriesMap = useMemo(() => ({
        'non-alcoholic': ['Juice', 'Fizzy', 'Coffee', 'Water', 'Other Non-Alcoholic'],
        'alcoholic': ['Red Wine', 'White Wine', 'Beers', 'Ciders', 'Strong Drink', 'Other Alcoholic'],
    }), []);

    const beverageTypes = ['non-alcoholic', 'alcoholic'];

    const initialBeverageRow = {
        name: '',
        type: 'non-alcoholic',
        category: beverageCategoriesMap['non-alcoholic'][0],
        initialStock: '',
        price: '',
        imageFile: null,
        imageUrl: null // For local preview
    };

    const [beveragesToAdd, setBeveragesToAdd] = useState([initialBeverageRow]);
    const [loading, setLoading] = useState(false);

    const storage = getStorage();

    const handleChange = (index, field, value) => {
        const newBeverages = [...beveragesToAdd];
        newBeverages[index] = { ...newBeverages[index], [field]: value };

        if (field === 'type') {
            newBeverages[index].category = beverageCategoriesMap[value][0];
        }

        setBeveragesToAdd(newBeverages);
    };

    const handleImageChange = (index, e) => {
        console.log(`handleImageChange called for index: ${index}`);
        const file = e.target.files[0];
        console.log('File selected:', file);

        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                toast.error('Image size exceeds 2MB. Please choose a smaller image.');
                e.target.value = '';
                handleChange(index, 'imageFile', null);
                handleChange(index, 'imageUrl', null);
                return;
            }

            // Correctly update state with the file object and a preview URL
            const newBeverages = [...beveragesToAdd];
            newBeverages[index] = { ...newBeverages[index], imageFile: file, imageUrl: URL.createObjectURL(file) };
            setBeveragesToAdd(newBeverages);

            console.log(`Image file and URL set for beverage at index ${index}. Preview URL: ${URL.createObjectURL(file)}`);
        } else {
            const newBeverages = [...beveragesToAdd];
            newBeverages[index] = { ...newBeverages[index], imageFile: null, imageUrl: null };
            setBeveragesToAdd(newBeverages);
            console.log(`No file selected for beverage at index ${index}. Image cleared.`);
        }
    };

    const handleAddRow = () => {
        setBeveragesToAdd([...beveragesToAdd, {
            ...initialBeverageRow,
            category: beverageCategoriesMap[initialBeverageRow.type][0]
        }]);
    };

    const handleRemoveRow = (index) => {
        const newBeverages = beveragesToAdd.filter((_, i) => i !== index);
        setBeveragesToAdd(newBeverages);
    };

    const handleSubmitAllBeverages = async (e) => {
        e.preventDefault();
        setLoading(true);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        // --- CRITICAL DEBUGGING LOG ---
        console.log('--- handleSubmitAllBeverages: Current state of beveragesToAdd before processing ---');
        console.log(JSON.parse(JSON.stringify(beveragesToAdd))); // Use JSON.parse(JSON.stringify) to deep clone and avoid circular refs in console
        console.log('------------------------------------------------------------------------------------');
        // --- END CRITICAL DEBUGGING LOG ---

        const validBeverages = beveragesToAdd.filter(beverage =>
            beverage.name &&
            beverage.type &&
            beverage.category &&
            !isNaN(parseFloat(beverage.initialStock)) && parseFloat(beverage.initialStock) > 0 &&
            !isNaN(parseFloat(beverage.price)) && parseFloat(beverage.price) > 0
        );

        if (validBeverages.length === 0) {
            toast.error('No valid beverages to add. Please complete at least one row with valid data.');
            setLoading(false);
            return;
        }

        for (const beverage of validBeverages) {
            console.log(`--- Processing beverage: ${beverage.name} ---`);
            let uploadedImageUrl = '';

            if (beverage.imageFile) {
                console.log(`Attempting to upload image for: ${beverage.name}. File object present.`);
                try {
                    const fileExtension = beverage.imageFile.name.split('.').pop();
                    const uniqueFileName = `${beverage.name.replace(/\s/g, '_')}_${Date.now()}.${fileExtension}`;
                    const storageRef = ref(storage, `beverages/${eventId}/${uniqueFileName}`);
                    console.log('Storage Ref Path:', storageRef.fullPath);

                    const uploadResult = await uploadBytes(storageRef, beverage.imageFile);
                    uploadedImageUrl = await getDownloadURL(uploadResult.ref);
                    console.log(`Image for "${beverage.name}" uploaded. Download URL:`, uploadedImageUrl);
                    toast.success(`Image for "${beverage.name}" uploaded to storage!`);
                } catch (imageUploadError) {
                    console.error(`Error uploading image for "${beverage.name}":`, imageUploadError);
                    errors.push(`Failed to upload image for "${beverage.name}".`);
                    uploadedImageUrl = '';
                }
            } else {
                console.log(`No image file provided for: ${beverage.name}. (beverage.imageFile was null/undefined)`);
            }

            try {
                const beverageData = {
                    eventId: eventId,
                    name: beverage.name,
                    type: beverage.type,
                    category: beverage.category,
                    imageUrl: uploadedImageUrl,
                    initialStock: parseFloat(beverage.initialStock),
                    currentStock: parseFloat(beverage.initialStock),
                    price: parseFloat(beverage.price),
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                };
                console.log(`Attempting to add beverage "${beverage.name}" to Firestore with data:`, beverageData);

                await addDoc(collection(db, 'beverages'), beverageData);
                successCount++;
                console.log(`Beverage "${beverage.name}" added to Firestore successfully.`);
            } catch (error) {
                console.error(`Error adding beverage "${beverage.name}" to Firestore:`, error);
                errors.push(`Failed to add "${beverage.name}" to database: ${error.message}`);
                errorCount++;
            }
        }

        setLoading(false);
        if (successCount > 0) {
            toast.success(`${successCount} beverage(s) added successfully!`);
            onBeveragesAdded();
            onClose();
            setBeveragesToAdd([initialBeverageRow]);
        }
        if (errorCount > 0) {
            errors.forEach(msg => toast.error(msg));
            if (successCount === 0) {
                toast.error('No beverages were added due to errors. Please check details.');
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-4 sm:p-6 md:p-8 bg-deep-navy rounded-lg shadow-xl text-cream-white max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 className="text-3xl font-bold text-primary-gold mb-6 text-center">Add Multiple Beverages</h2>

                <form onSubmit={handleSubmitAllBeverages} className="space-y-6">
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Beverage Name</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Category</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Initial Stock</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Price (R)</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Image</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-rich-black divide-y divide-gray-800">
                                {beveragesToAdd.map((beverage, index) => (
                                    <tr key={index}>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                placeholder="e.g., Castle Light"
                                                value={beverage.name}
                                                onChange={(e) => handleChange(index, 'name', e.target.value)}
                                                className="w-full p-2 rounded bg-dark-charcoal border border-gray-600 text-cream-white focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50"
                                                required
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={beverage.type}
                                                onChange={(e) => handleChange(index, 'type', e.target.value)}
                                                className="w-full p-2 rounded bg-dark-charcoal border border-gray-600 text-cream-white focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50"
                                                required
                                            >
                                                {beverageTypes.map(type => (
                                                    <option key={type} value={type}>
                                                        {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={beverage.category}
                                                onChange={(e) => handleChange(index, 'category', e.target.value)}
                                                className="w-full p-2 rounded bg-dark-charcoal border border-gray-600 text-cream-white focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50"
                                                required
                                            >
                                                {beverageCategoriesMap[beverage.type]?.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                )) || <option value="">Select Type First</option>}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                placeholder="e.g., 100"
                                                value={beverage.initialStock}
                                                onChange={(e) => handleChange(index, 'initialStock', e.target.value)}
                                                className="w-full p-2 rounded bg-dark-charcoal border border-gray-600 text-cream-white focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                placeholder="e.g., 25.00"
                                                value={beverage.price}
                                                onChange={(e) => handleChange(index, 'price', e.target.value)}
                                                className="w-full p-2 rounded bg-dark-charcoal border border-gray-600 text-cream-white focus:border-secondary-gold focus:ring focus:ring-secondary-gold focus:ring-opacity-50"
                                                min="0.01"
                                                step="0.01"
                                                required
                                            />
                                        </td>
                                        {/* Image Upload Field */}
                                        <td className="p-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleImageChange(index, e)}
                                                className="w-full text-sm text-cream-white file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-gold file:text-rich-black hover:file:bg-secondary-gold"
                                            />
                                            {beverage.imageUrl && (
                                                <div className="mt-1 text-center">
                                                    <img src={beverage.imageUrl} alt="Preview" className="w-10 h-10 object-contain mx-auto rounded-md border border-gray-600" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(index)}
                                                className="bg-red-600 hover:bg-red-700 text-cream-white font-bold py-1 px-3 rounded-full transition-colors duration-200 text-sm"
                                                disabled={beveragesToAdd.length === 1}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add Row Button */}
                    <div className="flex justify-center mt-4">
                        <button
                            type="button"
                            onClick={handleAddRow}
                            className="bg-blue-600 hover:bg-blue-700 text-cream-white font-bold py-2 px-4 rounded-full transition-colors duration-200 flex items-center space-x-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            <span>Add Another Beverage</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Adding...' : 'Add All Beverages'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
