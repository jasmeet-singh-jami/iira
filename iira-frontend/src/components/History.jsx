import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, RefreshCw, BookOpen, FileCode, AlertTriangle } from 'lucide-react';
import { fetchHistoryApi, fetchSystemStatsApi } from '../services/apis';
import Modal from './Modal';

const History = ({ onDraftSop }) => {
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncidents, setExpandedIncidents] = useState({});
  const [modal, setModal] = useState({ visible: false, message: '' });

  // --- NEW: State for system statistics ---
  const [stats, setStats] = useState({
    total_scripts: 0,
    total_sops: 0,
    total_incidents: 0,
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10; // items per page

  // --- NEW: Function to fetch system stats ---
  const fetchStats = async () => {
    try {
      const systemStats = await fetchSystemStatsApi();
      setStats(systemStats);
    } catch (error) {
      console.error("Failed to fetch system stats:", error.message);
      // Silently fail or show a non-intrusive error
    }
  };

  // Function to fetch history data
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

  // Initial fetch for both stats and history
  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, [page]);

  // Set up an interval to refresh data every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchStats();
      fetchHistory();
    }, 60000); // 60000 ms = 1 minute

    return () => clearInterval(intervalId);
  }, [page]);

  const toggleExpand = (incidentNumber) => {
    setExpandedIncidents(prev => ({
      ...prev,
      [incidentNumber]: !prev[incidentNumber]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'In Progress';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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

  // Pagination handlers
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
  
  const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex-1 p-6 bg-white rounded-2xl shadow-md border border-gray-200 flex items-center space-x-4`}>
      <div className={`p-3 rounded-full ${colorClass.bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-gray-500 font-semibold">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );


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
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-800">
          System Activity History
        </h2>
        <p className="text-gray-500 mt-1">Complete audit trail of all system activities</p>
      </div>

      {/* --- NEW: System Status Dashboard --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          icon={<FileCode size={28} className="text-blue-600" />}
          title="Total Scripts"
          value={stats.total_scripts}
          colorClass={{ bg: 'bg-blue-100' }}
        />
        <StatCard 
          icon={<BookOpen size={28} className="text-green-600" />}
          title="Active SOPs"
          value={stats.total_sops}
          colorClass={{ bg: 'bg-green-100' }}
        />
        <StatCard 
          icon={<AlertTriangle size={28} className="text-purple-600" />}
          title="Total Incidents"
          value={stats.total_incidents}
          colorClass={{ bg: 'bg-purple-100' }}
        />
      </div>

      <h3 className="text-2xl font-bold text-gray-700 border-b pb-2">Recent Activity</h3>

      {incidentHistory.length === 0 ? (
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
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    Incident: {incident.incident_number}
                    <span className={`ml-3 px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(incident.status)}`}>
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
                      onDraftSop(incident.incident_data);
                    }}
                    className="mr-4 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition duration-300"
                  >
                    Draft SOP with AI
                  </button>
                )}
                <button className="text-blue-600 hover:text-blue-800 transition duration-200">
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
        onClick={() => { fetchStats(); fetchHistory(); }}
        disabled={loading}
        className="fixed bottom-10 right-10 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform duration-200 hover:scale-110 disabled:bg-blue-400 disabled:cursor-not-allowed"
        title="Refresh History"
      >
        <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
      </button>
      
      <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
    </div>
  );
};

export default History;

