import React, { useState, useEffect } from 'react';
import { BookOpen, FileCode, AlertTriangle, RefreshCw, PlusCircle, Trash2, Edit } from 'lucide-react';
import { fetchSystemStatsApi, fetchActivityLogApi } from '../services/apis';
import Modal from './Modal';
import AgentStatusPanel from './AgentStatusPanel';

// Updated StatCard to be clickable
const StatCard = ({ icon, title, value, colorClass, onClick }) => (
    <div
        onClick={onClick}
        // Add styles for clickable cards: cursor, hover effects
        className={`flex items-center p-6 bg-white rounded-2xl shadow-md border border-gray-200 ${colorClass} transition-all duration-200 ease-in-out ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' : ''}`}
        role={onClick ? "button" : undefined} // Add role=button for accessibility
        tabIndex={onClick ? 0 : undefined} // Make it focusable if clickable
        // Allow activation with Enter or Space key for accessibility
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
        <div className={`p-4 rounded-full ${colorClass.replace('bg-', 'bg-opacity-20 ')}`}> {/* Slightly adjusted opacity approach */}
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);


const ActivityItem = ({ activity }) => {
    // Icons based on activity type (reflecting Worker Task terminology)
    const ICONS = {
        CREATE_SCRIPT: <PlusCircle className="text-green-500" size={20} />,
        UPDATE_SCRIPT: <Edit className="text-yellow-500" size={20} />,
        DELETE_SCRIPT: <Trash2 className="text-red-500" size={20} />,
        CREATE_SOP: <PlusCircle className="text-green-500" size={20} />, // Agent created
        DELETE_SOP: <Trash2 className="text-red-500" size={20} />,      // Agent deleted
    };

    // Titles based on activity type (reflecting new terminology)
    const TITLES = {
        CREATE_SCRIPT: `New Worker Task created: "${activity.details.script_name}"`, // Updated
        UPDATE_SCRIPT: `Worker Task updated: "${activity.details.script_name}"`,     // Updated
        DELETE_SCRIPT: `Worker Task deleted: "${activity.details.script_name}"`,   // Updated
        CREATE_SOP: `New Agent ingested: "${activity.details.sop_title}"`,
        DELETE_SOP: `Agent deleted: "${activity.details.sop_title}"`,
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <li className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">{ICONS[activity.activity_type] || <AlertTriangle size={20} />}</div>
            <div className="flex-1 min-w-0"> {/* Ensure text wraps */}
                <p className="text-sm font-semibold text-gray-700 truncate" title={TITLES[activity.activity_type] || 'Unknown Activity'}>
                    {TITLES[activity.activity_type] || 'Unknown Activity'}
                </p>
            </div>
            <div className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatDate(activity.timestamp)}</div>
        </li>
    );
};


// Receive setActivePage prop
const Dashboard = ({ setActivePage }) => {
    const [stats, setStats] = useState({ total_sops: 0, total_scripts: 0, total_incidents: 0 });
    const [activityLog, setActivityLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ visible: false, message: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const statsData = await fetchSystemStatsApi();
            const activityData = await fetchActivityLogApi(1, 10); // Fetch first 10 activities
            setStats(statsData);
            if (activityData && activityData.activities) {
                setActivityLog(activityData.activities);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error.message);
            setModal({ visible: true, message: 'Failed to load dashboard data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Navigation handlers - Use setActivePage prop
    const goToWorkerTasks = () => setActivePage('scripts');
    const goToAgentsLibrary = () => setActivePage('manage-runbooks');
    const goToHistory = () => setActivePage('history');

    return (
        <div className="p-8 space-y-8">
            <div className="pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-extrabold text-gray-800">Dashboard</h1>
                <p className="mt-1 text-gray-500">A high-level overview of the IIRA system's status and activity.</p>
            </div>

            <AgentStatusPanel />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Add onClick handlers */}
                <StatCard
                    icon={<FileCode size={28} className="text-blue-500" />}
                    title="Total Worker Tasks" // Updated title
                    value={stats.total_scripts}
                    colorClass="bg-blue-50 border-blue-200" // Added border color
                    onClick={goToWorkerTasks} // Navigate on click
                />
                <StatCard
                    icon={<BookOpen size={28} className="text-green-500" />}
                    title="Active Agents" // Updated title
                    value={stats.total_sops}
                    colorClass="bg-green-50 border-green-200" // Added border color
                    onClick={goToAgentsLibrary} // Navigate on click
                />
                <StatCard
                    icon={<AlertTriangle size={28} className="text-purple-500" />}
                    title="Total Incidents"
                    value={stats.total_incidents}
                    colorClass="bg-purple-50 border-purple-200" // Added border color
                    onClick={goToHistory} // Navigate on click
                />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-700">Recent Activity</h3>
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        disabled={loading}
                        title="Refresh Activity Log"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                {loading && activityLog.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Loading activities...</p>
                ) : activityLog.length > 0 ? (
                    <ul className="space-y-1 max-h-96 overflow-y-auto pr-2 custom-scrollbar"> {/* Added max-height and scroll */}
                        {activityLog.map((activity) => (
                            <ActivityItem key={activity.id} activity={activity} />
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-center py-4">No recent system activities found.</p>
                )}
            </div>
            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
        </div>
    );
};

// Add CSS for scrollbar if not already global
const scrollbarStyle = `
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a1a1a1; }
`;
const styleSheet = document.createElement("style");
if (!document.getElementById('custom-scrollbar-style-dash')) { // Use unique ID
    styleSheet.id = 'custom-scrollbar-style-dash';
    styleSheet.innerText = scrollbarStyle;
    document.head.appendChild(styleSheet);
}


export default Dashboard;

