// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { BarChart2, Zap, BrainCircuit, RefreshCw, Loader2 } from 'lucide-react';
import {
    fetchFeedbackReportApi,
    populateCacheApi,
    triggerModelFinetuningApi,
    fetchTaskStatusApi
} from '../services/apis';
import Modal from './Modal';

const StatCard = ({ title, value, unit = '', color }) => (
    <div className={`p-4 rounded-lg shadow-md border-l-4 ${color}`}>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}{unit}</p>
    </div>
);

const ManagementDashboard = () => {
    const [report, setReport] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    // --- State for background tasks ---
    const [cacheTask, setCacheTask] = useState({ id: null, status: 'idle', progress: 0, total: 0, message: '' });
    const [finetuneLoading, setFinetuneLoading] = useState(false);
    const [modal, setModal] = useState({ visible: false, message: '' });

    // Ref to hold the interval ID
    const pollingInterval = useRef(null);

    // --- Cleanup interval on component unmount ---
    useEffect(() => {
        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
        };
    }, []);

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

    const handlePopulateCache = async () => {
        if (cacheTask.status === 'running' || cacheTask.status === 'starting') return;

        setCacheTask({ id: null, status: 'starting', progress: 0, total: 0, message: 'Initiating task...' });

        try {
            const response = await populateCacheApi();
            setCacheTask(prev => ({ ...prev, id: response.task_id, status: 'running' }));
            
            // Start polling
            pollingInterval.current = setInterval(async () => {
                try {
                    const statusData = await fetchTaskStatusApi(response.task_id);
                    setCacheTask(prev => ({ ...prev, ...statusData }));

                    // --- MODIFICATION: Show modal only on completion or error ---
                    if (statusData.status === 'complete' || statusData.status === 'error') {
                        clearInterval(pollingInterval.current);
                        setModal({ visible: true, message: `Cache population ${statusData.status}: ${statusData.message}` });
                    }
                } catch (error) {
                    console.error("Polling error:", error);
                    setCacheTask({ status: 'error', message: 'Failed to get task status.' });
                    clearInterval(pollingInterval.current);
                }
            }, 2000);

        } catch (error) {
            setModal({ visible: true, message: `Failed to trigger cache population: ${error.message}` });
            setCacheTask({ status: 'error', message: error.message });
        }
    };
    
    const handleTriggerFinetuning = async () => {
        setFinetuneLoading(true);
        try {
            const response = await triggerModelFinetuningApi();
            setModal({ visible: true, message: response.message });
        } catch (error) {
            setModal({ visible: true, message: `Failed to trigger fine-tuning: ${error.message}` });
        } finally {
            setFinetuneLoading(false);
        }
    };

    const isCacheTaskRunning = cacheTask.status === 'running' || cacheTask.status === 'starting';
    const cacheProgressPercent = cacheTask.total > 0 ? (cacheTask.progress / cacheTask.total) * 100 : 0;

    return (
        <div className="p-8 space-y-6">
            <div className="pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-extrabold text-gray-800">Management Dashboard</h1>
                <p className="mt-1 text-gray-500">Analyze system performance and trigger learning tasks to improve AI capabilities.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><BarChart2 className="mr-2 text-blue-500"/>Feedback Analysis</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Generate a real-time report on Agent recommendation accuracy based on user feedback.</p>
                    <button onClick={handleFetchReport} disabled={loadingReport} className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition disabled:bg-blue-300">
                         {loadingReport ? <Loader2 className="animate-spin mr-2"/> : <RefreshCw className="mr-2"/>}
                         {loadingReport ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>
                 
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
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${cacheProgressPercent}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center"><BrainCircuit className="mr-2 text-purple-500"/>Fine-Tune Model</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Trigger an ML pipeline to retrain the embedding model on all collected feedback. (Simulated)</p>
                     <button onClick={handleTriggerFinetuning} disabled={finetuneLoading} className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition disabled:bg-purple-300">
                        {finetuneLoading ? <Loader2 className="animate-spin mr-2"/> : <BrainCircuit className="mr-2"/>}
                        {finetuneLoading ? 'Triggering...' : 'Trigger Fine-Tuning'}
                    </button>
                </div>
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
        </div>
    );
};

export default ManagementDashboard;