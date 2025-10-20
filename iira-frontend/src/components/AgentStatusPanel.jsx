// src/components/AgentStatusPanel.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Search } from 'lucide-react';
import { fetchAgentStatusApi } from '../services/apis';

const AgentStatusPanel = () => {
    const [status, setStatus] = useState({
        status: 'loading',
        current_incident: null,
        last_checked: null,
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await fetchAgentStatusApi();
                setStatus(data);
                setError(null);
            } catch (err) {
                setError('Could not connect to the agent.');
                setStatus({ status: 'error', current_incident: null, last_checked: null });
            }
        };

        fetchStatus(); // Fetch immediately on mount
        const intervalId = setInterval(fetchStatus, 5000); // Poll every 5 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

    const getStatusInfo = () => {
        switch (status.status) {
            case 'monitoring':
                return {
                    text: 'Active - Monitoring for new incidents',
                    icon: <Search className="animate-pulse" />,
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-100',
                };
            case 'resolving':
                return {
                    text: `Active - Resolving incident: ${status.current_incident}`,
                    icon: <Zap className="animate-ping" />,
                    color: 'text-purple-500',
                    bgColor: 'bg-purple-100',
                };
            case 'idle':
                return {
                    text: 'Idle - Waiting for next check',
                    icon: <Cpu />,
                    color: 'text-green-500',
                    bgColor: 'bg-green-100',
                };
            case 'error':
                 return {
                    text: 'Error - Agent encountered an error',
                    icon: <Cpu />,
                    color: 'text-red-500',
                    bgColor: 'bg-red-100',
                };
            default:
                return {
                    text: 'Loading status...',
                    icon: <Cpu />,
                    color: 'text-gray-500',
                    bgColor: 'bg-gray-100',
                };
        }
    };

    const { text, icon, color, bgColor } = getStatusInfo();
    const lastCheckedDate = status.last_checked ? new Date(status.last_checked).toLocaleString() : 'N/A';

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className={`flex items-center justify-between p-4 rounded-2xl shadow-md border ${bgColor.replace('bg-', 'border-')} ${bgColor}`}
        >
            <div className="flex items-center">
                <div className={`p-3 rounded-full ${color}`}>
                    {icon}
                </div>
                <div className="ml-4">
                    <p className={`font-bold text-lg ${color}`}>Resolver Agent Status</p>
                    <p className="text-sm text-gray-600">{text}</p>
                </div>
            </div>
            <div className="text-right text-xs text-gray-500">
                <p>Last Checked</p>
                <p className="font-semibold">{lastCheckedDate}</p>
            </div>
        </motion.div>
    );
};

export default AgentStatusPanel;