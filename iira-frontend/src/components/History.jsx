import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, RefreshCw, BookOpen, FileCode, AlertTriangle, PlusCircle, Trash2, Edit } from 'lucide-react';
import { fetchHistoryApi, fetchSystemStatsApi, fetchActivityLogApi } from '../services/apis';
import Modal from './Modal';

const History = ({ onDraftSop }) => {
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncidents, setExpandedIncidents] = useState({});
  const [modal, setModal] = useState({ visible: false, message: '' });

  // --- MODIFIED: State for progressive loading of activities ---
  const [activityLog, setActivityLog] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);

  const [stats, setStats] = useState({
    total_sops: 0,
    total_scripts: 0,
    total_incidents: 0,
  });

  // Pagination states for incident history
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10; // items per page

  // --- MODIFIED: Function to fetch and append activities ---
  const fetchActivities = async (currentPage) => {
    // Only set loading to true for the initial fetch
    if (currentPage === 1) {
        setLoadingActivities(true);
    }
    try {
      const data = await fetchActivityLogApi(currentPage);
      // --- FIX: Add a check to ensure data and data.activities are valid ---
      if (data && data.activities) {
        // Append new activities to the existing log on "Load More", otherwise replace
        setActivityLog(prev => currentPage === 1 ? data.activities : [...prev, ...data.activities]);
        // Check if there are more pages to load
        setHasMoreActivities(data.current_page < data.total_pages);
      } else {
        // If the response is invalid, stop trying to load more.
        setHasMoreActivities(false);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error.message);
      setModal({ visible: true, message: 'Failed to load system activities.' });
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await fetchSystemStatsApi();
      setStats(data);
    } catch (error) {
      console.error(error.message);
      // Do not show a modal for stats failing, just log it.
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchHistoryApi(page, limit);
      setIncidentHistory(data.history);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error(error.message);
      setModal({ visible: true, message: 'Failed to load history. ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch for incident history and stats
  useEffect(() => {
    fetchStats();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  
  // Separate effect for initial activity fetch
  useEffect(() => {
    fetchActivities(1); // Fetch the first page of activities on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up an interval to refresh all data every minute
  const refreshAllData = () => {
    fetchStats();
    if (page === 1) {
        fetchHistory();
    } else {
        setPage(1); // This will trigger the history fetch via useEffect
    }
    setActivityPage(1);
    fetchActivities(1);
  };

  useEffect(() => {
    const intervalId = setInterval(refreshAllData, 60000); // 60000 ms = 1 minute
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleLoadMoreActivities = () => {
    const nextPage = activityPage + 1;
    setActivityPage(nextPage);
    fetchActivities(nextPage);
  };

  const toggleExpand = (incidentNumber) => {
    setExpandedIncidents(prev => ({
      ...prev,
      [incidentNumber]: !prev[incidentNumber]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'bg-blue-200 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-200 text-yellow-800';
      case 'Resolved':
        return 'bg-green-200 text-green-800';
      case 'Error':
        return 'bg-red-200 text-red-800';
      case 'SOP not found':
        return 'bg-purple-200 text-purple-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  const handlePrev = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handleDraftSopClick = (incident) => {
    if (onDraftSop) {
      onDraftSop(incident);
    }
  };

  const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex items-center p-4 bg-white rounded-xl shadow-lg border border-gray-200 ${colorClass}`}>
      <div className="p-3 bg-opacity-20 rounded-full">
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
      DELETE_SOP: `SOP deleted: "ID: ${activity.details.sop_id}"`,
    };

    return (
      <li className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
        <div className="flex-shrink-0">{ICONS[activity.activity_type] || <AlertTriangle size={20} />}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-700 truncate">{TITLES[activity.activity_type] || 'Unknown Activity'}</p>
        </div>
        <div className="text-xs text-gray-400 flex-shrink-0">{formatDate(activity.timestamp)}</div>
      </li>
    );
  };

  if (loading && incidentHistory.length === 0) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-500">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-6 border-b-2 pb-2 border-blue-100">
        System Activity History
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard 
          icon={<FileCode size={24} className="text-blue-500" />} 
          title="Total Scripts" 
          value={stats.total_scripts}
          colorClass="bg-blue-50"
        />
        <StatCard 
          icon={<BookOpen size={24} className="text-green-500" />} 
          title="Active SOPs" 
          value={stats.total_sops}
          colorClass="bg-green-50"
        />
        <StatCard 
          icon={<AlertTriangle size={24} className="text-purple-500" />} 
          title="Total Incidents" 
          value={stats.total_incidents}
          colorClass="bg-purple-50"
        />
      </div>

      <h3 className="text-2xl font-bold text-gray-700 border-b pb-2">Recent Activity</h3>
      
      {loadingActivities && activityLog.length === 0 ? (
        <p className="text-gray-500">Loading activities...</p>
      ) : activityLog.length > 0 ? (
        <div>
            <ul className="space-y-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                {activityLog.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                ))}
            </ul>
            {hasMoreActivities && (
                <div className="text-center mt-4">
                    <button
                        onClick={handleLoadMoreActivities}
                        disabled={loadingActivities}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition disabled:text-gray-400"
                    >
                        {loadingActivities ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
      ) : (
        <p className="text-gray-500 p-4">No system activities found.</p>
      )}

      <h3 className="text-2xl font-bold text-gray-700 border-b pb-2 mt-8">Incident Resolution History</h3>
      {incidentHistory.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg shadow-inner">
          <Clock size={48} className="text-gray-400 mb-4" />
          <p className="text-xl text-gray-500 font-semibold">No history found.</p>
          <p className="text-sm text-gray-400 mt-2">Resolved incidents will appear here.</p>
        </div>
      ) : (
        <>
          {incidentHistory.map(incident => (
            <div key={incident.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-transform duration-300 hover:scale-[1.01]">
              <div
                onClick={() => toggleExpand(incident.incident_number)}
                className="cursor-pointer flex justify-between items-center"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center flex-wrap">
                    <span className="mr-3">Incident: {incident.incident_number}</span>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                      {incident.status}
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Last Updated: {formatDate(incident.resolved_at)}
                  </p>
                </div>
                 {incident.status === 'SOP not found' && (
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       handleDraftSopClick(incident);
                     }}
                     className="ml-4 flex-shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-full shadow-md hover:bg-green-700 transition"
                   >
                     Draft SOP with AI
                   </button>
                 )}
                <button className="text-blue-600 hover:text-blue-800 transition duration-200 ml-4 flex-shrink-0">
                  {expandedIncidents[incident.incident_number] ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
              </div>
              {expandedIncidents[incident.incident_number] && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">Initial Incident Details:</h4>
                    <div className="text-gray-600 bg-gray-50 p-3 rounded-lg mt-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(incident.incident_data, null, 2)}</pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">LLM Plan:</h4>
                    <div className="text-gray-600 bg-gray-50 p-3 rounded-lg mt-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(incident.llm_plan, null, 2)}</pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">Resolved Scripts:</h4>
                    {incident.resolved_scripts && incident.resolved_scripts.length > 0 ? (
                      incident.resolved_scripts.map((script, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg mt-2 space-y-1">
                          <p className="font-semibold text-gray-700">{index + 1}. {script.script_name || script.step_description}</p>
                          {script.script_name && (
                            <p className="text-sm text-gray-600">
                                <span className="font-medium">Parameters:</span>
                                <span className="font-mono ml-2">{JSON.stringify(script.extracted_parameters)}</span>
                            </p>
                          )}
                          <div className={`rounded-lg p-2 mt-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto ${script.status === 'success' ? 'bg-green-100' : script.status === 'error' ? 'bg-red-100' : 'bg-gray-200'}`}>
                            {script.output || 'No output.'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No scripts were executed.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handlePrev}
              disabled={page === 1 || loading}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={page === totalPages || loading}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      <button
        onClick={refreshAllData}
        disabled={loading || loadingActivities}
        className="fixed bottom-10 right-10 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform duration-200 hover:scale-110 disabled:bg-blue-400 disabled:cursor-not-allowed"
        title="Refresh History"
      >
        <RefreshCw size={24} className={(loading || loadingActivities) ? 'animate-spin' : ''} />
      </button>
      
      <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
    </div>
  );
};

export default History;

