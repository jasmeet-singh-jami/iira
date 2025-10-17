// src/App.js
import React, { useState, useEffect } from 'react';
import Modal from './components/Modal';
import AddNewScriptModal from './components/AddNewScriptModal';
import SopIngestion from './components/SopIngestion';
import IncidentResolution from './components/IncidentResolution';
import History from './components/History';
import SopDeletion from './components/SopDeletion';
import ConfirmationModal from './components/ConfirmationModal';
import ClarificationModal from './components/ClarificationModal';
import {
    fetchScriptsApi,
    uploadSOPApi,
    resolveIncidentApi,
    executeScriptApi,
    parseSOPApi,
    deleteScriptApi,
    matchScriptApi,
    generateSOPApi,
    generateScriptFromContextApi // 1. Import the New API Function
} from './services/apis';

function App() {
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');
    // 2. Update Step State
    const [steps, setSteps] = useState([{ description: '', script: '', isMatching: false, isCreating: false }]);
    const [rawText, setRawText] = useState('');
    const [incidentNumber, setIncidentNumber] = useState('');
    const [incidentDetails, setIncidentDetails] = useState(null);
    const [resolvedScripts, setResolvedScripts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isExecutingAll, setIsExecutingAll] = useState(false);
    const [availableScripts, setAvailableScripts] = useState([]);
    const [modal, setModal] = useState({ visible: false, message: '' });
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [scriptToEdit, setScriptToEdit] = useState(null);
    const [activeTab, setActiveTab] = useState('ingest');
    const [confirmationModal, setConfirmationModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });
    const [clarification, setClarification] = useState({
        isNeeded: false,
        questions: [],
    });
    const [userAnswers, setUserAnswers] = useState({});

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

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

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
            fetchScripts();
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
        // 4. Update resetSOPSteps
        setSteps([{ description: '', script: '', isMatching: false, isCreating: false }]);
        setRawText('');
    };

    const handleGenerateSOP = async () => {
        if (!rawText.trim()) {
            setModal({ visible: true, message: 'Please enter a problem description to generate an SOP.' });
            return;
        }
        setLoading(true);
        try {
            const response = await generateSOPApi(rawText, null);

            if (response.status === 'clarification_needed') {
                setClarification({ isNeeded: true, questions: response.questions });
                const initialAnswers = response.questions.reduce((acc, q) => ({ ...acc, [q]: '' }), {});
                setUserAnswers(initialAnswers);
            } else if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({...s, isMatching: false, isCreating: false })));
                setModal({ visible: true, message: 'SOP draft generated successfully! Please review the results.' });
            }
        } catch (error) {
            console.error('Error generating SOP:', error);
            setModal({ visible: true, message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSubmission = async () => {
        setLoading(true);
        setClarification({ isNeeded: false, questions: [] });
        try {
            const response = await generateSOPApi(rawText, userAnswers);

            if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({...s, isMatching: false, isCreating: false })));
                setModal({ visible: true, message: 'SOP draft generated successfully from your answers! Please review.' });
            }
        } catch (error) {
            console.error('Error generating SOP with answers:', error);
            setModal({ visible: true, message: error.message });
        } finally {
            setLoading(false);
        }
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
            setSteps(parsedData.steps.map(s => ({...s, isMatching: false, isCreating: false })));
            setModal({ visible: true, message: 'SOP parsed successfully! Please review the extracted data.' });
        } catch (error) {
            console.error('Error parsing SOP:', error);
            setModal({ visible: true, message: 'Failed to parse SOP with AI. ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRematchStepScript = async (stepIndex) => {
        const currentStep = steps[stepIndex];
        if (!currentStep || !currentStep.description.trim()) {
            setModal({ visible: true, message: 'Please enter a description for the step before matching.' });
            return;
        }

        let updatedSteps = [...steps];
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], isMatching: true };
        setSteps(updatedSteps);

        try {
            const matchResult = await matchScriptApi(currentStep.description);
            updatedSteps = [...steps]; // Re-fetch state in case it changed
            updatedSteps[stepIndex] = { 
                ...updatedSteps[stepIndex], 
                script_id: matchResult.script_id, 
                script: matchResult.script_name 
            };
            setModal({ visible: true, message: matchResult.script_name ? `Found match: ${matchResult.script_name}` : 'No confident script match found.' });
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            updatedSteps = [...steps];
            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], isMatching: false };
            setSteps(updatedSteps);
        }
    };

    // 3. Create the Handler Function
    const handleCreateScriptForStep = async (stepIndex) => {
        const targetStep = steps[stepIndex];
        if (!targetStep || !targetStep.description.trim()) {
            setModal({ visible: true, message: 'Please provide a description for the step before generating a script.' });
            return;
        }

        let updatedSteps = [...steps];
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], isCreating: true };
        setSteps(updatedSteps);

        try {
            const context = {
                title: title,
                issue: issue,
                steps: steps.map(s => s.description),
                target_step_description: targetStep.description
            };

            const generatedScript = await generateScriptFromContextApi(context);
            
            setScriptToEdit(generatedScript);
            setIsScriptModalOpen(true);

        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            updatedSteps = [...steps];
            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], isCreating: false };
            setSteps(updatedSteps);
        }
    };

    const handleStepChange = (index, field, value) => {
        const updatedSteps = [...steps];
        const step = { ...updatedSteps[index] };

        if (field === 'script_id') {
            const selectedScript = availableScripts.find(s => String(s.id) === String(value));
            step.script_id = value;
            step.script = selectedScript ? selectedScript.name : null;
        } else {
            step[field] = value;
        }
        updatedSteps[index] = step;
        setSteps(updatedSteps);
    };

    const addStep = () => {
        // 4. Update addStep
        setSteps([...steps, { description: '', script: '', isMatching: false, isCreating: false }]);
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

        const payloadSteps = validSteps.map(({ description, script_id }) => ({
            description,
            script_id: script_id === "Not Found" ? null : script_id
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

    const handleDraftSopFromHistory = (incident) => {
        if (!incident || !incident.incident_data) {
            setModal({ visible: true, message: 'Could not load incident data to draft an SOP.' });
            return;
        }
        const { short_description, description, cmdb_ci } = incident.incident_data;
        const problemDescription = `Short Description: ${short_description || 'N/A'}\nDescription: ${description || 'N/A'}\nHost/CI: ${cmdb_ci || 'N/A'}`;
        setRawText(problemDescription);
        setActiveTab('ingest');
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
                        handleGenerateSOP={handleGenerateSOP}
                        handleRematchStepScript={handleRematchStepScript}
                        // 5. Pass the Prop
                        onCreateScriptForStep={handleCreateScriptForStep}
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
                        onDraftSop={handleDraftSopFromHistory}
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

            <ClarificationModal
                isOpen={clarification.isNeeded}
                questions={clarification.questions}
                answers={userAnswers}
                setAnswers={setUserAnswers}
                onSubmit={handleAnswerSubmission}
                onClose={() => setClarification({ isNeeded: false, questions: [] })}
                loading={loading}
            />
        </div>
    );
}

export default App;

