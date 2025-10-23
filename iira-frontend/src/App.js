// src/App.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import History from './components/History';
import RunbookDeletion from './components/RunbookDeletion';
import RunbookIngestion from './components/RunbookIngestion';
import ScriptsPage from './components/ScriptsPage';
import IncidentResolution from './components/IncidentResolution';
import Modal from './components/Modal';
import AddNewScriptModal from './components/AddNewScriptModal';
import ConfirmationModal from './components/ConfirmationModal';
import ClarificationModal from './components/ClarificationModal';

import {
    fetchScriptsApi,
    uploadSOPApi,
    resolveIncidentApi,
    deleteScriptApi,
    matchScriptApi,
    generateSOPApi,
    generateScriptFromContextApi,
    parseSOPApi,
    executeScriptApi,
    generateScriptSimpleApi
} from './services/apis';

// Helper function to create a new default step object
const createNewStep = () => ({
    description: 'New Step',
    script_id: null,
    script: null, // Keep script name consistent
    isMatching: false,
    isCreating: false
});

function App() {
    const [activePage, setActivePage] = useState('dashboard');

    // State for the Runbook ingestion form
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');
    const [tags, setTags] = useState('');
    const [steps, setSteps] = useState([createNewStep()]); // Start with one default step
    const [rawText, setRawText] = useState('');

    // State for Incident Resolution (Test Bed)
    const [incidentNumber, setIncidentNumber] = useState('');
    const [incidentDetails, setIncidentDetails] = useState(null);
    const [resolvedScripts, setResolvedScripts] = useState([]);

    // Global state
    const [availableScripts, setAvailableScripts] = useState([]);
    const [incidentLoading, setIncidentLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false); // For Agent generation/parsing
    const [isParsing, setIsParsing] = useState(false);       // For Agent generation/parsing
    const [modal, setModal] = useState({ visible: false, message: '' });
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [scriptToEdit, setScriptToEdit] = useState(null);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [clarification, setClarification] = useState({ isNeeded: false, questions: [] });
    const [userAnswers, setUserAnswers] = useState({});

    const fetchScripts = async () => {
        try {
            const scripts = await fetchScriptsApi();
            setAvailableScripts(scripts);
        } catch (error) {
            console.error(error.message);
            setModal({ visible: true, message: "Failed to load Worker Tasks." });
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    const handleOpenAddScriptModal = () => {
        setScriptToEdit(null);
        setIsScriptModalOpen(true);
    };

    // This function will be called when the user confirms deletion in the modal
    const confirmDeleteScript = async (scriptId) => {
        try {
            const response = await deleteScriptApi(scriptId);
            setModal({ visible: true, message: response.message });
            fetchScripts(); // Refresh script list
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            closeConfirmationModal(); // Close the modal after action
        }
    };

    const closeConfirmationModal = () => {
        setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    };

    const resetRunbookForm = () => {
        setTitle('');
        setIssue('');
        setTags('');
        setSteps([createNewStep()]); // Reset to one new step
        setRawText('');
    };

    const handleDraftAndGenerateFromHistory = async (incident) => {
        const description = `Incident ${incident.incident_number}: ${incident.incident_data.short_description}\n\nFull Description:\n${incident.incident_data.description || ''}`;
        setRawText(description);
        setActivePage('onboard-runbook');
        setIsGenerating(true);
        try {
            const response = await generateSOPApi(description, null);
            if (response.status === 'clarification_needed') {
                setClarification({ isNeeded: true, questions: response.questions });
                const initialAnswers = response.questions.reduce((acc, q) => ({ ...acc, [q]: '' }), {});
                setUserAnswers(initialAnswers);
            } else if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({ ...createNewStep(), ...s })));
                setModal({ visible: true, message: 'Agent draft generated successfully from history!' });
            }
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateRunbook = async () => {
        if (!rawText.trim()) {
            setModal({ visible: true, message: 'Please enter a problem description to generate an Agent.' });
            return;
        }
        setIsGenerating(true);
        try {
            const response = await generateSOPApi(rawText, null);
            if (response.status === 'clarification_needed') {
                setClarification({ isNeeded: true, questions: response.questions });
                const initialAnswers = response.questions.reduce((acc, q) => ({ ...acc, [q]: '' }), {});
                setUserAnswers(initialAnswers);
            } else if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({ ...createNewStep(), ...s })));
                setModal({ visible: true, message: 'Agent draft generated successfully!' });
            }
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnswerSubmission = async () => {
        setIsGenerating(true);
        setClarification({ isNeeded: false, questions: [] });
        try {
            const response = await generateSOPApi(rawText, userAnswers);
            if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({ ...createNewStep(), ...s })));
                setModal({ visible: true, message: 'Agent draft generated successfully from your answers!' });
            }
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleParseDocument = async () => {
        if (!rawText.trim()) {
            setModal({ visible: true, message: 'Please paste some text to parse.' });
            return;
        }
        setIsParsing(true);
        try {
            const parsedData = await parseSOPApi(rawText);
            setTitle(parsedData.title);
            setIssue(parsedData.issue);
            setSteps(parsedData.steps.map(s => ({ ...createNewStep(), ...s })));
            setModal({ visible: true, message: 'Agent parsed successfully!' });
        } catch (error) {
            setModal({ visible: true, message: 'Failed to parse Agent with AI. ' + error.message });
        } finally {
            setIsParsing(false);
        }
    };

    const handleRematchStepScript = async (stepIndex) => {
        if (stepIndex < 0 || stepIndex >= steps.length) return;
        const currentStep = steps[stepIndex];
        if (!currentStep || !currentStep.description.trim()) {
            setModal({ visible: true, message: 'Please enter a description for the step before matching.' });
            return;
        }
        setSteps(currentSteps => currentSteps.map((step, idx) => idx === stepIndex ? { ...step, isMatching: true } : step));
        try {
            const matchResult = await matchScriptApi(currentStep.description);
            setSteps(currentSteps => currentSteps.map((step, idx) => {
                if (idx === stepIndex) {
                    return { ...step, script_id: matchResult.script_id, script: matchResult.script_name, isMatching: false };
                }
                return step;
            }));
            setModal({ visible: true, message: matchResult.script_name ? `Found match: ${matchResult.script_name}` : 'No confident worker task match found.' });
        } catch (error) {
            setModal({ visible: true, message: error.message });
             setSteps(currentSteps => currentSteps.map((step, idx) => idx === stepIndex ? { ...step, isMatching: false } : step));
        }
    };

    const handleCreateScriptForStep = async (stepIndex) => {
         if (stepIndex < 0 || stepIndex >= steps.length) return;
        const targetStep = steps[stepIndex];
        if (!targetStep || !targetStep.description.trim()) {
            setModal({ visible: true, message: 'Please provide a description for the step before generating a worker task.' });
            return;
        }
        setSteps(currentSteps => currentSteps.map((step, idx) => idx === stepIndex ? { ...step, isCreating: true } : step));
        try {
            const context = {
                title: title, issue: issue, steps: steps.map(s => s.description),
                target_step_description: targetStep.description
            };
            const generatedScript = await generateScriptFromContextApi(context);
            setScriptToEdit({ ...createNewStep(), ...generatedScript });
            setIsScriptModalOpen(true);
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setSteps(currentSteps => currentSteps.map((step, idx) => idx === stepIndex ? { ...step, isCreating: false } : step));
        }
    };

    const onStepsChange = (newSteps) => {
        console.log("App.js onStepsChange received:", newSteps);
        setSteps(newSteps);
    };

    const handleAddStep = () => {
        console.log("App.js handleAddStep called");
        setSteps(currentSteps => [ ...currentSteps, createNewStep() ]);
    };

    const handleDeleteStep = (indexToDelete) => {
        console.log("App.js requesting delete confirmation for index:", indexToDelete);
        if (steps.length <= 1) {
            setModal({ visible: true, message: 'Cannot delete the only step.' });
            return;
        }
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Step',
            message: `Are you sure you want to delete Step ${indexToDelete + 1}? This action cannot be undone.`,
            onConfirm: () => {
                console.log("Confirmation received for deleting index:", indexToDelete);
                setSteps(currentSteps => currentSteps.filter((_, index) => index !== indexToDelete));
                closeConfirmationModal();
            }
        });
    };

    const handleInsertStep = (indexToInsertAfter) => {
        console.log("App.js handleInsertStep called for index after:", indexToInsertAfter);
        setSteps(currentSteps => {
            const newSteps = [...currentSteps];
            newSteps.splice(indexToInsertAfter + 1, 0, createNewStep());
            return newSteps;
        });
    };

    const uploadRunbook = async () => {
        if (!title.trim()) {
            setModal({ visible: true, message: 'Agent Title cannot be empty.' }); return;
        }
        if (!issue.trim()) {
            setModal({ visible: true, message: 'Issue Description cannot be empty.' }); return;
        }
        const validSteps = steps
          .filter(step => step.description.trim() && step.description !== 'New Step')
          .map(({ isMatching, isCreating, index, ...rest }) => rest);
        if (validSteps.length === 0) {
            setModal({ visible: true, message: 'Please provide at least one valid step description (not "New Step").' }); return;
        }
        try {
            const sopPayload = {
                title, issue,
                tags: tags.split(',').map(t=>t.trim()).filter(t => t),
                steps: validSteps
            };
            await uploadSOPApi(sopPayload);
            setModal({ visible: true, message: 'Agent ingested successfully!' });
            resetRunbookForm();
        } catch (error) {
            setModal({ visible: true, message: `Failed to ingest Agent: ${error.message}` });
        }
    };

    const resolveIncident = async () => {
        if (!incidentNumber.trim()) {
            setModal({ visible: true, message: 'Please enter an incident number.' });
            return;
        }
        setIncidentLoading(true);
        setResolvedScripts([]);
        try {
            const data = await resolveIncidentApi(incidentNumber);
            setIncidentDetails(data.incident_data);
            // Ensure resolvedScripts is always an array
            setResolvedScripts(Array.isArray(data.resolved_scripts) ? data.resolved_scripts : []);
        } catch (error) {
            setModal({ visible: true, message: error.message });
            setIncidentDetails(null);
            setResolvedScripts([]); // Clear on error too
        } finally {
            setIncidentLoading(false);
        }
    };

    const executeScript = async (scriptToExecute, scriptIndex) => {
        // Ensure scriptIndex is valid
        if (scriptIndex < 0 || scriptIndex >= resolvedScripts.length) return;

        setResolvedScripts(currentScripts =>
            currentScripts.map((script, index) =>
                index === scriptIndex ? { ...script, executionStatus: 'running' } : script
            )
        );

        try {
            // Use the correct API function name
            const result = await executeScriptApi(
                scriptToExecute.script_id,
                scriptToExecute.script_name,
                scriptToExecute.extracted_parameters || {} // Ensure parameters is an object
            );
            setResolvedScripts(currentScripts =>
                currentScripts.map((script, index) =>
                    index === scriptIndex ? { ...script, executionStatus: result.status, output: result.output } : script
                )
            );
        } catch (error) {
            setResolvedScripts(currentScripts =>
                currentScripts.map((script, index) =>
                    index === scriptIndex ? { ...script, executionStatus: 'error', output: error.message } : script
                )
            );
        }
    };

    const onExecuteAll = async () => {
         // Create a stable copy of the scripts to iterate over
         const scriptsToExecute = [...resolvedScripts];
         for (let i = 0; i < scriptsToExecute.length; i++) {
             const step = scriptsToExecute[i];
             // Check the *current* state before executing
             const currentStepState = resolvedScripts[i];
             if (step.script_id && step.script_id !== 'Not Found' && currentStepState.executionStatus !== 'success' && currentStepState.executionStatus !== 'running') {
                  await executeScript(step, i);
                  // Optional: Add a small delay between executions if needed
                  // await new Promise(resolve => setTimeout(resolve, 500));
             }
         }
     };


    const pageVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
    };

    const pageTransition = {
        type: 'tween',
        ease: 'anticipate',
        duration: 0.4,
    };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                // Pass setActivePage to Dashboard
                return <Dashboard setActivePage={setActivePage} />;
            case 'history':
                return <History onDraftRunbook={handleDraftAndGenerateFromHistory} />;
            case 'manage-runbooks':
                return <RunbookDeletion />;
            case 'onboard-runbook':
                 console.log("App.js rendering RunbookIngestion, typeof onInsertStep:", typeof handleInsertStep);
                 return <RunbookIngestion
                            title={title} setTitle={setTitle}
                            issue={issue} setIssue={setIssue}
                            tags={tags} setTags={setTags}
                            steps={steps}
                            onStepsChange={onStepsChange}
                            availableScripts={availableScripts}
                            onAddNewScript={handleOpenAddScriptModal}
                            uploadRunbook={uploadRunbook}
                            rawText={rawText} setRawText={setRawText}
                            handleParseDocument={handleParseDocument}
                            handleGenerateRunbook={handleGenerateRunbook}
                            handleRematchStepScript={handleRematchStepScript}
                            onCreateScriptForStep={handleCreateScriptForStep}
                            isGenerating={isGenerating}
                            isParsing={isParsing}
                            resetRunbookSteps={resetRunbookForm}
                            onAddStep={handleAddStep}
                            onDeleteStep={handleDeleteStep}
                            onInsertStep={handleInsertStep}
                            setConfirmationModal={setConfirmationModal}
                        />;
            case 'scripts':
                return <ScriptsPage setConfirmationModal={setConfirmationModal}/>;
            case 'testbed':
                return <IncidentResolution
                            incidentNumber={incidentNumber} setIncidentNumber={setIncidentNumber}
                            resolveIncident={resolveIncident} loading={incidentLoading}
                            incidentDetails={incidentDetails}
                            resolvedScripts={resolvedScripts}
                            executeScript={executeScript}
                            onExecuteAll={onExecuteAll}
                        />;
            default:
                 // Pass setActivePage to Dashboard as default
                return <Dashboard setActivePage={setActivePage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans antialiased text-gray-800">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activePage}
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        {renderPage()}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Modals */}
            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
            <AddNewScriptModal
                isOpen={isScriptModalOpen}
                onClose={() => setIsScriptModalOpen(false)}
                onScriptAdded={fetchScripts}
                scripts={availableScripts}
                scriptToEdit={scriptToEdit}
                generateScriptSimpleApi={generateScriptSimpleApi}
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
                loading={isGenerating}
            />
        </div>
    );
}

export default App;

