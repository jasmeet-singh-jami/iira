// iira-frontend/src/App.js
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

// --- THIS IS THE FIRST MAJOR CHANGE ---
// We no longer need the old createNewStep() function.
// const createNewStep = () => ({ ... }); // <-- DELETE THIS FUNCTION

// Define the new initial state for react-flow-builder
const initialWorkflowNodes = [
  {
    id: 'start_node', // Must be unique
    type: 'start',    // Must match a registered node type
    name: 'Start',    // This is the display label
    data: {           // We'll store our app-specific data here
        description: 'Workflow starts here'
    }
  }
];
// --- END OF FIRST MAJOR CHANGE ---

function App() {
    const [activePage, setActivePage] = useState('dashboard');
    const [ingestionTitle, setIngestionTitle] = useState('');
    const [ingestionIssue, setIngestionIssue] = useState('');
    const [ingestionTags, setIngestionTags] = useState('');
    
    // --- THIS IS THE SECOND MAJOR CHANGE ---
    // Update the initial state to use our new variable
    const [ingestionSteps, setIngestionSteps] = useState(initialWorkflowNodes);
    // --- END OF SECOND MAJOR CHANGE ---

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
        // Reset the workflow to its initial state
        setIngestionSteps(initialWorkflowNodes); 
        setIngestionRawText('');
    };
    const handleDraftAndGenerateFromHistory = async (incident) => {
         const description = `Incident ${incident.incident_number}: ${incident.incident_data.short_description}\n\nFull Description:\n${incident.incident_data.description || ''}`;
         setIngestionRawText(description);
         setActivePage('onboard-runbook');
     };
    
     // --- AI GENERATION & PARSING (NEEDS UPDATE) ---
     // These handlers need to be updated to output the new node structure.
     // For now, I will map the old structure to the new one.

     const convertOldStepsToNew = (steps) => {
        const newNodes = [
            { id: 'start_node', type: 'start', name: 'Start', data: { description: 'Workflow Start' } }
        ];
        let prevNodeId = 'start_node';

        steps.forEach((step, index) => {
            const newNodeId = `task_${index}`;
            newNodes.push({
                id: newNodeId,
                type: 'node', // 'node' is our registered type for Tasks
                name: step.description.substring(0, 30) || 'Task', // Use a short name
                data: {
                    description: step.description,
                    script_id: step.script_id,
                    script: step.script
                }
            });

            // This part for edges is illustrative; react-flow-builder manages edges
            // but you'd need to create them if building manually.
            // The builder will handle adding nodes sequentially.
            // For simplicity, we'll just add the nodes.
            // The user will have to connect them.

            prevNodeId = newNodeId;
        });

        newNodes.push({
            id: 'end_node',
            type: 'end',
            name: 'End',
            data: { description: 'Workflow End' }
        });
        return newNodes;
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
                // Convert the AI's old step format to the new node format
                setIngestionSteps(convertOldStepsToNew(response.steps));
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
                // Convert the AI's old step format to the new node format
                setIngestionSteps(convertOldStepsToNew(response.steps));
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
            // Convert the parsed old step format to the new node format
            setIngestionSteps(convertOldStepsToNew(parsedData.steps));
            setModal({ visible: true, message: 'Agent parsed successfully!' });
        } catch (error) { setModal({ visible: true, message: `Failed to parse Agent: ${error.message}` }); }
        finally { setIsParsing(false); }
    };
    
    // --- THESE HANDLERS ARE NOW OBSOLETE ---
    // react-flow-builder handles adding/deleting nodes via the `onChange` handler (setIngestionSteps)
    // We can delete these functions.
    
    // const handleRematchStepScript = async (stepIndex) => { ... };
    // const handleCreateScriptForStep = async (stepIndex) => { ... };
    const onIngestionStepsChange = (newSteps) => { setIngestionSteps(newSteps); };
    // const handleAddIngestionStep = () => { ... };
    // const handleDeleteIngestionStep = (indexToDelete) => { ... };
    // const handleInsertIngestionStep = (indexToInsertAfter) => { ... };

    // --- END OBSOLETE HANDLERS ---

    const uploadRunbook = async () => {
        if (!ingestionTitle.trim()) { setModal({ visible: true, message: 'Agent Title cannot be empty.' }); return; }
        if (!ingestionIssue.trim()) { setModal({ visible: true, message: 'Issue Description cannot be empty.' }); return; }
        
        // --- THIS LOGIC MUST BE UPDATED ---
        // Convert the react-flow-builder nodes back into the simple step list the API expects.
        const validSteps = ingestionSteps
            .filter(node => node.type === 'node') // Only 'task' nodes are steps
            .map(node => ({
                description: node.data?.description || node.name,
                script_id: node.data?.script_id || null,
                script: node.data?.script || null
            }));
        // --- END UPDATED LOGIC ---

        if (validSteps.length === 0) { setModal({ visible: true, message: 'Please add at least one Task node.' }); return; }
        try {
            const sopPayload = { title: ingestionTitle, issue: ingestionIssue, tags: ingestionTags.split(',').map(t=>t.trim()).filter(t => t), steps: validSteps };
            await uploadSOPApi(sopPayload);
            setModal({ visible: true, message: 'Agent ingested successfully!' });
            resetIngestionForm();
             fetchInitialData();
        } catch (error) { setModal({ visible: true, message: `Failed to ingest Agent: ${error.message}` }); }
    };

    const handleFetchRecommendations = async () => {
        // ... (this function is fine, no changes needed)
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
        // ... (this function is fine, no changes needed)
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
        // ... (this function is fine, no changes needed)
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
                            steps={ingestionSteps} // This is now the 'nodes' array
                            onStepsChange={onIngestionStepsChange} // This is our 'setNodes'
                            availableScripts={availableScripts}
                            onAddNewScript={handleOpenAddScriptModal}
                            uploadRunbook={uploadRunbook}
                            rawText={ingestionRawText} setRawText={setIngestionRawText}
                            handleParseDocument={handleParseDocument}
                            handleGenerateRunbook={handleGenerateRunbook}
                            
                            // --- THESE PROPS ARE NO LONGER USED by WorkflowBuilder ---
                            // handleRematchStepScript={handleRematchStepScript}
                            // onCreateScriptForStep={onCreateScriptForStep}
                            // onAddStep={handleAddIngestionStep}
                            // onDeleteStep={handleDeleteIngestionStep}
                            // onInsertStep={handleInsertIngestionStep}
                            // --- END OBSOLETE PROPS ---

                            isGenerating={isGenerating}
                            isParsing={isParsing}
                            resetRunbookSteps={resetIngestionForm}
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
_                           thresholds={searchThresholds}
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