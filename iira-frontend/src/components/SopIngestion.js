import React, { useState } from 'react';
// --- MODIFICATION: Import BrainCircuit icon for the new button ---
import { Plus, X, ChevronDown, Wand2, RefreshCcw, Loader2, Pencil, Trash2, Search, BrainCircuit } from 'lucide-react';
// --- END MODIFICATION ---
import SearchableDropdown from './SearchableDropdown';

const SopIngestion = ({
    title,
    setTitle,
    issue,
    setIssue,
    tags,
    setTags,
    steps,
    handleStepChange,
    addStep,
    removeStep,
    availableScripts,
    onAddNewScript,
    onEditScript,
    onDeleteScript,
    uploadSOP,
    rawText,
    setRawText,
    handleParseDocument,
    // --- NEW: Receive the generator handler ---
    handleGenerateSOP,
    // --- END NEW ---
    handleRematchStepScript,
    loading,
    resetSOPSteps
}) => {
    const [scriptIdToEdit, setScriptIdToEdit] = useState('');

    const handleEditScript = () => {
        if (!scriptIdToEdit) return;
        const script = availableScripts.find(s => String(s.id) === String(scriptIdToEdit));
        if (script) {
            onEditScript(script);
        }
    };
    
    const handleDeleteScript = () => {
        if (!scriptIdToEdit) return;
        const script = availableScripts.find(s => String(s.id) === String(scriptIdToEdit));
        if (script) {
            onDeleteScript(script);
        }
    };

    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-6 border-b-2 pb-2 border-blue-100">
                SOP Onboarding
            </h2>

            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-6 shadow-inner">
                <h3 className="text-xl font-bold text-blue-700 mb-3 flex items-center">
                    <Wand2 className="h-6 w-6 mr-2" /> AI-Powered SOP Onboarding
                </h3>
                {/* --- MODIFICATION: Updated placeholder text --- */}
                <p className="text-sm text-gray-600 mb-4">
                    Enter a problem description to generate a new SOP, or paste an existing document to parse it.
                </p>
                <textarea
                    placeholder="Describe the problem you want to solve (e.g., 'A web server is down and needs to be restarted') OR paste in a full, pre-written SOP document..."
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                />
                {/* --- END MODIFICATION --- */}
                <div className="flex justify-end space-x-2 mt-4">
                    {/* --- NEW: "Draft SOP with AI" Button --- */}
                    <button
                        onClick={handleGenerateSOP}
                        disabled={loading}
                        className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${loading ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 text-white shadow-lg hover:bg-purple-700'}`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <BrainCircuit size={20} className="mr-2" />}
                        {loading ? 'Drafting...' : 'Draft SOP with AI'}
                    </button>
                    {/* --- END NEW --- */}
                    <button
                        onClick={handleParseDocument}
                        disabled={loading}
                        className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}
                    >
                        {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Wand2 size={20} className="mr-2" />}
                        {loading ? 'Parsing...' : 'Parse Existing SOP'}
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
                <input
                    type="text"
                    placeholder="Tags (comma-separated, e.g., billing-service, app-server-01, database)"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                />
            </div>


            <div className="space-y-6 mt-6">
                <h3 className="text-2xl font-bold text-gray-800 border-b pb-2">Steps</h3>
                {steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-3 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                        <span className="flex-shrink-0 mt-3 font-semibold text-lg text-gray-600">{index + 1}.</span>
                        <div className="flex-grow space-y-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    placeholder="Step Description"
                                    value={step.description || ''}
                                    onChange={e => handleStepChange(index, 'description', e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                                />
                                <button
                                    onClick={() => handleRematchStepScript(index)}
                                    disabled={step.isMatching}
                                    className="p-3 bg-indigo-100 text-indigo-600 rounded-lg shadow-md hover:bg-indigo-200 transition duration-200 flex-shrink-0 disabled:bg-gray-200 disabled:cursor-not-allowed"
                                    title="Find matching script for this step"
                                >
                                    {step.isMatching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                                </button>
                            </div>
                            <div className="relative flex items-center space-x-2">
                                <div className="relative flex-grow">
                                    <SearchableDropdown
                                        options={availableScripts}
                                        value={step.script_id || ''}
                                        onChange={(value) => handleStepChange(index, 'script_id', value)}
                                        placeholder="Select a Script (Optional)"
                                    />
                                </div>
                                <button onClick={onAddNewScript} className="p-2 bg-blue-100 text-blue-600 rounded-full shadow-md hover:bg-blue-200 transition duration-200 flex-shrink-0" title="Add New Script">
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                        {steps.length > 1 && (<button onClick={() => removeStep(index)} className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition duration-200" ><X size={20} /></button>)}
                    </div>
                ))}
                <div className="flex items-center space-x-4 mt-4 pt-4 border-t">
                    <button onClick={addStep} className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300" >
                        <Plus size={20} className="mr-2" /> Add Step
                    </button>
                    
                    <div className="flex items-center space-x-2 border-l pl-4 w-full md:w-2/3">
                        <SearchableDropdown
                            options={availableScripts}
                            value={scriptIdToEdit}
                            onChange={setScriptIdToEdit}
                            placeholder="Select script to manage..."
                        />
                        <button
                            onClick={handleEditScript}
                            disabled={!scriptIdToEdit}
                            className="flex items-center px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <Pencil size={18} className="mr-2" /> Edit
                        </button>
                        <button
                            onClick={handleDeleteScript}
                            disabled={!scriptIdToEdit}
                            className="flex items-center px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <Trash2 size={18} className="mr-2" /> Delete
                        </button>
                    </div>
                </div>
            </div>
            <button onClick={uploadSOP} className="w-full sm:w-auto mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-300" >
                Upload SOP
            </button>
        </div>
    );
};

export default SopIngestion;

