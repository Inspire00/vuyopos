// components/Modal.jsx
import React from 'react';

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <div className="bg-deep-navy rounded-lg shadow-2xl p-6 w-full max-w-lg border border-primary-gold transform scale-95 animate-scale-in">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-cream-white hover:text-secondary-gold text-2xl"
          >
            &times;
          </button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;