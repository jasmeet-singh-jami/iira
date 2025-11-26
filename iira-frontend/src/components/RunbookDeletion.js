// src/components/RunbookDeletion.js
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw, X, FileText, Network, Tag } from 'lucide-react'; // Added icons
import { deleteSOPApi, fetchAllSOPsApi } from '../services/apis';
import ConfirmationModal from './ConfirmationModal';
import Modal from './Modal';

const RunbookDeletion = () => {
    const [alert, setAlert] = useState({ visible: false, message: '' });
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [agents, setAgents] = useState([]);
    const [loadingAgents, setLoadingAgents] = useState(false);
    
    // NEW: State to track the agent currently selected for viewing
    const [selectedAgent, setSelectedAgent] = useState(null);

    const fetchAgents = async () => {
        setLoadingAgents(true);
        try {
            const fetchedAgents = await fetchAllSOPsApi();
            setAgents(fetchedAgents);
        } catch (error) {
            setAlert({ visible: true, message: 'Failed to load Agents.' });
        } finally {
            setLoadingAgents(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleDeleteClick = (e, agent) => {
        e.stopPropagation(); // Prevent triggering the row click
        setConfirmation({
            isOpen: true,
            title: 'Delete Agent',
            message: `Are you sure you want to permanently delete "${agent.title}"?`,
            onConfirm: () => confirmDelete(agent.id)
        });
    };
    
    const confirmDelete = async (sopId) => {
        try {
            const response = await deleteSOPApi(sopId);
            setAlert({ visible: true, message: response.message });
            fetchAgents();
            // If the deleted agent was open in the modal, close it
            if (selectedAgent && selectedAgent.id === sopId) {
                setSelectedAgent(null);
            }
        } catch (error) {
            setAlert({ visible: true, message: error.message || 'An unexpected error occurred.' });
        } finally {
            setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
    };

    // NEW: Render the details of the selected agent
    const renderAgentDetails = () => {
        if (!selectedAgent) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">{selectedAgent.title}</h2>
                            <p className="text-sm text-gray-500 font-mono mt-1">ID: {selectedAgent.id}</p>
                        </div>
                        <button 
                            onClick={() => setSelectedAgent(null)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition focus:outline-none"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="p-6 overflow-y-auto space-y-6">
                        {/* Issue Description */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                                <FileText size={16} className="mr-2" /> Issue Description
                            </h3>
                            <div className="p-4 bg-blue-50 text-blue-900 rounded-lg border border-blue-100">
                                {selectedAgent.issue || "No description provided."}
                            </div>
                        </div>

                        {/* Tags */}
                        {selectedAgent.tags && selectedAgent.tags.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                                    <Tag size={16} className="mr-2" /> Tags
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {selectedAgent.tags.map((tag, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Raw Data / Nodes Structure */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                                <Network size={16} className="mr-2" /> Data Structure (Qdrant Payload)
                            </h3>
                            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-gray-700 shadow-inner">
                                <pre>{JSON.stringify(selectedAgent, null, 2)}</pre>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                        <button
                            onClick={() => setSelectedAgent(null)}
                            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-800">Agents Library</h1>
                    <p className="mt-1 text-gray-500">View details and manage existing Agents in the knowledge base.</p>
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
                        <li className="p-6 text-center text-gray-500">Loading Agents...</li>
                    ) : agents.length > 0 ? (
                        agents.map((agent) => (
                            <li 
                                key={agent.id} 
                                onClick={() => setSelectedAgent(agent)} // Make row clickable
                                className="p-6 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group"
                                title="Click to view details"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <span className="block font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                            {agent.title}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">
                                            {agent.id}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteClick(e, agent)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors z-10"
                                    title="Delete Agent"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </li>
                        ))
                    ) : (
                         <li className="p-6 text-center text-gray-500">No Agents found.</li>
                    )}
                </ul>
            </div>
            
            {/* Render the details modal if an agent is selected */}
            {renderAgentDetails()}

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