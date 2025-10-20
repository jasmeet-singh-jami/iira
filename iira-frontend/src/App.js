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
    parseSOPApi
} from './services/apis';

function App() {
    const [activePage, setActivePage] = useState('dashboard');

    // State for the Runbook ingestion form
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');
    const [tags, setTags] = useState('');
    const [steps, setSteps] = useState([{ description: '', script_id: null, isMatching: false, isCreating: false }]);
    const [rawText, setRawText] = useState('');

    // State for Incident Resolution (Test Bed)
    const [incidentNumber, setIncidentNumber] = useState('');
    const [incidentDetails, setIncidentDetails] = useState(null);
    const [resolvedScripts, setResolvedScripts] = useState([]);

    // Global state
    const [availableScripts, setAvailableScripts] = useState([]);
    const [loading, setLoading] = useState(false);
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

    const confirmDeleteScript = async (scriptId) => {
        try {
            const response = await deleteScriptApi(scriptId);
            setModal({ visible: true, message: response.message });
            fetchScripts(); // Refresh script list
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            closeConfirmationModal();
        }
    };

    const closeConfirmationModal = () => {
        setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    };

    const resetRunbookForm = () => {
        setTitle('');
        setIssue('');
        setTags('');
        setSteps([{ description: '', script_id: null, isMatching: false, isCreating: false }]);
        setRawText('');
    };
    
    const handleDraftAndGenerateFromHistory = async (incident) => {
        const description = `Incident ${incident.incident_number}: ${incident.incident_data.short_description}\n\nFull Description:\n${incident.incident_data.description || ''}`;
        setRawText(description);
        setActivePage('onboard-runbook');
        setLoading(true);
        try {
            const response = await generateSOPApi(description, null);
            if (response.status === 'clarification_needed') {
                setClarification({ isNeeded: true, questions: response.questions });
                const initialAnswers = response.questions.reduce((acc, q) => ({ ...acc, [q]: '' }), {});
                setUserAnswers(initialAnswers);
            } else if (response.status === 'sop_generated') {
                setTitle(response.title);
                setIssue(response.issue);
                setSteps(response.steps.map(s => ({...s, isMatching: false, isCreating: false })));
                setModal({ visible: true, message: 'Runbook draft generated successfully from history!' });
            }
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateRunbook = async () => {
        if (!rawText.trim()) {
            setModal({ visible: true, message: 'Please enter a problem description to generate a Runbook.' });
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
                setModal({ visible: true, message: 'Runbook draft generated successfully!' });
            }
        } catch (error) {
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
                setModal({ visible: true, message: 'Runbook draft generated successfully from your answers!' });
            }
        } catch (error) {
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
            setModal({ visible: true, message: 'Runbook parsed successfully!' });
        } catch (error) {
            setModal({ visible: true, message: 'Failed to parse Runbook with AI. ' + error.message });
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
            updatedSteps = [...steps]; // Refetch state in case of changes
            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], script_id: matchResult.script_id, script: matchResult.script_name };
            setSteps(updatedSteps);
            setModal({ visible: true, message: matchResult.script_name ? `Found match: ${matchResult.script_name}` : 'No confident script match found.' });
        } catch (error) {
            setModal({ visible: true, message: error.message });
            updatedSteps = [...steps]; // Refetch state on error
        } finally {
            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], isMatching: false };
            setSteps(updatedSteps);
        }
    };

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
        updatedSteps[index][field] = value;
        setSteps(updatedSteps);
    };

    const addStep = () => {
        setSteps([...steps, { description: '', script_id: null, isMatching: false, isCreating: false }]);
    };

    const removeStep = (index) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const uploadRunbook = async () => {
        if (!title.trim() || !issue.trim()) {
            setModal({ visible: true, message: 'Title and Issue cannot be empty.' });
            return;
        }
        const validSteps = steps.filter(step => step.description.trim());
        if (validSteps.length === 0) {
            setModal({ visible: true, message: 'Please provide at least one step.' });
            return;
        }
        try {
            const sop = { title, issue, tags: tags.split(',').map(t=>t.trim()), steps: validSteps };
            await uploadSOPApi(sop);
            setModal({ visible: true, message: 'Runbook ingested successfully!' });
            resetRunbookForm();
        } catch (error) {
            setModal({ visible: true, message: error.message });
        }
    };

    const resolveIncident = async () => { /* ... unchanged ... */ };

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
                return <Dashboard />;
            case 'history':
                return <History onDraftRunbook={handleDraftAndGenerateFromHistory} />;
            case 'manage-runbooks':
                return <RunbookDeletion />;
            case 'onboard-runbook':
                 return <RunbookIngestion
                            title={title} setTitle={setTitle}
                            issue={issue} setIssue={setIssue}
                            tags={tags} setTags={setTags}
                            steps={steps} handleStepChange={handleStepChange}
                            addStep={addStep} removeStep={removeStep}
                            availableScripts={availableScripts}
                            onAddNewScript={handleOpenAddScriptModal}
                            uploadRunbook={uploadRunbook}
                            rawText={rawText} setRawText={setRawText}
                            handleParseDocument={handleParseDocument}
                            handleGenerateRunbook={handleGenerateRunbook}
                            handleRematchStepScript={handleRematchStepScript}
                            onCreateScriptForStep={handleCreateScriptForStep}
                            loading={loading} resetRunbookSteps={resetRunbookForm}
                        />;
            case 'scripts':
                return <ScriptsPage />;
            case 'testbed':
                return <IncidentResolution
                            incidentNumber={incidentNumber} setIncidentNumber={setIncidentNumber}
                            resolveIncident={resolveIncident} loading={loading}
                            incidentDetails={incidentDetails}
                            resolvedScripts={resolvedScripts}
                        />;
            default:
                return <Dashboard />;
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

            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
            <AddNewScriptModal
                isOpen={isScriptModalOpen}
                onClose={() => setIsScriptModalOpen(false)}
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