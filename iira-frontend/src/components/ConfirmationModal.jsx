import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-300">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertTriangle className="text-yellow-500 w-8 h-8" />
                    <h3 className="text-xl font-bold text-gray-800">{title || 'Confirm Action'}</h3>
                </div>
                <p className="text-gray-600 mb-6">{message || 'Are you sure you want to proceed?'}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-300"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
