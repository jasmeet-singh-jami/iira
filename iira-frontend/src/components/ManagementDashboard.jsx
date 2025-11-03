// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { BarChart2, Zap, BrainCircuit, RefreshCw, Loader2, Sparkles, Database, Trash2 } from 'lucide-react';
import {
    fetchFeedbackReportApi,
    populateCacheApi,
    triggerModelFinetuningApi,
    fetchTaskStatusApi,
    triggerReEmbeddingApi,
    fetchModelsApi,
    deleteModelApi
} from '../services/apis';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';

const StatCard = ({ title, value, unit = '', color }) => (
    <div className={`p-4 rounded-lg shadow-md border-l-4 ${color}`}>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}{unit}</p>
    </div>
);

const ManagementDashboard = () => {
    const [report, setReport] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [modal, setModal] = useState({ visible: false, message: '' });

    const [models, setModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // --- State for background tasks ---
    const [cacheTask, setCacheTask] = useState({ id: null, status: 'idle', progress: 0, total: 0, message: '' });
    const [finetuneTask, setFinetuneTask] = useState({ id: null, status: 'idle', message: '' });
    const [reEmbedTask, setReEmbedTask] = useState({ id: null, status: 'idle', progress: 0, total: 0, message: '' });
    
    const pollingInterval = useRef(null);

    useEffect(() => {
        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, []);

    const startPolling = (taskId, setTaskState) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);

        pollingInterval.current = setInterval(async () => {
            try {
                const statusData = await fetchTaskStatusApi(taskId);
                setTaskState(prev => ({ ...prev, ...statusData }));

                if (statusData.status === 'complete' || statusData.status === 'error') {
                    clearInterval(pollingInterval.current);
                    setModal({ visible: true, message: `Task ${statusData.status}: ${statusData.message}` });
                }
            } catch (error) {
                console.error("Polling error:", error);
                setTaskState({ status: 'error', message: 'Failed to get task status.' });
                clearInterval(pollingInterval.current);
            }
        }, 2500);
    };

    const handlePopulateCache = async () => {
        if (cacheTask.status === 'running' || cacheTask.status === 'starting') return;
        setCacheTask({ status: 'starting', message: 'Initiating task...' });
        try {
            const response = await populateCacheApi();
            startPolling(response.task_id, setCacheTask);
        } catch (error) {
            setModal({ visible: true, message: `Failed to trigger cache population: ${error.message}` });
            setCacheTask({ status: 'error', message: error.message });
        }
    };
    
    const handleTriggerFinetuning = async () => {
        if (finetuneTask.status === 'running' || finetuneTask.status === 'starting') return;
        setFinetuneTask({ status: 'starting', message: 'Initiating training...' });
        try {
            const response = await triggerModelFinetuningApi();
            startPolling(response.task_id, setFinetuneTask);
        } catch (error) {
            setModal({ visible: true, message: `Failed to trigger fine-tuning: ${error.message}` });
            setFinetuneTask({ status: 'error', message: error.message });
        }
    };
    
    const handleTriggerReEmbedding = async () => {
        if (reEmbedTask.status === 'running' || reEmbedTask.status === 'starting') return;

        setReEmbedTask({ status: 'starting', message: 'Initiating re-embedding...' });
        try {
            const response = await triggerReEmbeddingApi();
            startPolling(response.task_id, setReEmbedTask);
        } catch (error) {
            setModal({ visible: true, message: `Failed to trigger re-embedding: ${error.message}` });
            setReEmbedTask({ status: 'error', message: error.message });
        }
    };

    const handleFetchReport = async () => {
        setLoadingReport(true);
        setReport(null);
        try {
            const data = await fetchFeedbackReportApi();
            setReport(data);
        } catch (error) {
            setModal({ visible: true, message: `Failed to fetch report: ${error.message}` });
        } finally {
            setLoadingReport(false);
        }
    };

    const handleFetchModels = async () => {
        setLoadingModels(true);
        try {
            const modelList = await fetchModelsApi();
            setModels(modelList);
        } catch (error) {
            setModal({ visible: true, message: error.message });
        } finally {
            setLoadingModels(false);
        }
    };

    const handleDeleteModel = (modelName) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Model',
            message: `Are you sure you want to permanently delete the model "${modelName}"? This action cannot be undone.`,
            onConfirm: async () => {
                try {
                    await deleteModelApi(modelName);
                    setModal({ visible: true, message: "Model deleted successfully." });
                    handleFetchModels(); // Refresh the list
                } catch (error) {
                    setModal({ visible: true, message: error.message });
                } finally {
                    setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                }
            }
        });
    };

    const isCacheTaskRunning = cacheTask.status === 'running' || cacheTask.status === 'starting';
    const cacheProgressPercent = cacheTask.total > 0 ? (cacheTask.progress / cacheTask.total) * 100 : 0;
    
    const isFinetuneTaskRunning = finetuneTask.status === 'running' || finetuneTask.status === 'starting';
    const isReEmbedTaskRunning = reEmbedTask.status === 'running' || reEmbedTask.status === 'starting';
    const reEmbedProgressPercent = reEmbedTask.total > 0 ? (reEmbedTask.progress / reEmbedTask.total) * 100 : 0;

    return (
        <div className="p-8 space-y-6">
            <div className="pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-extrabold text-gray-800">Management Dashboard</h1>
                <p className="mt-1 text-gray-500">Analyze system performance and trigger learning tasks to improve AI capabilities.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Feedback Analysis Card */}
                <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><BarChart2 className="mr-2 text-blue-500"/>Feedback Analysis</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Generate a real-time report on Agent recommendation accuracy based on user feedback.</p>
                    <button onClick={handleFetchReport} disabled={loadingReport} className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition disabled:bg-blue-300">
                         {loadingReport ? <Loader2 className="animate-spin mr-2"/> : <RefreshCw className="mr-2"/>}
                         {loadingReport ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>
                 
                 {/* Cache Population Card */}
                 <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><Zap className="mr-2 text-green-500"/>Pre-populate Cache</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Run a task to find high-confidence mappings and add them to the Redis cache for faster lookups.</p>
                    <button onClick={handlePopulateCache} disabled={isCacheTaskRunning} className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition disabled:bg-green-300">
                        {isCacheTaskRunning ? <Loader2 className="animate-spin mr-2"/> : <Zap className="mr-2"/>}
                        {isCacheTaskRunning ? 'Running...' : 'Trigger Cache Population'}
                    </button>
                    {isCacheTaskRunning && (
                        <div className="mt-4">
                            <p className="text-xs text-gray-600 text-center mb-1">Processing {cacheTask.progress} / {cacheTask.total}</p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${cacheProgressPercent}%` }}></div></div>
                        </div>
                    )}
                </div>

                {/* Model Fine-tuning Card */}
                <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><BrainCircuit className="mr-2 text-purple-500"/>Fine-Tune & Apply Model</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Train a new model on feedback, then re-embed all Agents with the improved model.</p>
                    <div className="space-y-4">
                        <button onClick={handleTriggerFinetuning} disabled={isFinetuneTaskRunning || finetuneTask.status === 'complete'} className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition disabled:bg-purple-300">
                            {isFinetuneTaskRunning ? <Loader2 className="animate-spin mr-2"/> : <BrainCircuit className="mr-2"/>}
                            {isFinetuneTaskRunning ? 'Training...' : (finetuneTask.status === 'complete' ? 'Training Complete' : '1. Start Fine-Tuning')}
                        </button>

                        {isFinetuneTaskRunning && <p className="text-xs text-center text-gray-500">{finetuneTask.message}</p>}
                        
                        <button onClick={handleTriggerReEmbedding} disabled={isReEmbedTaskRunning} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:bg-indigo-300">
                           {isReEmbedTaskRunning ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>}
                           {isReEmbedTaskRunning ? 'Applying...' : '2. Apply & Re-embed'}
                        </button>

                        {isReEmbedTaskRunning && (
                            <div className="mt-2">
                                <p className="text-xs text-gray-600 text-center mb-1">Re-embedding {reEmbedTask.progress} / {reEmbedTask.total}</p>
                                <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${reEmbedProgressPercent}%` }}></div></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><Database className="mr-2 text-teal-500"/>Model Management</h3>
                    <button onClick={handleFetchModels} disabled={loadingModels} className="flex items-center justify-center px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition disabled:bg-teal-300">
                         {loadingModels ? <Loader2 className="animate-spin mr-2"/> : <RefreshCw className="mr-2"/>}
                         {loadingModels ? 'Loading...' : 'List Models'}
                    </button>
                </div>
                {models.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
                        {models.map(model => (
                            <div key={model.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                                <div>
                                    <p className="font-mono text-sm text-gray-700">{model.name}</p>
                                    {model.isActive && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Active</span>}
                                </div>
                                <button
                                    onClick={() => handleDeleteModel(model.name)}
                                    disabled={model.isActive}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    title={model.isActive ? "Cannot delete the active model" : "Delete this model"}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {report && (
                 <div className="p-6 bg-white rounded-2xl shadow-lg border border-gray-200 mt-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Feedback Report</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatCard title="Total Feedback" value={report.summary.total_feedback} color="border-blue-500" />
                        <StatCard title="Correct" value={report.summary.correct_recommendations} color="border-green-500" />
                        <StatCard title="Incorrect" value={report.summary.incorrect_recommendations} color="border-red-500" />
                        <StatCard title="Overall Accuracy" value={report.summary.overall_accuracy} unit="%" color="border-yellow-500" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="p-4 rounded-lg bg-gray-50 border">
                            <h4 className="font-bold text-gray-700 mb-2">🏆 Best Performing Agents</h4>
                            <ul className="space-y-2 text-sm">
                                {report.best_performing_agents.map((agent, i) => <li key={i} className="flex justify-between"><span>{agent.agent_title}</span> <span className="font-semibold text-green-600">{agent.correct_selections} correct</span></li>)}
                            </ul>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-50 border">
                             <h4 className="font-bold text-gray-700 mb-2">⚠️ Worst Performing Agents</h4>
                             <ul className="space-y-2 text-sm">
                                {report.worst_performing_agents.map((agent, i) => <li key={i} className="flex justify-between"><span>{agent.agent_title}</span> <span className="font-semibold text-red-600">{agent.incorrect_recommendations} incorrect</span></li>)}
                            </ul>
                        </div>
                         <div className="p-4 rounded-lg bg-gray-50 border">
                             <h4 className="font-bold text-gray-700 mb-2">🔍 Common Misclassifications</h4>
                             <ul className="space-y-2 text-sm">
                                {report.common_misclassifications.map((m, i) => <li key={i}>Recommended <span className="font-semibold text-red-600">{m.recommended}</span> but was <span className="font-semibold text-green-600">{m.correct}</span> ({m.frequency} times)</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
            <ConfirmationModal 
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
            />
        </div>
    );
};

export default ManagementDashboard;