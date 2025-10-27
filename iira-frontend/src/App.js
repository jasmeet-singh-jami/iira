// src/App.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import History from './components/History';
import RunbookDeletion from './components/RunbookDeletion';
import RunbookIngestion from './components/RunbookIngestion';
import ScriptsPage from './components/ScriptsPage';
import AgentTrainer from './components/AgentTrainer';
import ManagementDashboard from './components/ManagementDashboard'; // Changed import
import Modal from './components/Modal';
import AddNewScriptModal from './components/AddNewScriptModal';
import ConfirmationModal from './components/ConfirmationModal';
import ClarificationModal from './components/ClarificationModal';

import {
    fetchScriptsApi, uploadSOPApi, deleteScriptApi, matchScriptApi,
    generateSOPApi, generateScriptFromContextApi, parseSOPApi,
    generateScriptSimpleApi, fetchAllSOPsApi,
    fetchAgentRecommendationsApi, submitRetrievalFeedbackApi, fetchSearchThresholdsApi
} from './services/apis';

const createNewStep = () => ({
    description: 'New Step', script_id: null, script: null,
    isMatching: false, isCreating: false
});

function App() {
    const [activePage, setActivePage] = useState('dashboard');
    const [ingestionTitle, setIngestionTitle] = useState('');
    const [ingestionIssue, setIngestionIssue] = useState('');
    const [ingestionTags, setIngestionTags] = useState('');
    const [ingestionSteps, setIngestionSteps] = useState([createNewStep()]);
    const [ingestionRawText, setIngestionRawText] = useState('');
    const [trainerIncidentNumber, setTrainerIncidentNumber] = useState('');
    const [trainerShortDesc, setTrainerShortDesc] = useState('');
    const [trainerDesc, setTrainerDesc] = useState('');
    const [recommendedAgents, setRecommendedAgents] = useState([]);
    const [searchThresholds, setSearchThresholds] = useState({});
    const [trainerLoading, setTrainerLoading] = useState(false);
    const [feedbackSessionId, setFeedbackSessionId] = useState(null);
    const [availableScripts, setAvailableScripts] = useState([]);
    const [allAgents, setAllAgents] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [modal, setModal] = useState({ visible: false, message: '' });
    const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
    const [scriptToEdit, setScriptToEdit] = useState(null);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [clarification, setClarification] = useState({ isNeeded: false, questions: [] });
    const [userAnswers, setUserAnswers] = useState({});

    const fetchInitialData = async () => {
        setTrainerLoading(true);
        try {
            const [scripts, agentsResponse, thresholds] = await Promise.all([
                fetchScriptsApi(),
                fetchAllSOPsApi(),
                fetchSearchThresholdsApi()
            ]);
            setAvailableScripts(scripts);
            setAllAgents(agentsResponse.map(agent => ({ id: agent.id, name: agent.title })));
            setSearchThresholds(thresholds);
            console.log("Initial data loaded:", { scripts: scripts.length, agents: agentsResponse.length, thresholds });
        } catch (error) {
            console.error("Error fetching initial data:", error.message);
            setModal({ visible: true, message: `Failed to load initial application data: ${error.message}` });
        } finally {
            setTrainerLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleOpenAddScriptModal = () => { setScriptToEdit(null); setIsScriptModalOpen(true); };
    const confirmDeleteScript = async (scriptId) => {
         try {
            const response = await deleteScriptApi(scriptId);
            setModal({ visible: true, message: response.message });
            fetchInitialData();
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { closeConfirmationModal(); }
     };
    const closeConfirmationModal = () => { setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} }); };

    const resetIngestionForm = () => {
        setIngestionTitle(''); setIngestionIssue(''); setIngestionTags('');
        setIngestionSteps([createNewStep()]); setIngestionRawText('');
    };
    const handleDraftAndGenerateFromHistory = async (incident) => {
         const description = `Incident ${incident.incident_number}: ${incident.incident_data.short_description}\n\nFull Description:\n${incident.incident_data.description || ''}`;
         setIngestionRawText(description);
         setActivePage('onboard-runbook');
     };
    const handleGenerateRunbook = async () => {
        if (!ingestionRawText.trim()) { setModal({ visible: true, message: 'Please enter a problem description.' }); return; }
        setIsGenerating(true);
        try {
            const response = await generateSOPApi(ingestionRawText, null);
            if (response.status === 'clarification_needed') {
                setClarification({ isNeeded: true, questions: response.questions });
                setUserAnswers(response.questions.reduce((acc, q) => ({ ...acc, [q]: '' }), {}));
            } else if (response.status === 'sop_generated') {
                setIngestionTitle(response.title); setIngestionIssue(response.issue);
                setIngestionSteps(response.steps.map(s => ({ ...createNewStep(), ...s })));
                setModal({ visible: true, message: 'Agent draft generated successfully!' });
            }
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { setIsGenerating(false); }
    };
    const handleAnswerSubmission = async () => {
        setIsGenerating(true); setClarification({ isNeeded: false, questions: [] });
        try {
            const response = await generateSOPApi(ingestionRawText, userAnswers);
            if (response.status === 'sop_generated') {
                setIngestionTitle(response.title); setIngestionIssue(response.issue);
                setIngestionSteps(response.steps.map(s => ({ ...createNewStep(), ...s })));
                setModal({ visible: true, message: 'Agent draft generated!' });
            }
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { setIsGenerating(false); }
    };
    const handleParseDocument = async () => {
        if (!ingestionRawText.trim()) { setModal({ visible: true, message: 'Please paste text to parse.' }); return; }
        setIsParsing(true);
        try {
            const parsedData = await parseSOPApi(ingestionRawText);
            setIngestionTitle(parsedData.title); setIngestionIssue(parsedData.issue);
            setIngestionSteps(parsedData.steps.map(s => ({ ...createNewStep(), ...s })));
            setModal({ visible: true, message: 'Agent parsed successfully!' });
        } catch (error) { setModal({ visible: true, message: `Failed to parse Agent: ${error.message}` }); }
        finally { setIsParsing(false); }
    };
     const handleRematchStepScript = async (stepIndex) => {
        if (stepIndex < 0 || stepIndex >= ingestionSteps.length) return;
        const currentStep = ingestionSteps[stepIndex];
        if (!currentStep?.description?.trim()) { setModal({ visible: true, message: 'Please enter step description.' }); return; }
        setIngestionSteps(s => s.map((step, idx) => idx === stepIndex ? { ...step, isMatching: true } : step));
        try {
            const matchResult = await matchScriptApi(currentStep.description);
            setIngestionSteps(s => s.map((step, idx) => idx === stepIndex ? { ...step, script_id: matchResult.script_id, script: matchResult.script_name, isMatching: false } : step));
            setModal({ visible: true, message: matchResult.script_name ? `Match: ${matchResult.script_name}` : 'No match found.' });
        } catch (error) { setModal({ visible: true, message: error.message }); setIngestionSteps(s => s.map((step, idx) => idx === stepIndex ? { ...step, isMatching: false } : step)); }
    };
    const handleCreateScriptForStep = async (stepIndex) => {
         if (stepIndex < 0 || stepIndex >= ingestionSteps.length) return;
        const targetStep = ingestionSteps[stepIndex];
        if (!targetStep?.description?.trim()) { setModal({ visible: true, message: 'Please provide step description.' }); return; }
        setIngestionSteps(s => s.map((step, idx) => idx === stepIndex ? { ...step, isCreating: true } : step));
        try {
            const context = { title: ingestionTitle, issue: ingestionIssue, steps: ingestionSteps.map(s => s.description), target_step_description: targetStep.description };
            const generatedScript = await generateScriptFromContextApi(context);
            setScriptToEdit({ ...createNewStep(), ...generatedScript });
            setIsScriptModalOpen(true);
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { setIngestionSteps(s => s.map((step, idx) => idx === stepIndex ? { ...step, isCreating: false } : step)); }
    };
    const onIngestionStepsChange = (newSteps) => { setIngestionSteps(newSteps); };
    const handleAddIngestionStep = () => { setIngestionSteps(s => [ ...s, createNewStep() ]); };
    const handleDeleteIngestionStep = (indexToDelete) => {
        if (ingestionSteps.length <= 1) { setModal({ visible: true, message: 'Cannot delete the only step.' }); return; }
        setConfirmationModal({
            isOpen: true, title: 'Delete Step', message: `Delete Step ${indexToDelete + 1}?`,
            onConfirm: () => { setIngestionSteps(s => s.filter((_, i) => i !== indexToDelete)); closeConfirmationModal(); }
        });
    };
    const handleInsertIngestionStep = (indexToInsertAfter) => {
        setIngestionSteps(s => { const newS = [...s]; newS.splice(indexToInsertAfter + 1, 0, createNewStep()); return newS; });
    };
    const uploadRunbook = async () => {
        if (!ingestionTitle.trim()) { setModal({ visible: true, message: 'Agent Title cannot be empty.' }); return; }
        if (!ingestionIssue.trim()) { setModal({ visible: true, message: 'Issue Description cannot be empty.' }); return; }
        const validSteps = ingestionSteps.filter(step => step.description.trim() && step.description !== 'New Step').map(({ isMatching, isCreating, index, ...rest }) => rest);
        if (validSteps.length === 0) { setModal({ visible: true, message: 'Please provide valid step descriptions.' }); return; }
        try {
            const sopPayload = { title: ingestionTitle, issue: ingestionIssue, tags: ingestionTags.split(',').map(t=>t.trim()).filter(t => t), steps: validSteps };
            await uploadSOPApi(sopPayload);
            setModal({ visible: true, message: 'Agent ingested successfully!' });
            resetIngestionForm();
             fetchInitialData();
        } catch (error) { setModal({ visible: true, message: `Failed to ingest Agent: ${error.message}` }); }
    };

    const handleFetchRecommendations = async () => {
        const hasIncidentNumber = trainerIncidentNumber.trim();
        const hasDescriptions = trainerShortDesc.trim() && trainerDesc.trim();

        if (!hasIncidentNumber && !hasDescriptions) {
            setModal({ visible: true, message: 'Please enter an Incident Number OR both Short Description and Full Description.' });
            return;
        }

        setTrainerLoading(true); setRecommendedAgents([]); setFeedbackSessionId(null);
        try {
            const data = await fetchAgentRecommendationsApi(trainerShortDesc, trainerDesc, trainerIncidentNumber);
            setRecommendedAgents(data.recommendations);
            if(data.thresholds && Object.keys(data.thresholds).length > 0) setSearchThresholds(data.thresholds);
            console.log("Recommendations received:", data.recommendations);
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { setTrainerLoading(false); }
    };

    const handleSubmitFeedback = async (feedbackType, recommendedAgent = null, selectedCorrectAgent = null) => {
        setTrainerLoading(true);
        const feedbackData = {
            incident_number: trainerIncidentNumber || null,
            incident_short_description: trainerShortDesc,
            incident_description: trainerDesc || null,
            recommended_agent_id: recommendedAgent?.id || null,
            recommended_agent_title: recommendedAgent?.title || null,
            search_score: recommendedAgent?.score || null,
            user_feedback_type: feedbackType,
            correct_agent_id: feedbackType === 'Correct'
                ? recommendedAgent?.id || null
                : selectedCorrectAgent?.id || null,
            correct_agent_title: feedbackType === 'Correct'
                ? recommendedAgent?.title || null
                : selectedCorrectAgent?.name || null,
            session_id: feedbackSessionId
        };
        try {
            const response = await submitRetrievalFeedbackApi(feedbackData);
            setFeedbackSessionId(response.session_id);
            setModal({ visible: true, message: "Feedback submitted successfully!" });
            setRecommendedAgents([]);
        } catch (error) {
            setModal({ visible: true, message: `Feedback failed: ${error.message}` });
        } finally {
            setTrainerLoading(false);
        }
    };

    const clearTrainerRecommendations = () => {
        setRecommendedAgents([]);
        setFeedbackSessionId(null);
    };

    const pageVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };
    const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.4 };

    const renderPage = () => {
        switch (activePage) {
            case 'dashboard':
                return <Dashboard setActivePage={setActivePage} />;
            case 'history':
                return <History onDraftRunbook={handleDraftAndGenerateFromHistory} />;
            case 'manage-runbooks':
                return <RunbookDeletion />;
            case 'onboard-runbook':
                 return <RunbookIngestion
                            title={ingestionTitle} setTitle={setIngestionTitle}
                            issue={ingestionIssue} setIssue={setIngestionIssue}
                            tags={ingestionTags} setTags={setIngestionTags}
                            steps={ingestionSteps}
                            onStepsChange={onIngestionStepsChange}
                            availableScripts={availableScripts}
                            onAddNewScript={handleOpenAddScriptModal}
                            uploadRunbook={uploadRunbook}
                            rawText={ingestionRawText} setRawText={setIngestionRawText}
                            handleParseDocument={handleParseDocument}
                            handleGenerateRunbook={handleGenerateRunbook}
                            handleRematchStepScript={handleRematchStepScript}
                            onCreateScriptForStep={handleCreateScriptForStep}
                            isGenerating={isGenerating}
                            isParsing={isParsing}
                            resetRunbookSteps={resetIngestionForm}
                            onAddStep={handleAddIngestionStep}
                            onDeleteStep={handleDeleteIngestionStep}
                            onInsertStep={handleInsertIngestionStep}
                            setConfirmationModal={setConfirmationModal}
                        />;
            case 'scripts':
                return <ScriptsPage setConfirmationModal={setConfirmationModal}/>;
            case 'management': // Changed case
                return <ManagementDashboard />;
            case 'testbed':
                return <AgentTrainer
                            incidentNumber={trainerIncidentNumber}
                            setIncidentNumber={setTrainerIncidentNumber}
                            shortDescription={trainerShortDesc}
                            setShortDescription={setTrainerShortDesc}
                            description={trainerDesc}
                            setDescription={setTrainerDesc}
                            onFetchRecommendations={handleFetchRecommendations}
                            recommendations={recommendedAgents}
                            thresholds={searchThresholds}
                            onSubmitFeedback={handleSubmitFeedback}
                            allAgents={allAgents}
                            loading={trainerLoading}
                            feedbackSessionId={feedbackSessionId}
                            clearRecommendations={clearTrainerRecommendations}
                        />;
            default:
                return <Dashboard setActivePage={setActivePage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans antialiased text-gray-800">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
                <AnimatePresence mode="wait">
                    <motion.div key={activePage} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
                        {renderPage()}
                    </motion.div>
                </AnimatePresence>
            </main>

            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
            <AddNewScriptModal isOpen={isScriptModalOpen} onClose={() => setIsScriptModalOpen(false)} onScriptAdded={fetchInitialData} scripts={availableScripts} scriptToEdit={scriptToEdit} generateScriptSimpleApi={generateScriptSimpleApi} />
            <ConfirmationModal isOpen={confirmationModal.isOpen} onClose={closeConfirmationModal} onConfirm={confirmationModal.onConfirm} title={confirmationModal.title} message={confirmationModal.message} />
            <ClarificationModal isOpen={clarification.isNeeded} questions={clarification.questions} answers={userAnswers} setAnswers={setUserAnswers} onSubmit={handleAnswerSubmission} onClose={() => setClarification({ isNeeded: false, questions: [] })} loading={isGenerating} />
        </div>
    );
}

export default App;