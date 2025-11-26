import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Plus, Loader2, Trash2, GitFork } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';

const PropertiesPanel = ({
    nodeData,
    availableScripts,
    onUpdate,
    onClose,
    onAddNewScript,
    onRematchStep,
    onCreateScript,
    onDeleteStep,
    setConfirmationModal
}) => {
    // Common State
    const [description, setDescription] = useState(nodeData?.description || '');
    
    // Step Node State
    const [scriptId, setScriptId] = useState(nodeData?.script_id || null);

    // Decision Node State
    const [condition, setCondition] = useState(nodeData?.condition || '');

    // Sync local state with nodeData when a new node is selected
    useEffect(() => {
        if (nodeData) {
            setDescription(nodeData.description || '');
            setScriptId(nodeData.script_id || null);
            setCondition(nodeData.condition || '');
        }
    }, [nodeData]);

    // Debounced update for Description
    useEffect(() => {
        if (nodeData && description !== (nodeData.description || '')) {
            const handler = setTimeout(() => {
                onUpdate({ description });
            }, 500);
            return () => clearTimeout(handler);
        }
    }, [description, nodeData, onUpdate]);

    // Debounced update for Condition (Decision Nodes only)
    useEffect(() => {
        if (nodeData && nodeData.type === 'decision' && condition !== (nodeData.condition || '')) {
            const handler = setTimeout(() => {
                onUpdate({ condition });
            }, 500);
            return () => clearTimeout(handler);
        }
    }, [condition, nodeData, onUpdate]);

    // Handler for Script Selection (Step Nodes only)
    const handleScriptChange = (newScriptId) => {
        setScriptId(newScriptId);
        
        const selectedScript = availableScripts.find(script => script.id === newScriptId);
        const scriptName = selectedScript ? selectedScript.name : null;

        onUpdate({
            script_id: newScriptId,
            script: scriptName
        });
    };

    const handleDelete = () => {
        if (!setConfirmationModal || (nodeData?.index === undefined && !nodeData?.id)) {
             console.error("Cannot delete: setConfirmationModal is missing or node has no identifier.");
             return;
        }

        setConfirmationModal({
            isOpen: true,
            title: 'Delete Step',
            message: `Are you sure you want to delete ${nodeData.index !== undefined ? 'Step ' + (nodeData.index + 1) : 'this step'}?`,
            onConfirm: () => {
                if (onDeleteStep) {
                    const identifier = nodeData.index !== undefined ? nodeData.index : nodeData.id;
                    onDeleteStep(identifier);
                    setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                    onClose(); 
                }
            }
        });
    };

    if (!nodeData) {
         return (
             <div className="w-96 border-l bg-white p-4 flex flex-col shadow-lg h-full">
                 <div className="flex justify-end items-center pb-4 border-b mb-4">
                     <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
                        title="Close Panel"
                     >
                        <X size={20} />
                    </button>
                 </div>
                <p className="text-gray-500 mt-4">No step selected.</p>
            </div>
        );
    }

    const isDecision = nodeData.type === 'decision';

    return (
        <div className="w-96 border-l bg-white p-4 flex flex-col shadow-lg h-full">
            {/* --- HEADER --- */}
            <div className="flex justify-between items-center pb-4 border-b mb-4">
                <div className="flex items-center space-x-2">
                    {isDecision && <GitFork className="text-purple-500" size={20} />}
                    <h3 className="font-bold text-lg text-gray-800">
                        {isDecision ? 'Edit Decision' : `Edit Step ${typeof nodeData.index === 'number' ? nodeData.index + 1 : ''}`}
                    </h3>
                </div>
                <div className="flex items-center space-x-1">
                     <button
                        onClick={handleDelete}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                        title="Delete Step"
                        disabled={nodeData.index === undefined && !nodeData.id}
                     >
                        <Trash2 size={20} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
                        title="Close Panel"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-grow space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* --- COMMON: DESCRIPTION --- */}
                <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1 block">
                        {isDecision ? 'Decision Question / Name' : 'Description'}
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg h-32 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        placeholder={isDecision ? "e.g., Is the service running?" : "Describe the action for this step..."}
                    />
                </div>

                {/* --- DECISION NODE SPECIFIC UI --- */}
                {isDecision ? (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <label className="text-sm font-semibold text-purple-900 mb-1 block flex items-center">
                            <GitFork size={14} className="mr-1.5" />
                            Decision Logic
                        </label>
                        <p className="text-xs text-purple-600 mb-2">
                            Define the condition that determines which path to take (True or False).
                        </p>
                        <input
                            type="text"
                            value={condition}
                            onChange={(e) => setCondition(e.target.value)}
                            className="w-full p-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition bg-white"
                            placeholder="e.g., Output contains 'Active'"
                        />
                    </div>
                ) : (
                    /* --- STEP NODE SPECIFIC UI --- */
                    <>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">Associated Worker Task</label>
                             <div className="relative flex-grow">
                                <SearchableDropdown
                                    options={availableScripts} 
                                    value={scriptId || ''}
                                    onChange={handleScriptChange}
                                    placeholder="Select a Worker Task (Optional)"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">AI Actions</label>
                            <div className="flex space-x-2">
                                 <button
                                    onClick={() => onRematchStep(nodeData.index)}
                                    disabled={!description?.trim() || nodeData.isMatching || nodeData.isCreating}
                                    className="flex-1 p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-200 transition text-sm flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    title="Find matching worker task for this step"
                                >
                                    {nodeData.isMatching ? ( <Loader2 size={16} className="animate-spin mr-2" /> ) : ( <Search size={16} className="mr-2" /> )}
                                    Rematch Task
                                </button>
                                <button
                                    onClick={() => onCreateScript(nodeData.index)}
                                    disabled={!description?.trim() || nodeData.isMatching || nodeData.isCreating}
                                    className="flex-1 p-2 bg-green-100 text-green-600 rounded-lg shadow-sm hover:bg-green-200 transition text-sm flex items-center justify-center disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-400"
                                    title="Create a new worker task for this step using AI"
                                >
                                    {nodeData.isCreating ? ( <Loader2 size={16} className="animate-spin mr-2" /> ) : ( <Sparkles size={16} className="mr-2" /> )}
                                    Generate Task
                                </button>
                            </div>
                        </div>

                         <div>
                            <label className="text-sm font-semibold text-gray-700 mb-1 block">Manage Worker Tasks</label>
                            <button
                                onClick={onAddNewScript}
                                className="w-full flex items-center justify-center p-2 bg-blue-100 text-blue-600 rounded-lg shadow-sm hover:bg-blue-200 transition text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                <Plus size={16} className="mr-2" /> Add New Global Task
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const scrollbarStyle = `
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
`;
const styleSheet = document.createElement("style");
if (!document.getElementById('custom-scrollbar-style')) {
    styleSheet.id = 'custom-scrollbar-style';
    styleSheet.innerText = scrollbarStyle;
    document.head.appendChild(styleSheet);
}

export default PropertiesPanel;