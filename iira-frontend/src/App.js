// src/App.js
import React, { useState, useEffect } from 'react';
import Modal from './components/Modal';
import AddNewScriptModal from './components/AddNewScriptModal';
import SopIngestion from './components/SopIngestion';
import IncidentResolution from './components/IncidentResolution';
import History from './components/History';
import SopDeletion from './components/SopDeletion';
// --- MODIFICATION: Import ConfirmationModal ---
import ConfirmationModal from './components/ConfirmationModal'; 
import { fetchScriptsApi, uploadSOPApi, resolveIncidentApi, executeScriptApi, parseSOPApi, deleteScriptApi } from './services/apis';

function App() {
    // State for the SOP ingestion form
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');
    const [steps, setSteps] = useState([{ description: '', script: '' }]);
    const [rawText, setRawText] = useState(''); 

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
    
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [scriptToEdit, setScriptToEdit] = useState(null);
    
    const [activeTab, setActiveTab] = useState('ingest');

    // State for history tab (new)
    const [incidentHistory, setIncidentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyModal, setHistoryModal] = useState({ visible: false, message: '' });

    // --- NEW: Add state for the confirmation modal ---
    const [confirmationModal, setConfirmationModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });
    // --- END NEW ---

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

    const handleOpenAddScriptModal = () => {
        setScriptToEdit(null);
        setIsScriptModalOpen(true);
    };

    const handleOpenEditScriptModal = (script) => {
        setScriptToEdit(script);
        setIsScriptModalOpen(true);
    };
    
    const handleCloseScriptModal = () => {
        setIsScriptModalOpen(false);
        setTimeout(() => {
            setScriptToEdit(null);
        }, 300);
    };

    const handleDeleteScript = (script) => {
        if (!script) return;
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Script',
            message: `Are you sure you want to permanently delete the script "${script.name}"? This action cannot be undone.`,
            onConfirm: () => confirmDeleteScript(script.id),
        });
    };

    const confirmDeleteScript = async (scriptId) => {
        try {
            const response = await deleteScriptApi(scriptId);
            setModal({ visible: true, message: response.message });
            fetchScripts(); // Refresh the script list
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            closeConfirmationModal();
        }
    };

    const closeConfirmationModal = () => {
        setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    };

    const resetSOPSteps = () => {
        setTitle('');
        setIssue('');
        setSteps([{ description: '', script: '' }]);
        setRawText('');
        console.log("Form reset successfully.");
    };

    const handleParseDocument = async () => {
        if (!rawText.trim()) {
            setModal({ visible: true, message: 'Please paste some text to parse.' });
            return;
        }
        setLoading(true);
        try {
            const parsedData = await parseSOPApi(rawText);
            setTitle(parsedData.title);
            setIssue(parsedData.issue);
            setSteps(parsedData.steps);
            setModal({ visible: true, message: 'SOP parsed successfully! Please review the extracted data and make any necessary adjustments before uploading.', onAddSOP: null });
        } catch (error) {
            console.error('Error parsing SOP:', error);
            setModal({ visible: true, message: 'Failed to parse SOP with AI. ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleStepChange = (index, field, value) => {
        const updatedSteps = [...steps];
        
        if (field === 'script_id') {
            const selectedScript = availableScripts.find(s => s.id === value);
            updatedSteps[index]['script_id'] = value;
            updatedSteps[index]['script'] = selectedScript ? selectedScript.name : null; 
        } else {
            updatedSteps[index][field] = value;
        }
        
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

        const unresolvedStep = steps.find(step => step.script_id === 'Not Found');
        if (unresolvedStep) {
            setModal({ 
                visible: true, 
                message: `Please select a script for all steps. The step starting with "${unresolvedStep.description.substring(0, 40)}..." is missing a script.` 
            });
            return;
        }

        const validSteps = steps.filter(step => step.description.trim());

        if (validSteps.length === 0) {
            setModal({ visible: true, message: 'Please provide at least one step with a description.' });
            return;
        }

        const payloadSteps = validSteps.map(({ description, script }) => ({
            description,
            script: script || null
        }));

        try {
            const sop = { title, issue, steps: payloadSteps };
            await uploadSOPApi(sop);
            setModal({ visible: true, message: 'SOP ingested successfully!' });
            resetSOPSteps();
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
        setResolvedScripts(prev => {
            const updatedScripts = [...prev];
            updatedScripts[scriptIndex] = { ...updatedScripts[scriptIndex], executionStatus: 'running', output: 'Executing...' };
            return updatedScripts;
        });
        try {
            const response = await executeScriptApi(scriptToExecute.script_id, scriptToExecute.script_name, scriptToExecute.extracted_parameters);
            setResolvedScripts(prev => {
                const updatedScripts = [...prev];
                updatedScripts[scriptIndex] = { ...updatedScripts[scriptIndex], executionStatus: response.status === 'success' ? 'success' : 'error', output: response.output };
                return updatedScripts;
            });
        } catch (error) {
            setResolvedScripts(prev => {
                const updatedScripts = [...prev];
                updatedScripts[scriptIndex] = { ...updatedScripts[scriptIndex], executionStatus: 'error', output: error.message };
                return updatedScripts;
            });
        }
    };

    const onExecuteAll = async () => {
        setIsExecutingAll(true);
        let currentScripts = [...resolvedScripts];
        for (let i = 0; i < currentScripts.length; i++) {
            const script = currentScripts[i];
            const missingRequiredParam = script.parameters.find(p => p.required && !script.extracted_parameters?.[p.param_name]);
            if (missingRequiredParam) {
                setModal({ visible: true, message: `Cannot execute all scripts. Workflow stopped at step ${i + 1} because a required parameter "${missingRequiredParam.param_name}" is missing.` });
                setIsExecutingAll(false);
                return;
            }
        }
        for (let i = 0; i < currentScripts.length; i++) {
            const script = currentScripts[i];
            if (script.executionStatus === 'success') continue;
            setResolvedScripts(prev => {
                const newScripts = [...prev];
                newScripts[i] = { ...newScripts[i], executionStatus: 'running', output: 'Executing...' };
                return newScripts;
            });
            try {
                const response = await executeScriptApi(script.script_id, script.script_name, script.extracted_parameters);
                setResolvedScripts(prev => {
                    const newScripts = [...prev];
                    newScripts[i] = { ...newScripts[i], executionStatus: response.status === 'success' ? 'success' : 'error', output: response.output };
                    return newScripts;
                });
                if (response.status === 'error') break;
            } catch (error) {
                setResolvedScripts(prev => {
                    const newScripts = [...prev];
                    newScripts[i] = { ...newScripts[i], executionStatus: 'error', output: error.message };
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
                    <button onClick={() => setActiveTab('ingest')} className={`py-3 px-8 text-xl font-bold rounded-l-full transition duration-300 focus:outline-none ${activeTab === 'ingest' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        SOP Onboarding
                    </button>
                    <button onClick={() => setActiveTab('delete')} className={`py-3 px-8 text-xl font-bold transition duration-300 focus:outline-none ${activeTab === 'delete' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        SOP Deletion
                    </button>
                    <button onClick={() => setActiveTab('search')} className={`py-3 px-8 text-xl font-bold transition duration-300 focus:outline-none ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                        Test Bed
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`py-3 px-8 text-xl font-bold rounded-r-full transition duration-300 focus:outline-none ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
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
                        onAddNewScript={handleOpenAddScriptModal}
                        onEditScript={handleOpenEditScriptModal}
                        onDeleteScript={handleDeleteScript}
                        uploadSOP={uploadSOP}
                        rawText={rawText} 
                        setRawText={setRawText} 
                        handleParseDocument={handleParseDocument} 
                        loading={loading}
                        resetSOPSteps={resetSOPSteps}
                    />
                )}

                {activeTab === 'delete' && <SopDeletion />}

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
                isOpen={isScriptModalOpen}
                onClose={handleCloseScriptModal}
                onScriptAdded={fetchScripts}
                scripts={availableScripts}
                scriptToEdit={scriptToEdit}
            />

            
            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={closeConfirmationModal}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />
            
        </div>
    );
}

export default App;

