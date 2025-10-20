// src/components/RunbookDeletion.js
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { deleteSOPApi, fetchAllSOPsApi } from '../services/apis';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';

const RunbookDeletion = () => {
    const [alert, setAlert] = useState({ visible: false, message: '' });
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [runbooks, setRunbooks] = useState([]);
    const [loadingRunbooks, setLoadingRunbooks] = useState(false);

    const fetchRunbooks = async () => {
        setLoadingRunbooks(true);
        try {
            const fetchedRunbooks = await fetchAllSOPsApi();
            setRunbooks(fetchedRunbooks);
        } catch (error) {
            setAlert({ visible: true, message: 'Failed to load Runbooks.' });
        } finally {
            setLoadingRunbooks(false);
        }
    };

    useEffect(() => {
        fetchRunbooks();
    }, []);

    const handleDeleteClick = (runbook) => {
        setConfirmation({
            isOpen: true,
            title: 'Delete Runbook',
            message: `Are you sure you want to permanently delete "${runbook.title}"?`,
            onConfirm: () => confirmDelete(runbook.id)
        });
    };
    
    const confirmDelete = async (sopId) => {
        try {
            const response = await deleteSOPApi(sopId);
            setAlert({ visible: true, message: response.message });
            fetchRunbooks(); // Refresh the list
        } catch (error) {
            setAlert({ visible: true, message: error.message || 'An unexpected error occurred.' });
        } finally {
            setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-800">Manage Runbooks</h1>
                    <p className="mt-1 text-gray-500">View and delete existing Runbooks from the knowledge base.</p>
                </div>
                <button
                    onClick={fetchRunbooks}
                    className="flex items-center text-sm px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={loadingRunbooks}
                >
                    <RefreshCcw size={16} className={`mr-2 ${loadingRunbooks ? 'animate-spin' : ''}`} /> Refresh List
                </button>
            </div>
            
            <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {loadingRunbooks ? (
                        <li className="p-6 text-center text-gray-500">Loading Runbooks...</li>
                    ) : runbooks.length > 0 ? (
                        runbooks.map((runbook) => (
                            <li key={runbook.id} className="p-6 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                <span className="font-semibold text-blue-700">{runbook.title}</span>
                                <button
                                    onClick={() => handleDeleteClick(runbook)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </li>
                        ))
                    ) : (
                         <li className="p-6 text-center text-gray-500">No Runbooks found.</li>
                    )}
                </ul>
            </div>
            
            <Modal message={alert.message} visible={alert.visible} onClose={() => setAlert({ visible: false, message: '' })} />
            <ConfirmationModal 
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
            />
        </div>
    );
};

export default RunbookDeletion;