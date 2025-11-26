import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import History from './components/History';
import RunbookDeletion from './components/RunbookDeletion';
import RunbookIngestion from './components/RunbookIngestion';
import ScriptsPage from './components/ScriptsPage';
import AgentTrainer from './components/AgentTrainer';
import ManagementDashboard from './components/ManagementDashboard';
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

// Helper to convert legacy linear steps to Graph format (for Generator/Manual)
const convertLinearStepsToGraph = (steps) => {
    const nodes = {};
    const startId = 'start';
    
    nodes[startId] = { type: 'input', next: 'step-0' };

    steps.forEach((step, index) => {
        const id = `step-${index}`;
        const nextId = index < steps.length - 1 ? `step-${index + 1}` : 'end';
        
        nodes[id] = {
            type: 'step',
            name: step.description.substring(0, 20) + '...',
            description: step.description,
            script: step.script,
            script_id: step.script_id,
            next: nextId
        };
    });

    nodes['end'] = { type: 'output' };

    return { start_node_id: startId, nodes };
};

function App() {
    const [activePage, setActivePage] = useState('dashboard');
    const [ingestionTitle, setIngestionTitle] = useState('');
    const [ingestionIssue, setIngestionIssue] = useState('');
    const [ingestionTags, setIngestionTags] = useState('');
    const [ingestionSteps, setIngestionSteps] = useState([createNewStep()]);
    // ADDED: State for Graph Data
    const [ingestionGraphData, setIngestionGraphData] = useState(null);
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

    const handleGraphInsertStep = (sourceNodeId, sourceHandle = null) => {
        setIngestionGraphData(prevGraph => {
            const newGraph = JSON.parse(JSON.stringify(prevGraph)); // Deep clone
            const nodes = newGraph.nodes;
            const sourceNode = nodes[sourceNodeId];

            if (!sourceNode) return prevGraph;

            // Generate a unique ID for the new step
            const newStepId = `step-${Date.now()}`;
            
            // Determine the current target (where the source is currently pointing)
            let currentTargetId = null;
            if (sourceNode.type === 'decision' && sourceHandle) {
                currentTargetId = sourceNode.paths[sourceHandle];
            } else {
                currentTargetId = sourceNode.next;
            }

            // Create the new node
            nodes[newStepId] = {
                type: 'step',
                name: 'New Step',
                description: 'Describe this step...',
                script: null,
                script_id: null,
                next: currentTargetId // Connect new node to the old target
            };

            // Point source node to the new node
            if (sourceNode.type === 'decision' && sourceHandle) {
                sourceNode.paths[sourceHandle] = newStepId;
            } else {
                sourceNode.next = newStepId;
            }

            return newGraph;
        });
    };

    const handleGraphDeleteStep = (nodeId) => {
        setIngestionGraphData(prevGraph => {
            const newGraph = JSON.parse(JSON.stringify(prevGraph));
            const nodes = newGraph.nodes;
            const nodeToDelete = nodes[nodeId];

            if (!nodeToDelete) return prevGraph;

            // Determine where the deleted node points to (to bridge the gap)
            const targetId = nodeToDelete.next || 'end';

            // Find all parents (nodes pointing to the deleted node)
            Object.values(nodes).forEach(node => {
                // Check 'next' connection
                if (node.next === nodeId) {
                    node.next = targetId;
                }
                // Check 'decision' paths
                if (node.type === 'decision' && node.paths) {
                    Object.keys(node.paths).forEach(pathKey => {
                        if (node.paths[pathKey] === nodeId) {
                            node.paths[pathKey] = targetId;
                        }
                    });
                }
            });

            // Handle Start Node case
            if (newGraph.start_node_id === nodeId) {
                newGraph.start_node_id = targetId;
            }

            // Remove the node
            delete nodes[nodeId];

            return newGraph;
        });
    };

    const handleGraphAddStepToEnd = () => {
        setIngestionGraphData(prevGraph => {
            const newGraph = JSON.parse(JSON.stringify(prevGraph));
            const nodes = newGraph.nodes;
            
            // Find nodes pointing to 'end'
            const nodesPointingToEnd = Object.keys(nodes).filter(key => {
                 const node = nodes[key];
                 if (node.next === 'end') return true;
                 if (node.paths) return Object.values(node.paths).includes('end');
                 return false;
            });

            const newStepId = `step-${Date.now()}`;
            
            // Create new node pointing to end
            nodes[newStepId] = {
                type: 'step',
                name: 'New Final Step',
                description: 'New step at the end...',
                next: 'end'
            };

            // Update previous end-pointers to point to this new node
            nodesPointingToEnd.forEach(parentId => {
                const parent = nodes[parentId];
                if (parent.next === 'end') parent.next = newStepId;
                if (parent.paths) {
                    Object.keys(parent.paths).forEach(key => {
                        if (parent.paths[key] === 'end') parent.paths[key] = newStepId;
                    });
                }
            });
            
            // Handle edge case where start points directly to end
            if(newGraph.start_node_id === 'end') {
                 newGraph.start_node_id = newStepId;
            }

            return newGraph;
        });
    };

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

    // --- UPDATED: RESET FORM LOGIC ---
    const resetIngestionForm = () => {
        setIngestionTitle(''); 
        setIngestionIssue(''); 
        setIngestionTags('');
        setIngestionSteps([createNewStep()]); 
        setIngestionGraphData(null); // Fix: Clear graph data to reset view
        setIngestionRawText('');
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
                setIngestionTitle(response.title); 
                setIngestionIssue(response.issue);
                // Convert linear steps to graph for the builder
                const graph = convertLinearStepsToGraph(response.steps);
                setIngestionGraphData(graph);
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
                setIngestionTitle(response.title); 
                setIngestionIssue(response.issue);
                const graph = convertLinearStepsToGraph(response.steps);
                setIngestionGraphData(graph);
                setModal({ visible: true, message: 'Agent draft generated!' });
            }
        } catch (error) { setModal({ visible: true, message: error.message }); }
        finally { setIsGenerating(false); }
    };

    // --- UPDATED: PARSE LOGIC ---
    const handleParseDocument = async () => {
        if (!ingestionRawText.trim()) { setModal({ visible: true, message: 'Please paste text to parse.' }); return; }
        setIsParsing(true);
        try {
            const parsedData = await parseSOPApi(ingestionRawText);
            setIngestionTitle(parsedData.title); 
            setIngestionIssue(parsedData.issue);
            setIngestionGraphData(parsedData); // Use parsed graph directly
            setModal({ visible: true, message: 'Agent parsed successfully!' });
        } catch (error) { setModal({ visible: true, message: `Failed to parse Agent: ${error.message}` }); }
        finally { setIsParsing(false); }
    };

     const handleRematchStepScript = async (stepIndex) => {
        // Note: This legacy function might need updates for graph mode if accessed directly
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
    
    // --- FIX: Remove Modal Logic, perform deletion directly ---
    const handleDeleteIngestionStep = (indexToDelete) => {
        if (ingestionSteps.length <= 1) { 
            setModal({ visible: true, message: 'Cannot delete the only step.' }); 
            return; 
        }
        setIngestionSteps(s => s.filter((_, i) => i !== indexToDelete));
    };

    const handleInsertIngestionStep = (indexToInsertAfter) => {
        setIngestionSteps(s => { const newS = [...s]; newS.splice(indexToInsertAfter + 1, 0, createNewStep()); return newS; });
    };

    // --- UPDATED: UPLOAD LOGIC ---
    const uploadRunbook = async (graphPayload = null) => {
        if (!ingestionTitle.trim()) { setModal({ visible: true, message: 'Agent Title cannot be empty.' }); return; }
        if (!ingestionIssue.trim()) { setModal({ visible: true, message: 'Issue Description cannot be empty.' }); return; }

        let sopPayload = {
            title: ingestionTitle,
            issue: ingestionIssue,
            tags: ingestionTags.split(',').map(t=>t.trim()).filter(t => t),
        };

        // Case 1: Graph Payload (From Workflow Builder)
        if (graphPayload && graphPayload.nodes) {
             sopPayload = {
                 ...sopPayload,
                 nodes: graphPayload.nodes,
                 start_node_id: graphPayload.start_node_id || 'start'
             };
        } 
        // Case 2: Legacy Steps (Fallback)
        else {
            const validSteps = ingestionSteps.filter(step => step.description.trim() && step.description !== 'New Step').map(({ isMatching, isCreating, index, ...rest }) => rest);
            if (validSteps.length === 0) { setModal({ visible: true, message: 'Please provide valid step descriptions.' }); return; }
            sopPayload.steps = validSteps;
        }

        try {
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
            correct_agent_id: feedbackType === 'Correct' ? recommendedAgent?.id || null : selectedCorrectAgent?.id || null,
            correct_agent_title: feedbackType === 'Correct' ? recommendedAgent?.title || null : selectedCorrectAgent?.name || null,
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
            case 'dashboard': return <Dashboard setActivePage={setActivePage} />;
            case 'history': return <History onDraftRunbook={handleDraftAndGenerateFromHistory} />;
            case 'manage-runbooks': return <RunbookDeletion />;
            case 'onboard-runbook':
                 return <RunbookIngestion
                            title={ingestionTitle} setTitle={setIngestionTitle}
                            issue={ingestionIssue} setIssue={setIngestionIssue}
                            tags={ingestionTags} setTags={setIngestionTags}
                            graphData={ingestionGraphData}
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
                            onInsertGraphStep={handleGraphInsertStep}
                            onDeleteGraphStep={handleGraphDeleteStep}
                            onAddGraphStep={handleGraphAddStepToEnd}
                        />;
            case 'scripts': return <ScriptsPage setConfirmationModal={setConfirmationModal}/>;
            case 'management': return <ManagementDashboard />;
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
            default: return <Dashboard setActivePage={setActivePage} />;
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