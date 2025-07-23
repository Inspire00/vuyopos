// components/RestockModal.jsx
import React, { useState, useEffect } from 'react';

/**
 * RestockModal component for confirming beverage restock with a password.
 *
 * Props:
 * - isOpen: Boolean to control modal visibility.
 * - onClose: Function to close the modal.
 * - beverage: The beverage object currently being restocked.
 * - onConfirm: Function to call when restock is confirmed, passes { additionalQuantity, password }.
 * - isLoading: Boolean to indicate if an async operation is in progress.
 */
const RestockModal = ({ isOpen, onClose, beverage, onConfirm, isLoading }) => {
  const [additionalQuantity, setAdditionalQuantity] = useState(0);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Reset state when modal opens/closes or beverage changes
  useEffect(() => {
    if (isOpen) {
      setAdditionalQuantity(0);
      setPassword('');
      setError('');
    }
  }, [isOpen, beverage]);

  const handleConfirmClick = () => {
    setError('');
    if (additionalQuantity <= 0) {
      setError('Please enter a positive quantity to restock.');
      return;
    }
    if (password.trim() === '') {
      setError('Please enter the password.');
      return;
    }
    onConfirm(additionalQuantity, password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 sm:p-6">
      <div className="bg-deep-navy rounded-lg shadow-2xl w-full max-w-md p-6 border border-primary-gold">
        <h2 className="text-2xl font-bold text-cream-white mb-4">Restock {beverage?.name}</h2>
        {beverage && (
          <p className="text-cream-white mb-4">
            Current Stock: <span className="font-bold">{beverage.currentStock}</span>
          </p>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="additionalQuantity" className="block text-cream-white text-sm font-bold mb-2">
              Additional Quantity to Add
            </label>
            <input
              type="number"
              id="additionalQuantity"
              className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
              value={additionalQuantity === 0 ? '' : additionalQuantity}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setAdditionalQuantity(isNaN(value) ? 0 : value);
              }}
              min="1"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-cream-white text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border border-dark-charcoal rounded w-full py-2 px-3 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {error && <p className="text-burgundy text-sm mb-4">{error}</p>}

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-dark-charcoal hover:bg-gray-700 text-cream-white font-bold py-2 px-4 rounded transition-colors duration-200"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded transition-colors duration-200 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Restocking...' : 'Confirm Restock'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestockModal;
