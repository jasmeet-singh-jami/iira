// src/App.js
import React, { useState, useEffect } from 'react';
import Modal from './components/Modal';
import AddNewScriptModal from './components/AddNewScriptModal';
import SopIngestion from './components/SopIngestion';
import IncidentResolution from './components/IncidentResolution';
import History from './components/History';
import { fetchScriptsApi, uploadSOPApi, resolveIncidentApi, executeScriptApi } from './services/apis';

function App() {
    // State for the SOP ingestion form
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');
    const [steps, setSteps] = useState([{ description: '', script: '' }]);

    // State for the SOP search functionality
    const [incidentNumber, setIncidentNumber] = useState('');
    const [incidentDetails, setIncidentDetails] = useState(null);
    const [resolvedScripts, setResolvedScripts] = useState([]);
    const [loading, setLoading] = useState(false);

    // New state to manage the 'Execute All' process
    const [isExecutingAll, setIsExecutingAll] = useState(false);

    // Global state
    const [availableScripts, setAvailableScripts] = useState([]);
    const [modal, setModal] = useState({ visible: false, message: '' });
    const [isNewScriptModalOpen, setIsNewScriptModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('search');
    
    // State for history tab (new)
    const [incidentHistory, setIncidentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyModal, setHistoryModal] = useState({ visible: false, message: '' });

    const fetchScripts = async () => {
        try {
            const scripts = await fetchScriptsApi();
            setAvailableScripts(scripts);
        } catch (error) {
            console.error(error.message);
            setModal({ visible: true, message: error.message });
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);
    
    // ✅ Handle History Tab Fetching
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            // This is now handled within the History component
        } catch (error) {
            setHistoryModal({ visible: true, message: 'Failed to load history: ' + error.message });
        } finally {
            setLoadingHistory(false);
        }
    };
    
    // We can remove the useEffect that calls fetchHistory on tab change because the History component will handle its own data fetching.

    const handleStepChange = (index, field, value) => {
        const updatedSteps = [...steps];
        updatedSteps[index][field] = value;
        setSteps(updatedSteps);
    };

    const addStep = () => {
        setSteps([...steps, { description: '', script: '' }]);
    };

    const removeStep = (index) => {
        const updatedSteps = steps.filter((_, i) => i !== index);
        setSteps(updatedSteps);
    };

    const uploadSOP = async () => {
        if (!title.trim() || !issue.trim()) {
            setModal({ visible: true, message: 'Title and Issue cannot be empty.' });
            return;
        }

        const validSteps = steps.filter(step => step.description.trim() && step.script.trim());

        if (validSteps.length === 0) {
            setModal({ visible: true, message: 'Please provide at least one valid step with a description and a selected script.' });
            return;
        }

        try {
            const sop = { title, issue, steps: validSteps };
            await uploadSOPApi(sop);
            setModal({ visible: true, message: 'SOP ingested successfully!' });
            setTitle('');
            setIssue('');
            setSteps([{ description: '', script: '' }]);
        } catch (error) {
            console.error(error.message);
            setModal({ visible: true, message: error.message });
        }
    };

    const switchToIngestTab = () => {
        setActiveTab('ingest');
        setModal({ visible: false, message: '' });
    };

    const resolveIncident = async () => {
        if (!incidentNumber.trim()) {
            setModal({ visible: true, message: 'Please enter an incident number.' });
            return;
        }

        setLoading(true);
        setIncidentDetails(null);
        setResolvedScripts([]);

        try {
            const incidentResults = await resolveIncidentApi(incidentNumber);

            if (incidentResults.resolved_scripts && incidentResults.resolved_scripts.length > 0) {
                setIncidentDetails(incidentResults.incident_data);
                setResolvedScripts(
                    incidentResults.resolved_scripts.map(s => ({ ...s, executionStatus: 'idle', output: '' }))
                );
                setModal({ visible: false, message: '' });
            } else {
                setIncidentDetails(null);
                setResolvedScripts([]);
                setModal({ visible: true, message: 'No relevant SOPs or scripts found for this incident.', onAddSOP: switchToIngestTab });
            }
        } catch (error) {
            console.error(error.message);
            setIncidentDetails(null);
            setResolvedScripts([]);
            setModal({ visible: true, message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const executeScript = async (scriptToExecute, scriptIndex) => {
        // Update status to 'running'
        setResolvedScripts(prev => {
            const updatedScripts = [...prev];
            updatedScripts[scriptIndex] = {
                ...updatedScripts[scriptIndex],
                executionStatus: 'running',
                output: 'Executing...'
            };
            return updatedScripts;
        });

        try {
            const response = await executeScriptApi(
                scriptToExecute.script_id,
                scriptToExecute.script_name,
                scriptToExecute.extracted_parameters
            );

            // Update status based on API response
            setResolvedScripts(prev => {
                const updatedScripts = [...prev];
                updatedScripts[scriptIndex] = {
                    ...updatedScripts[scriptIndex],
                    executionStatus: response.status === 'success' ? 'success' : 'error',
                    output: response.output
                };
                return updatedScripts;
            });

        } catch (error) {
            // Update status to 'error' on API call failure
            setResolvedScripts(prev => {
                const updatedScripts = [...prev];
                updatedScripts[scriptIndex] = {
                    ...updatedScripts[scriptIndex],
                    executionStatus: 'error',
                    output: error.message
                };
                return updatedScripts;
            });
        }
    };

    const onExecuteAll = async () => {
        setIsExecutingAll(true);

        // Work with a copy of the current resolvedScripts state
        let currentScripts = [...resolvedScripts];

        // Check for missing required parameters before starting execution
        for (let i = 0; i < currentScripts.length; i++) {
            const script = currentScripts[i];
            const missingRequiredParam = script.parameters.find(
                param => param.required && !script.extracted_parameters?.[param.param_name]
            );

            if (missingRequiredParam) {
                setModal({
                    visible: true,
                    message: `Cannot execute all scripts. The workflow stopped at step ${i + 1} because a required parameter "${missingRequiredParam.param_name}" is missing.`
                });
                setIsExecutingAll(false);
                return;
            }
        }

        // Execute scripts sequentially
        for (let i = 0; i < currentScripts.length; i++) {
            const script = currentScripts[i];

            // Skip scripts that already succeeded (optional, depending on your requirements)
            if (script.executionStatus === 'success') {
                continue;
            }

            // Update status to 'running'
            setResolvedScripts(prev => {
                const newScripts = [...prev];
                newScripts[i] = { ...newScripts[i], executionStatus: 'running', output: 'Executing...' };
                return newScripts;
            });

            try {
                const response = await executeScriptApi(
                    script.script_id,
                    script.script_name,
                    script.extracted_parameters
                );

                // Update status and output based on API response
                setResolvedScripts(prev => {
                    const newScripts = [...prev];
                    newScripts[i] = {
                        ...newScripts[i],
                        executionStatus: response.status === 'success' ? 'success' : 'error',
                        output: response.output
                    };
                    return newScripts;
                });

                // Stop execution if a script fails
                if (response.status === 'error') {
                    break;
                }
            } catch (error) {
                // Handle API call failure
                setResolvedScripts(prev => {
                    const newScripts = [...prev];
                    newScripts[i] = {
                        ...newScripts[i],
                        executionStatus: 'error',
                        output: error.message
                    };
                    return newScripts;
                });
                break;
            }
        }

        setIsExecutingAll(false);
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-8 font-sans antialiased text-gray-800">
            <div className="container mx-auto max-w-4xl bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-200">
                <div className="flex justify-center mb-8">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`py-3 px-8 text-xl font-bold rounded-l-full transition duration-300 focus:outline-none ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Resolve Incident
                    </button>
                    <button
                        onClick={() => setActiveTab('ingest')}
                        className={`py-3 px-8 text-xl font-bold transition duration-300 focus:outline-none ${activeTab === 'ingest' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        SOP Ingestion
                    </button>
                    {/* ✅ New History Tab Button */}
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`py-3 px-8 text-xl font-bold rounded-r-full transition duration-300 focus:outline-none ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        History
                    </button>
                </div>

                {activeTab === 'ingest' && (
                    <SopIngestion
                        title={title}
                        setTitle={setTitle}
                        issue={issue}
                        setIssue={setIssue}
                        steps={steps}
                        handleStepChange={handleStepChange}
                        addStep={addStep}
                        removeStep={removeStep}
                        availableScripts={availableScripts}
                        setIsNewScriptModalOpen={setIsNewScriptModalOpen}
                        uploadSOP={uploadSOP}
                    />
                )}

                {activeTab === 'search' && (
                    <IncidentResolution
                        incidentNumber={incidentNumber}
                        setIncidentNumber={setIncidentNumber}
                        resolveIncident={resolveIncident}
                        loading={loading}
                        incidentDetails={incidentDetails}
                        resolvedScripts={resolvedScripts}
                        executeScript={executeScript}
                        onExecuteAll={onExecuteAll}
                    />
                )}

                {/* ✅ Render the new History component */}
                {activeTab === 'history' && (
                    <History
                        incidentHistory={incidentHistory}
                        loading={loadingHistory}
                        modal={historyModal}
                        setModal={setHistoryModal}
                    />
                )}
            </div>

            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} onAddSOP={modal.onAddSOP} />
            <AddNewScriptModal
                isOpen={isNewScriptModalOpen}
                onClose={() => setIsNewScriptModalOpen(false)}
                onScriptAdded={fetchScripts}
                scripts={availableScripts}
            />
        </div>
    );
}

export default App;
