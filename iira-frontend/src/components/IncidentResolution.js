import React, { useState } from 'react';
import { Search, Loader2, Play, AlertCircle } from 'lucide-react';
import WorkflowTimeline from './WorkflowTimeline'; // Import the new component

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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            resolveIncident();
        }
    };

    const handleExecuteClick = (script, index) => {
        const updatedScript = { ...script, extracted_parameters: { ...script.extracted_parameters } };
        let missingRequiredParam = null;

        for (const param of (script.parameters || [])) {
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
            executeScript(updatedScript, index);
        }
    };

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

    const handleModalKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleModalSubmit();
        }
    };

    return (
        <div className="p-8">
            <div className="pb-4 border-b border-gray-200 mb-8">
                <h1 className="text-4xl font-extrabold text-gray-800">Test Bed</h1>
                <p className="mt-1 text-gray-500">Manually resolve an incident to test an Agent resolution flow.</p> {/* Changed description */}
            </div>

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
                    {loading ? 'Searching...' : 'Find Resolution'}
                </button>
            </div>

            {loading && <div className="text-center py-8 text-gray-500 text-lg">Searching for a resolution...</div>}

            {incidentDetails && (
                <div className="mt-8 bg-blue-50 p-6 rounded-2xl shadow-inner border border-blue-200">
                    <h3 className="text-2xl font-bold text-blue-800 mb-2">Incident: {incidentDetails.number}</h3>
                    <p className="text-lg font-semibold text-gray-700 mb-2">{incidentDetails.short_description}</p>
                    <p className="text-gray-600">{incidentDetails.description}</p>
                </div>
            )}

            {resolvedScripts.length > 0 && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-800">Proposed Resolution Workflow</h3>
                        <button
                            onClick={onExecuteAll}
                            disabled={resolvedScripts.some(script => script.executionStatus === 'running')}
                            className={`flex items-center px-4 py-2 rounded-lg shadow-md font-semibold transition duration-300 ${
                                resolvedScripts.some(script => script.executionStatus === 'running') ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {resolvedScripts.some(script => script.executionStatus === 'running') ? (
                                <><Loader2 size={18} className="animate-spin mr-2" /> Executing All...</>
                            ) : (
                                <><Play size={18} className="mr-2" /> Execute All</>
                            )}
                        </button>
                    </div>

                    <WorkflowTimeline
                        steps={resolvedScripts}
                        onExecuteStep={handleExecuteClick}
                        executionDisabled={resolvedScripts.some(s => s.executionStatus === 'running')}
                    />
                </div>
            )}
            
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
