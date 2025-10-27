// src/components/RunbookIngestion.js
import React from 'react';
import { BrainCircuit, Wand2, RefreshCcw, Loader2 } from 'lucide-react';
import WorkflowBuilder from './WorkflowBuilder'; // Import the wrapper

const RunbookIngestion = ({
    title,
    setTitle,
    issue,
    setIssue,
    tags,
    setTags,
    steps,
    onStepsChange,
    availableScripts, // Represents Worker Tasks
    onAddNewScript,
    uploadRunbook,
    rawText,
    setRawText,
    handleParseDocument,
    handleGenerateRunbook,
    handleRematchStepScript,
    onCreateScriptForStep,
    isGenerating,
    isParsing,
    resetRunbookSteps,
    onAddStep,
    onDeleteStep,
    onInsertStep,
    setConfirmationModal // <<< RECEIVE PROP
}) => {

    console.log("RunbookIngestion rendering or received props. Type of onInsertStep:", typeof onInsertStep);

    const isWorkflowView = steps.length > 1 || (steps.length === 1 && steps[0].description !== 'New Step' && steps[0].description !== '');

    return (
        <div className="p-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-8">
                 {/* ... header ... */}
                 <div>
                    <h1 className="text-4xl font-extrabold text-gray-800">Onboard New Agent</h1>
                    <p className="mt-1 text-gray-500">Create a new automated workflow using AI or by parsing an existing document.</p>
                </div>
                 <button
                    onClick={resetRunbookSteps}
                    className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition duration-300"
                >
                    <RefreshCcw size={16} className="mr-2" /> Reset Form
                </button>
            </div>

            {!isWorkflowView ? (
                // PHASE 1: Initial Onboarding View
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-6 shadow-inner">
                     {/* ... Phase 1 content ... */}
                     <h3 className="text-xl font-bold text-blue-700 mb-3 flex items-center">
                        <Wand2 className="h-6 w-6 mr-2" /> AI-Powered Agent Onboarding
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Enter a problem description to generate a new Agent, or paste an existing document to parse it.
                    </p>
                    <textarea
                        placeholder="Describe the problem you want to solve (e.g., 'A web server is down and needs to be restarted') OR paste in a full, pre-written Agent document..."
                        value={rawText}
                        onChange={e => setRawText(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm"
                    />
                    <div className="flex justify-end space-x-2 mt-4">
                        <button
                            onClick={handleGenerateRunbook}
                            disabled={isGenerating || isParsing}
                            className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${isGenerating || isParsing ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 text-white shadow-lg hover:bg-purple-700'}`}
                        >
                            {isGenerating ? <Loader2 size={20} className="animate-spin mr-2" /> : <BrainCircuit size={20} className="mr-2" />}
                            {isGenerating ? 'Drafting...' : 'Draft Agent with AI'}
                        </button>
                        <button
                            onClick={handleParseDocument}
                            disabled={isGenerating || isParsing}
                            className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${isGenerating || isParsing ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}
                        >
                            {isParsing ? <Loader2 size={20} className="animate-spin mr-2" /> : <Wand2 size={20} className="mr-2" />}
                            {isParsing ? 'Parsing...' : 'Parse Existing Agent'}
                        </button>
                    </div>
                </div>
            ) : (
                // PHASE 2: Workflow Builder View
                <div>
                    <div className="space-y-4 mb-6">
                         {/* ... Input fields ... */}
                         <input
                            type="text"
                            placeholder="Agent Title"
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
                            placeholder="Tags (comma-separated)"
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                         />
                    </div>
                    {/* <<< PASS PROP DOWN HERE >>> */}
                    <WorkflowBuilder
                        key={steps.length}
                        initialSteps={steps}
                        availableScripts={availableScripts}
                        onStepsChange={onStepsChange}
                        onSave={uploadRunbook}
                        onAddNewScript={onAddNewScript}
                        onRematchStep={handleRematchStepScript}
                        onCreateScript={onCreateScriptForStep}
                        onAddStep={onAddStep}
                        onDeleteStep={onDeleteStep}
                        onInsertStep={onInsertStep}
                        setConfirmationModal={setConfirmationModal} // Pass setter down
                    />
                </div>
            )}
        </div>
    );
};

export default RunbookIngestion;

