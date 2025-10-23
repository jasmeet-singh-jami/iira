import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, RefreshCw } from 'lucide-react';
import { fetchHistoryApi } from '../services/apis';
import Modal from './Modal';
import WorkflowTimeline from './WorkflowTimeline'; // Import the new component

const History = ({ onDraftRunbook }) => { // Prop name kept for consistency with App.js handler
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncidents, setExpandedIncidents] = useState({});
  const [modal, setModal] = useState({ visible: false, message: '' });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchHistoryApi(page, limit);
      if (data && data.history) {
        setIncidentHistory(data.history);
        setTotalPages(data.total_pages);
      }
    } catch (error) {
      console.error(error.message);
      setModal({ visible: true, message: 'Failed to load history. ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const refreshHistory = () => {
    if (page !== 1) {
        setPage(1);
    } else {
        fetchHistory();
    }
  };

  useEffect(() => {
    const intervalId = setInterval(refreshHistory, 60000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
      case 'New': return 'bg-blue-200 text-blue-800';
      case 'In Progress': return 'bg-yellow-200 text-yellow-800';
      case 'Resolved': return 'bg-green-200 text-green-800';
      case 'Error': return 'bg-red-200 text-red-800';
      case 'SOP not found': return 'bg-purple-200 text-purple-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const handlePrev = () => { if (page > 1) setPage(page - 1); };
  const handleNext = () => { if (page < totalPages) setPage(page + 1); };
  
  const handleDraftAgentClick = (incident) => { // Renamed handler for clarity
    if (onDraftRunbook) onDraftRunbook(incident);
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
    <div className="p-8 space-y-6">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-4xl font-extrabold text-gray-800">Incident Resolution History</h1>
        <p className="mt-1 text-gray-500">Review the details and outcomes of all past automated incident resolutions.</p>
      </div>

      {incidentHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg shadow-inner mt-10">
          <Clock size={48} className="text-gray-400 mb-4" />
          <p className="text-xl text-gray-500 font-semibold">No history found.</p>
          <p className="text-sm text-gray-400 mt-2">Resolved incidents will appear here.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {incidentHistory.map(incident => (
              <div key={incident.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-transform duration-300 hover:scale-[1.01]">
                <div onClick={() => toggleExpand(incident.incident_number)} className="cursor-pointer flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center flex-wrap">
                      <span className="mr-3">Incident: {incident.incident_number}</span>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Last Updated: {formatDate(incident.resolved_at)}</p>
                  </div>
                  {['SOP not found', 'Error'].includes(incident.status) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDraftAgentClick(incident); }} className="mr-4 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-full shadow-md hover:bg-green-700 transition">
                      Draft Agent with AI {/* Changed button text */}
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
                      <h4 className="text-lg font-semibold text-gray-700">Resolution Workflow:</h4>
                        {incident.resolved_scripts && incident.resolved_scripts.length > 0 ? (
                            <div className="mt-4">
                                <WorkflowTimeline steps={incident.resolved_scripts} />
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 mt-2">No scripts were executed.</p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-6">
            <button onClick={handlePrev} disabled={page === 1 || loading} className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={handleNext} disabled={page === totalPages || loading} className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50">Next</button>
          </div>
        </>
      )}
      <button onClick={refreshHistory} disabled={loading} className="fixed bottom-10 right-10 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform duration-200 hover:scale-110 disabled:bg-blue-400 disabled:cursor-not-allowed" title="Refresh History">
        <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
      </button>
      <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
    </div>
  );
};

export default History;
