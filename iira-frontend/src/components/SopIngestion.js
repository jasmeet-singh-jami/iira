import React, { useState } from 'react';
import { Plus, X, ChevronDown, Wand2, RefreshCcw, Loader2, Pencil } from 'lucide-react';


const SopIngestion = ({
    title,
    setTitle,
    issue,
    setIssue,
    steps,
    handleStepChange,
    addStep,
    removeStep,
    availableScripts,
    onAddNewScript, // Changed from setIsNewScriptModalOpen
    onEditScript,   // New prop to handle editing
    uploadSOP,
    rawText,
    setRawText,
    handleParseDocument,
    loading,
    resetSOPSteps
}) => {
    // State to track which script is selected in the new "edit" dropdown
    const [scriptIdToEdit, setScriptIdToEdit] = useState('');

    // Handler to find the selected script object and pass it to the parent
    const handleEditScript = () => {
        if (!scriptIdToEdit) return;
        const script = availableScripts.find(s => s.id === scriptIdToEdit);
        if (script) {
            onEditScript(script);
        }
    };

    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-6 border-b-2 pb-2 border-blue-100">
                SOP Ingestion
            </h2>

            {/* AI Parsing Section... no changes needed here */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-6 shadow-inner">
                <h3 className="text-xl font-bold text-blue-700 mb-3 flex items-center">
                    <Wand2 className="h-6 w-6 mr-2" /> AI-Powered SOP Parsing
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Paste your raw SOP document below. The AI will automatically extract the title, issue, and structured steps, mapping them to available scripts.
                </p>
                <textarea
                    placeholder="Paste your raw SOP document text here..."
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                />
                <div className="flex justify-end space-x-2 mt-4">
                    <button
                        onClick={handleParseDocument}
                        disabled={loading}
                        className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Wand2 size={20} className="mr-2" />}
                        {loading ? 'Parsing...' : 'Parse SOP with AI'}
                    </button>
                </div>
            </div>
            
            <div className="flex justify-end mb-4">
                <button
                    onClick={resetSOPSteps}
                    className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg shadow-md hover:bg-gray-300 transition duration-300"
                >
                    <RefreshCcw size={16} className="mr-2" /> Reset Form
                </button>
            </div>

            <div className="space-y-4">
                <input
                    type="text"
                    placeholder="SOP Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                />
                <textarea
                    placeholder="Issue Description"
                    value={issue}
                    onChange={e => setIssue(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                />
            </div>

            <div className="space-y-6 mt-6">
                <h3 className="text-2xl font-bold text-gray-800 border-b pb-2">Steps</h3>
                {steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-3 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="flex-shrink-0 mt-3 font-semibold text-lg text-gray-600">{index + 1}.</span>
                        <div className="flex-grow space-y-2">
                            <input
                                type="text"
                                placeholder="Step Description"
                                value={step.description || ''}
                                onChange={e => handleStepChange(index, 'description', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                            />
                            <div className="relative flex items-center space-x-2">
                                <div className="relative flex-grow">
                                    <select
                                        value={step.script_id || ''}
                                        onChange={e => handleStepChange(index, 'script_id', e.target.value)}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none transition duration-200"
                                    >
                                        <option value="">Select a Script (Optional)</option>
                                        {availableScripts.map(script => (
                                            <option key={script.id} value={script.id}>{script.name}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                        <ChevronDown className="h-4 w-4" />
                                    </div>
                                </div>
                                <button onClick={onAddNewScript} className="p-2 bg-blue-100 text-blue-600 rounded-full shadow-md hover:bg-blue-200 transition duration-200 flex-shrink-0" title="Add New Script">
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                        {steps.length > 1 && (<button onClick={() => removeStep(index)} className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition duration-200" ><X size={20} /></button>)}
                    </div>
                ))}
                {/* --- NEW SECTION for adding and editing scripts --- */}
                <div className="flex items-center space-x-4 mt-4 pt-4 border-t">
                    <button onClick={addStep} className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300" >
                        <Plus size={20} className="mr-2" /> Add Step
                    </button>
                    
                    <div className="flex items-center space-x-2 border-l pl-4">
                        <select
                            value={scriptIdToEdit}
                            onChange={(e) => setScriptIdToEdit(e.target.value)}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                        >
                            <option value="">Select script to edit...</option>
                            {availableScripts.map((script) => (
                                <option key={script.id} value={script.id}>
                                    {script.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleEditScript}
                            disabled={!scriptIdToEdit}
                            className="flex items-center px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <Pencil size={18} className="mr-2" /> Edit Script
                        </button>
                    </div>
                </div>
                {/* --- END NEW SECTION --- */}
            </div>
            <button onClick={uploadSOP} className="w-full sm:w-auto mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-300" >
                Upload SOP
            </button>
        </div>
    );
};

export default SopIngestion;
