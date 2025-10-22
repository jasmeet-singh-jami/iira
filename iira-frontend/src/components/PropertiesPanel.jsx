// src/components/PropertiesPanel.jsx
import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Plus, Loader2 } from 'lucide-react'; // Import Loader2
import SearchableDropdown from './SearchableDropdown';

const PropertiesPanel = ({ nodeData, availableScripts, onUpdate, onClose, onAddNewScript, onRematchStep, onCreateScript }) => {
    const [description, setDescription] = useState(nodeData.description);
    const [scriptId, setScriptId] = useState(nodeData.script_id);

    // --- useEffect hooks remain the same ---
    useEffect(() => {
        const handler = setTimeout(() => {
            if (description !== nodeData.description) {
                onUpdate({ description });
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [description, nodeData.description, onUpdate]);
    
    useEffect(() => {
        if (scriptId !== nodeData.script_id) {
            onUpdate({ script_id: scriptId });
        }
    }, [scriptId, nodeData.script_id, onUpdate]);

    return (
        <div className="w-96 border-l bg-white p-4 flex flex-col shadow-lg">
            {/* Header remains the same */}
            <div className="flex justify-between items-center pb-4 border-b">
                <h3 className="font-bold text-lg">Edit Step {nodeData.index + 1}</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>

            {/* Form elements remain the same */}
            <div className="flex-grow mt-4 space-y-4 overflow-y-auto">
                <div>
                    <label className="text-sm font-semibold mb-1 block">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2 border rounded h-32"
                    />
                </div>
                
                <div>
                    <label className="text-sm font-semibold mb-1 block">Associated Script</label>
                     <div className="relative flex-grow">
                        <SearchableDropdown
                            options={availableScripts}
                            value={scriptId || ''}
                            onChange={(value) => setScriptId(value)}
                            placeholder="Select a Script (Optional)"
                        />
                    </div>
                </div>

                {/* --- MODIFIED AI ACTIONS BUTTONS --- */}
                <div>
                    <label className="text-sm font-semibold mb-1 block">AI Actions</label>
                    <div className="flex space-x-2">
                         <button
                            onClick={() => onRematchStep(nodeData.index)}
                            disabled={nodeData.isMatching || nodeData.isCreating}
                            className="flex-1 p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-200 transition text-sm flex items-center justify-center disabled:bg-gray-200 disabled:cursor-not-allowed"
                            title="Find matching script for this step"
                        >
                            {nodeData.isMatching ? (
                                <Loader2 size={16} className="animate-spin mr-2" />
                            ) : (
                                <Search size={16} className="mr-2" />
                            )}
                            Rematch Script
                        </button>
                        <button
                            onClick={() => onCreateScript(nodeData.index)}
                            disabled={nodeData.isMatching || nodeData.isCreating}
                            className="flex-1 p-2 bg-green-100 text-green-600 rounded-lg shadow-sm hover:bg-green-200 transition text-sm flex items-center justify-center disabled:bg-gray-200 disabled:cursor-not-allowed"
                            title="Create a new script for this step using AI"
                        >
                            {nodeData.isCreating ? (
                                <Loader2 size={16} className="animate-spin mr-2" />
                            ) : (
                                <Sparkles size={16} className="mr-2" />
                            )}
                            Generate Script
                        </button>
                    </div>
                </div>
                {/* --- END OF MODIFICATION --- */}

                 <div>
                    <label className="text-sm font-semibold mb-1 block">Manage Scripts</label>
                    <button onClick={onAddNewScript} className="w-full flex items-center justify-center p-2 bg-blue-100 text-blue-600 rounded-lg shadow-sm hover:bg-blue-200 transition text-sm font-semibold">
                        <Plus size={16} className="mr-2" /> Add New Global Script
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PropertiesPanel;