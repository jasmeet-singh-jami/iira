import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { deleteSOPApi, fetchAllSOPsApi } from '../services/apis';

const SopDeletion = () => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sops, setSops] = useState([]);
    const [loadingSops, setLoadingSops] = useState(false);

    const fetchSOPs = async () => {
        setLoadingSops(true);
        try {
            const fetchedSops = await fetchAllSOPsApi();
            // The SOP objects from the backend now have a unique 'id' field
            setSops(fetchedSops);
            // Clear the message on a successful fetch
            setMessage('');
        } catch (error) {
            console.error("Error fetching SOPs:", error);
            setMessage('Failed to load SOPs. Please check the API server.');
        } finally {
            setLoadingSops(false);
        }
    };

    useEffect(() => {
        fetchSOPs();
    }, []);

    const handleDeleteSOP = async (sopId) => {
        setIsLoading(true);
        setMessage('');

        try {
            const response = await deleteSOPApi(sopId);
            setMessage(response.message);
            fetchSOPs(); // Refresh the list of SOPs
        } catch (error) {
            setMessage(error.message || 'An unexpected error occurred.');
            console.error("Deletion API Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-red-700 mb-6 border-b-2 pb-2 border-red-200">
                SOP Deletion
            </h2>

            {message && (
                <div className={`p-3 mb-4 text-center rounded-md ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message}
                </div>
            )}

            <div className="mt-8">
                <h3 className="text-2xl font-bold text-gray-700 mb-4 flex items-center justify-between">
                    <span>Existing SOPs</span>
                    <button
                        onClick={fetchSOPs}
                        className="flex items-center text-sm px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-300 transition-colors"
                        disabled={loadingSops}
                    >
                        <RefreshCcw size={16} className="mr-1" /> Refresh
                    </button>
                </h3>
                {loadingSops ? (
                    <p className="text-gray-500">Loading SOPs...</p>
                ) : sops.length > 0 ? (
                    <ul className="space-y-2">
                        {sops.map((sop) => (
                            // Use sop.id for the key
                            <li key={sop.id} className="p-4 bg-gray-100 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                                <span className="font-semibold">{sop.title}</span>
                                <button
                                    onClick={() => handleDeleteSOP(sop.id)}
                                    className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition duration-200"
                                    disabled={isLoading}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No SOPs found. Please add one via the SOP Ingestion tab.</p>
                )}
            </div>
        </div>
    );
};

export default SopDeletion;
