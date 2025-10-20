// src/components/Modal.js
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const Modal = ({ message, onClose, onAddSOP }) => {
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    const modalVariants = {
        hidden: { scale: 0.9, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        exit: { scale: 0.9, opacity: 0 },
    };

    return (
        <AnimatePresence>
            {message && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50"
                    variants={backdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                >
                    <motion.div
                        className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-gray-200"
                        variants={modalVariants}
                    >
                        <div className="flex items-center space-x-3 mb-4">
                            <AlertCircle className="text-red-500 w-6 h-6" />
                            <h3 className="text-lg font-bold text-gray-800">Alert</h3>
                        </div>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <div className="flex justify-end space-x-3">
                            {onAddSOP && (
                                <button
                                    onClick={onAddSOP}
                                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-300"
                                >
                                    Add New Runbook
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
                            >
                                OK
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Modal;