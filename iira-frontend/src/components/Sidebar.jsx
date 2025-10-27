// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { ChevronLeft, LayoutDashboard, Clock, BookOpen, PlusCircle, Wrench, FlaskConical, BarChart2 } from 'lucide-react';
import iiraIcon from '../assets/iira-icon.png';

const Sidebar = ({ activePage, setActivePage }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
        { id: 'manage-runbooks', label: 'Agents Library', icon: BookOpen, section: 'KNOWLEDGE BASE' },
        { id: 'onboard-runbook', label: 'Onboard Agent', icon: PlusCircle, section: 'KNOWLEDGE BASE' },
        { id: 'scripts', label: 'Worker Tasks', icon: Wrench, section: 'KNOWLEDGE BASE' },
        { id: 'history', label: 'History', icon: Clock, section: 'AUTOMATION' },
        { id: 'management', label: 'Management Dashboard', icon: BarChart2, section: 'SYSTEM MANAGEMENT' },
        { id: 'testbed', label: 'Agent Trainer', icon: FlaskConical, section: 'DEVELOPMENT' },
    ];

    const groupedMenuItems = menuItems.reduce((acc, item) => {
        if (!acc[item.section]) { acc[item.section] = []; }
        acc[item.section].push(item);
        return acc;
    }, {});

    return (
        <div className={`flex flex-col bg-white border-r border-gray-200 transition-width duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 h-20">
                 <div className="flex items-center">
                    <img src={iiraIcon} alt="IIRA Logo" className="h-10 w-10 rounded-full flex-shrink-0" />
                    {!isCollapsed && (
                        <span className="text-2xl font-bold text-blue-700 ml-3 whitespace-nowrap">IIRA</span>
                    )}
                </div>
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronLeft size={20} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>
            <nav className="flex-grow p-4 space-y-4 overflow-y-auto">
                {Object.entries(groupedMenuItems).map(([section, items]) => (
                    <div key={section}>
                        {!isCollapsed && <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{section}</h3>}
                        <ul className="mt-2 space-y-1">
                            {items.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => setActivePage(item.id)}
                                        className={`w-full flex items-center p-3 text-base font-medium rounded-lg transition-colors duration-200 ${ activePage === item.id ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100' }`}
                                        title={item.label}
                                    >
                                        <item.icon size={20} className="flex-shrink-0" />
                                        {/* FIX IS ON THE NEXT LINE */}
                                        {!isCollapsed && <span className="ml-4 whitespace-nowrap">{item.label}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-200 mt-auto">
            </div>
        </div>
    );
};

export default Sidebar;