// src/components/IncidentResolution.js
import React, { useState } from 'react';
import { Search, Loader2, Play, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

/**
 * A reusable modal component for displaying messages or prompting for input.
 * This is designed to be a simple, centered overlay.
 * @param {Object} props - The component props.
 * @param {string} props.title - The title of the modal.
 * @param {string} props.message - The main message to display.
 * @param {boolean} props.visible - Controls the visibility of the modal.
 * @param {function} props.onClose - Function to call when the modal should close.
 * @param {React.ReactNode} props.children - Content to render inside the modal body.
 */
const Modal = ({ title, message, visible, onClose, children }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 transition-opacity duration-300 ease-in-out opacity-100">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-200 transform scale-100 transition-transform duration-300 ease-in-out">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertCircle className="text-red-500 w-6 h-6" />
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                </div>
                <p className="text-gray-600 mb-6">{message}</p>
                {children}
                <div className="flex justify-end mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Main component for resolving incidents. It allows users to search for an incident
 * and displays a proposed resolution workflow with executable scripts.
 * @param {Object} props - The component props.
 * @param {string} props.incidentNumber - The current incident number input value.
 * @param {function} props.setIncidentNumber - Function to update the incident number state.
 * @param {function} props.resolveIncident - Function to trigger incident resolution search.
 * @param {boolean} props.loading - Indicates if the search for the incident is in progress.
 * @param {Object} props.incidentDetails - The fetched details of the incident.
 * @param {Array<Object>} props.resolvedScripts - An array of proposed scripts with their statuses.
 * @param {function} props.executeScript - Function to execute a single script.
 * @param {function} props.onExecuteAll - Function to execute all scripts in the workflow.
 */
const IncidentResolution = ({
    incidentNumber,
    setIncidentNumber,
    resolveIncident,
    loading,
    incidentDetails,
    resolvedScripts,
    executeScript,
    onExecuteAll
}) => {
    const [modal, setModal] = useState({
        visible: false,
        message: '',
        paramName: '',
        script: null,
        index: null
    });
    const [inputValue, setInputValue] = useState('');

    /**
     * Handles the Enter key press in the incident number input field.
     * @param {Object} e - The keyboard event.
     */
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            resolveIncident();
        }
    };

    /**
     * Handles the click event for executing a single script.
     * It checks for any required parameters that are missing and prompts the user
     * for them via a modal.
     * @param {Object} script - The script object to execute.
     * @param {number} index - The index of the script in the list.
     */
    const handleExecuteClick = (script, index) => {
        const updatedScript = { ...script, extracted_parameters: { ...script.extracted_parameters } };
        let missingRequiredParam = null;

        // Loop through all parameters to check for missing required values
        for (const param of script.parameters) {
            const extractedValue = updatedScript.extracted_parameters[param.param_name];
            if (!extractedValue) {
                if (param.default_value) {
                    updatedScript.extracted_parameters[param.param_name] = param.default_value;
                } else if (param.required) {
                    missingRequiredParam = param;
                    break;
                }
            }
        }

        if (missingRequiredParam) {
            setModal({
                visible: true,
                message: `Please provide a value for parameter: "${missingRequiredParam.param_name}"`,
                paramName: missingRequiredParam.param_name,
                script: updatedScript,
                index
            });
        } else {
            // No missing parameters, execute the script directly
            executeScript(updatedScript, index);
        }
    };

    /**
     * Submits the value from the modal input field and triggers the script execution.
     */
    const handleModalSubmit = () => {
        if (inputValue.trim() && modal.script) {
            const updatedScript = { ...modal.script };
            updatedScript.extracted_parameters = {
                ...updatedScript.extracted_parameters,
                [modal.paramName]: inputValue.trim()
            };
            executeScript(updatedScript, modal.index);
            setModal({ visible: false, message: '', paramName: '', script: null, index: null });
            setInputValue('');
        }
    };

    /**
     * Handles the Enter key press inside the modal input field.
     * @param {Object} e - The keyboard event.
     */
    const handleModalKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleModalSubmit();
        }
    };

    /**
     * Renders the appropriate icon based on the script's execution status.
     * @param {string} status - The execution status ('running', 'success', 'error', or default).
     * @returns {React.ReactNode} The icon component.
     */
    const renderStepIcon = (status) => {
        switch (status) {
            case 'running':
                return <Loader2 className="animate-spin text-blue-600" size={24} />;
            case 'success':
                return <CheckCircle className="text-green-600" size={24} />;
            case 'error':
                return <XCircle className="text-red-600" size={24} />;
            default:
                return <Play className="text-gray-400" size={24} />;
        }
    };

    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-6 border-b-2 pb-2 border-blue-100">
                Resolve Incident
            </h2>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mb-6">
                <input
                    type="text"
                    value={incidentNumber}
                    onChange={e => setIncidentNumber(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter an incident number (e.g., INC001)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                />
                <button
                    onClick={resolveIncident}
                    className="flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
                    disabled={loading}
                >
                    {loading ? (<Loader2 className="animate-spin h-5 w-5 mr-2" />) : (<Search size={20} className="mr-2" />)}
                    {loading ? 'Searching...' : 'Search SOP'}
                </button>
            </div>

            {loading && <div className="text-center py-8 text-gray-500 text-lg">Searching for a resolution...</div>}

            {incidentDetails && (
                <div className="mt-8 bg-blue-50 p-6 rounded-2xl shadow-inner border border-blue-200">
                    <h3 className="text-2xl font-bold text-blue-800 mb-2">Incident: {incidentDetails.number}</h3>
                    <p className="text-lg font-semibold text-gray-700 mb-2">{incidentDetails.short_description}</p>
                    <p className="text-gray-600">{incidentDetails.description}</p>
                    <div className="flex flex-wrap mt-4 space-x-4 text-sm font-medium">
                        <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full">Status: {incidentDetails.state}</span>
                        <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full">Host: {incidentDetails.host}</span>
                        <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full">Assigned To: {incidentDetails.assigned_to}</span>
                    </div>
                </div>
            )}

            {resolvedScripts.length > 0 && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-blue-800">Proposed Resolution Workflow</h3>
                        <button
                            onClick={onExecuteAll}
                            // The disabled state should be managed by the parent component, so we don't need executingAll state here.
                            // The parent should pass a 'disabled' prop to this component, but for now we'll assume it's handled externally.
                            disabled={resolvedScripts.some(script => script.executionStatus === 'running')}
                            className={`flex items-center px-4 py-2 rounded-lg shadow-md font-semibold transition duration-300 ${
                                resolvedScripts.some(script => script.executionStatus === 'running') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {resolvedScripts.some(script => script.executionStatus === 'running') ? (
                                <>
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                    Executing All...
                                </>
                            ) : (
                                <>
                                    <Play size={18} className="mr-2" />
                                    Execute All
                                </>
                            )}
                        </button>
                    </div>

                    {/* Step-by-step progress dashboard */}
                    <div className="flex items-center space-x-4 mb-6 overflow-x-auto p-2 rounded-xl bg-gray-100 border border-gray-200">
                        {resolvedScripts.map((script, index) => (
                            <div key={index} className="flex flex-col items-center flex-shrink-0">
                                <div className={`w-12 h-12 flex items-center justify-center rounded-full border-2 ${
                                    script.executionStatus === 'success' ? 'border-green-500' :
                                    script.executionStatus === 'error' ? 'border-red-500' :
                                    script.executionStatus === 'running' ? 'border-blue-500' :
                                    'border-gray-300'
                                }`}>
                                    {renderStepIcon(script.executionStatus)}
                                </div>
                                <span className="text-xs mt-1 text-gray-700 font-medium">Step {index + 1}</span>
                            </div>
                        ))}
                    </div>

                    {/* Detailed step cards */}
                    <div className="space-y-6">
                        {resolvedScripts.map((script, index) => (
                            <div key={`${script.script_id}-${index}`} className="bg-gray-50 p-6 rounded-2xl shadow-inner border border-gray-200 flex items-start space-x-4">
                                <div className={`flex items-center justify-center w-10 h-10 font-bold rounded-full text-xl flex-shrink-0 ${
                                    script.executionStatus === 'success' ? 'bg-green-600 text-white' :
                                    script.executionStatus === 'error' ? 'bg-red-600 text-white' :
                                    'bg-blue-600 text-white'
                                }`}>
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg font-semibold text-gray-800 mb-2">{script.step_description}</p>
                                    {script.script_name ? (
                                        <div className="bg-gray-200 text-gray-700 p-3 rounded-lg font-mono text-sm">
                                            <span className="font-bold text-blue-700">Script:</span> {script.script_name}
                                            {script.parameters && script.parameters.length > 0 && (
                                                <div className="mt-2 text-xs">
                                                    <span className="font-bold text-blue-700">Parameters:</span>
                                                    <ul className="list-disc list-inside ml-4">
                                                        {script.parameters.map((param, i) => {
                                                            const extractedValue = script.extracted_parameters?.[param.param_name];
                                                            return (
                                                                <li key={i} className="flex items-center space-x-2 my-1">
                                                                    <span className="font-bold text-gray-800">{param.param_name}:</span>
                                                                    {extractedValue ? (
                                                                        <span className="bg-green-600/30 text-green-700 px-2 py-0.5 rounded-md font-semibold">{extractedValue}</span>
                                                                    ) : (
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="bg-red-600/30 text-red-700 px-2 py-0.5 rounded-md font-semibold">Value Not Found</span>
                                                                            {param.default_value && (
                                                                                <span className="bg-gray-400/30 text-gray-700 px-2 py-0.5 rounded-md font-semibold">Default: "{param.default_value}"</span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                            {script.output && (
                                                <div className="mt-2 p-3 bg-gray-100 rounded-lg border border-gray-300 overflow-x-auto">
                                                    <p className="font-semibold text-sm">Output:</p>
                                                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono mt-1">{script.output}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg font-semibold text-sm">
                                            <AlertCircle size={16} className="inline mr-2" />
                                            No matching script found for this step.
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleExecuteClick(script, index)}
                                    disabled={script.executionStatus === 'running'}
                                    className={`flex-shrink-0 p-2 rounded-full shadow-md transition duration-300 ${
                                        script.executionStatus === 'running'
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                                    title="Execute Script"
                                >
                                    {script.executionStatus === 'running' ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : script.executionStatus === 'success' ? (
                                        <CheckCircle size={20} className="text-green-500" />
                                    ) : script.executionStatus === 'error' ? (
                                        <XCircle size={20} className="text-red-500" />
                                    ) : (
                                        <Play size={20} />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Modal for parameter input */}
            <Modal
                title="Parameter Required"
                message={modal.message}
                visible={modal.visible}
                onClose={() => setModal({ visible: false, message: '', paramName: '', script: null, index: null })}
            >
                {modal.visible && (
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder={`Enter value for ${modal.paramName}`}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleModalKeyDown}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleModalSubmit}
                                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-300"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default IncidentResolution;
