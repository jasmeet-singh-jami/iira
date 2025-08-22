// src/components/SopIngestion.js
import React from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';

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
    setIsNewScriptModalOpen,
    uploadSOP
}) => {
    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-6 border-b-2 pb-2 border-blue-100">
                SOP Ingestion
            </h2>
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

                <h4 className="text-xl font-bold mt-8 mb-4 text-blue-700">Steps:</h4>
                {steps.map((step, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                        <input
                            type="text"
                            placeholder={`Step ${index + 1} description`}
                            value={step.description}
                            onChange={e => handleStepChange(index, 'description', e.target.value)}
                            className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                        />
                        <div className="relative w-full sm:w-auto flex items-center space-x-2">
                            {/* New container to wrap the select and its icon */}
                            <div className="relative flex-1">
                                <select
                                    value={step.script}
                                    onChange={e => handleStepChange(index, 'script', e.target.value)}
                                    className="block w-full appearance-none bg-white border border-gray-300 px-4 py-3 rounded-lg pr-8 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                                >
                                    <option value="" disabled>Select a script</option>
                                    {availableScripts.map(script => (
                                        <option key={script.id} value={script.name}>
                                            {script.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <ChevronDown className="h-4 w-4" />
                                </div>
                            </div>
                            <button onClick={() => setIsNewScriptModalOpen(true)} className="p-2 bg-blue-100 text-blue-600 rounded-full shadow-md hover:bg-blue-200 transition duration-200 flex-shrink-0" title="Add New Script" >
                                <Plus size={20} />
                            </button>
                        </div>
                        {steps.length > 1 && (<button onClick={() => removeStep(index)} className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition duration-200" ><X size={20} /></button>)}
                    </div>
                ))}
                <button onClick={addStep} className="flex items-center px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 mt-4" >
                    <Plus size={20} className="mr-2" /> Add Step
                </button>
            </div>
            <button onClick={uploadSOP} className="w-full sm:w-auto mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-300 transform hover:scale-105" >
                Upload SOP
            </button>
        </div>
    );
};

export default SopIngestion;
