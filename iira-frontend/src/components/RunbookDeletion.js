// src/components/RunbookDeletion.js
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { deleteSOPApi, fetchAllSOPsApi } from '../services/apis';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';

const RunbookDeletion = () => {
    const [alert, setAlert] = useState({ visible: false, message: '' });
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [agents, setAgents] = useState([]); // Renamed variable
    const [loadingAgents, setLoadingAgents] = useState(false); // Renamed variable

    const fetchAgents = async () => { // Renamed function
        setLoadingAgents(true);
        try {
            const fetchedAgents = await fetchAllSOPsApi(); // API function name remains the same as it fetches SOPs
            setAgents(fetchedAgents);
        } catch (error) {
            setAlert({ visible: true, message: 'Failed to load Agents.' }); // Updated message
        } finally {
            setLoadingAgents(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleDeleteClick = (agent) => { // Renamed parameter
        setConfirmation({
            isOpen: true,
            title: 'Delete Agent', // Updated title
            message: `Are you sure you want to permanently delete "${agent.title}"?`, // Updated message
            onConfirm: () => confirmDelete(agent.id)
        });
    };
    
    const confirmDelete = async (sopId) => { // Parameter name remains sopId as it refers to the backend data ID
        try {
            const response = await deleteSOPApi(sopId); // API function name remains the same
            setAlert({ visible: true, message: response.message });
            fetchAgents(); // Refresh the list
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
                    <h1 className="text-4xl font-extrabold text-gray-800">Agents Library</h1>
                    <p className="mt-1 text-gray-500">View and delete existing Agents from the knowledge base.</p> {/* Updated description */}
                </div>
                <button
                    onClick={fetchAgents}
                    className="flex items-center text-sm px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={loadingAgents}
                >
                    <RefreshCcw size={16} className={`mr-2 ${loadingAgents ? 'animate-spin' : ''}`} /> Refresh List
                </button>
            </div>
            
            <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {loadingAgents ? (
                        <li className="p-6 text-center text-gray-500">Loading Agents...</li> // Updated loading text
                    ) : agents.length > 0 ? (
                        agents.map((agent) => ( // Renamed variable
                            <li key={agent.id} className="p-6 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                <span className="font-semibold text-blue-700">{agent.title}</span>
                                <button
                                    onClick={() => handleDeleteClick(agent)} // Pass renamed variable
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </li>
                        ))
                    ) : (
                         <li className="p-6 text-center text-gray-500">No Agents found.</li> // Updated no results text
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
