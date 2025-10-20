import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { fetchScriptsApi, deleteScriptApi } from '../services/apis';
import AddNewScriptModal from '../components/AddNewScriptModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/Modal';

const ScriptsPage = () => {
    const [allScripts, setAllScripts] = useState([]);
    const [filteredScripts, setFilteredScripts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scriptToEdit, setScriptToEdit] = useState(null);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [alertModal, setAlertModal] = useState({ visible: false, message: '' });

    const loadScripts = async () => {
        setLoading(true);
        try {
            const scripts = await fetchScriptsApi();
            setAllScripts(scripts);
            setFilteredScripts(scripts);
        } catch (error) {
            setAlertModal({ visible: true, message: 'Failed to load scripts.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadScripts();
    }, []);

    useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const filteredData = allScripts.filter(item =>
            item.name.toLowerCase().includes(lowercasedFilter) ||
            item.description.toLowerCase().includes(lowercasedFilter)
        );
        setFilteredScripts(filteredData);
    }, [searchTerm, allScripts]);

    const handleOpenAddModal = () => {
        setScriptToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (script) => {
        setScriptToEdit(script);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (script) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Script',
            message: `Are you sure you want to permanently delete "${script.name}"? This cannot be undone.`,
            onConfirm: () => confirmDelete(script.id),
        });
    };

    const confirmDelete = async (scriptId) => {
        try {
            await deleteScriptApi(scriptId);
            setAlertModal({ visible: true, message: 'Script deleted successfully!' });
            loadScripts();
        } catch (error) {
            setAlertModal({ visible: true, message: error.message });
        } finally {
            setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
    };

    // Animation Variants
    const listContainerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.07,
            },
        },
    };

    const listItemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
        },
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-800">Scripts</h1>
                    <p className="mt-1 text-gray-500">Manage the executable scripts that power your Runbooks.</p>
                </div>
                <button onClick={handleOpenAddModal} className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300">
                    <Plus size={20} className="mr-2" />
                    Add New Script
                </button>
            </div>

            <div className="relative mb-6">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search size={18} className="text-gray-400" />
                </span>
                <input
                    type="text"
                    placeholder="Search scripts by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-3 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                <motion.ul
                    className="divide-y divide-gray-200"
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {loading ? (
                        <li className="p-6 text-center text-gray-500">Loading scripts...</li>
                    ) : (
                        filteredScripts.map(script => (
                            <motion.li
                                key={script.id}
                                variants={listItemVariants}
                                className="p-6 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-bold text-blue-700">{script.name}</p>
                                        <p className="text-sm text-gray-500 mt-1 truncate">{script.description}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-4">
                                        <button onClick={() => handleOpenEditModal(script)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors">
                                            <Edit size={20} />
                                        </button>
                                        <button onClick={() => handleDeleteClick(script)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.li>
                        ))
                    )}
                </motion.ul>
            </div>
            
            <AddNewScriptModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onScriptAdded={loadScripts}
                scripts={allScripts}
                scriptToEdit={scriptToEdit}
            />
            
            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />

             <Modal message={alertModal.message} visible={alertModal.visible} onClose={() => setAlertModal({ visible: false, message: '' })} />
        </div>
    );
};

export default ScriptsPage;