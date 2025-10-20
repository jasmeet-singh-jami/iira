import React, { useState, useEffect } from 'react';
import { BookOpen, FileCode, AlertTriangle, RefreshCw, PlusCircle, Trash2, Edit } from 'lucide-react';
import { fetchSystemStatsApi, fetchActivityLogApi } from '../services/apis';
import Modal from './Modal';
import AgentStatusPanel from './AgentStatusPanel'; 

const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex items-center p-6 bg-white rounded-2xl shadow-md border border-gray-200 ${colorClass}`}>
        <div className="p-4 bg-opacity-20 rounded-full">
            {icon}
        </div>
        <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const ActivityItem = ({ activity }) => {
    const ICONS = {
        CREATE_SCRIPT: <PlusCircle className="text-green-500" size={20} />,
        UPDATE_SCRIPT: <Edit className="text-yellow-500" size={20} />,
        DELETE_SCRIPT: <Trash2 className="text-red-500" size={20} />,
        CREATE_SOP: <PlusCircle className="text-green-500" size={20} />,
        DELETE_SOP: <Trash2 className="text-red-500" size={20} />,
    };

    const TITLES = {
        CREATE_SCRIPT: `New script created: "${activity.details.script_name}"`,
        UPDATE_SCRIPT: `Script updated: "${activity.details.script_name}"`,
        DELETE_SCRIPT: `Script deleted: "${activity.details.script_name}"`,
        CREATE_SOP: `New SOP ingested: "${activity.details.sop_title}"`,
        DELETE_SOP: `SOP deleted: "${activity.details.sop_title}"`,
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <li className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">{ICONS[activity.activity_type] || <AlertTriangle size={20} />}</div>
            <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">{TITLES[activity.activity_type] || 'Unknown Activity'}</p>
            </div>
            <div className="text-xs text-gray-400">{formatDate(activity.timestamp)}</div>
        </li>
    );
};


const Dashboard = () => {
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

    return (
        <div className="p-8 space-y-8">
            <div className="pb-4 border-b border-gray-200">
                <h1 className="text-4xl font-extrabold text-gray-800">Dashboard</h1>
                <p className="mt-1 text-gray-500">A high-level overview of the IIRA system's status and activity.</p>
            </div>

            <AgentStatusPanel />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    icon={<FileCode size={28} className="text-blue-500" />}
                    title="Total Scripts"
                    value={stats.total_scripts}
                    colorClass="bg-blue-50"
                />
                <StatCard
                    icon={<BookOpen size={28} className="text-green-500" />}
                    title="Active SOPs"
                    value={stats.total_sops}
                    colorClass="bg-green-50"
                />
                <StatCard
                    icon={<AlertTriangle size={28} className="text-purple-500" />}
                    title="Total Incidents"
                    value={stats.total_incidents}
                    colorClass="bg-purple-50"
                />
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-700">Recent Activity</h3>
                    <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100" disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                {loading && activityLog.length === 0 ? (
                    <p className="text-gray-500">Loading activities...</p>
                ) : activityLog.length > 0 ? (
                    <ul className="space-y-1">
                        {activityLog.map((activity) => (
                            <ActivityItem key={activity.id} activity={activity} />
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 p-4">No recent system activities found.</p>
                )}
            </div>
            <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
        </div>
    );
};

export default Dashboard;