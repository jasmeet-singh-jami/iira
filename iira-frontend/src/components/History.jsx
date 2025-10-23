import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, RefreshCw } from 'lucide-react';
import { fetchHistoryApi } from '../services/apis';
import Modal from './Modal';
import WorkflowTimeline from './WorkflowTimeline'; // Import the component

const History = ({ onDraftRunbook }) => { // Renamed onDraftAgent for clarity if needed, keeping prop name for now
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncidents, setExpandedIncidents] = useState({});
  const [modal, setModal] = useState({ visible: false, message: '' });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10; // Items per page

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
        setPage(1); // Go back to first page on manual refresh
    } else {
        fetchHistory(); // Refetch current page if already on page 1
    }
  };

  // Optional: Auto-refresh interval (consider if this is desired behavior)
  useEffect(() => {
    const intervalId = setInterval(fetchHistory, 60000); // Auto-refresh every 60 seconds
    return () => clearInterval(intervalId); // Cleanup interval on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]); // Re-create interval if page changes (might not be needed depending on goal)

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
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Error': return 'bg-red-100 text-red-800';
      case 'SOP not found': return 'bg-purple-100 text-purple-800'; // Specific status for no Agent found
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePrev = () => { if (page > 1) setPage(page - 1); };
  const handleNext = () => { if (page < totalPages) setPage(page + 1); };

  const handleDraftRunbookClick = (incident) => {
    if (onDraftRunbook) { // Check if the function prop exists
        onDraftRunbook(incident); // Call the function passed from App.js
    } else {
        console.error("onDraftRunbook function not passed to History component");
    }
  };

  // Loading state while initially fetching
  if (loading && incidentHistory.length === 0) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-500">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
            <h1 className="text-4xl font-extrabold text-gray-800">Incident Resolution History</h1>
            <p className="mt-1 text-gray-500">Review the details and outcomes of past automated incident resolutions.</p>
        </div>
        <button
            onClick={refreshHistory} disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg shadow-sm hover:bg-blue-200 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh History"
        >
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {incidentHistory.length === 0 && !loading ? (
        // Display if no history exists after loading finishes
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg shadow-inner mt-10 border border-gray-200">
          <Clock size={48} className="text-gray-400 mb-4" />
          <p className="text-xl text-gray-500 font-semibold">No history found.</p>
          <p className="text-sm text-gray-400 mt-2">Resolved incidents will appear here.</p>
        </div>
      ) : (
        // Display history list and pagination
        <>
          <div className="space-y-4">
            {incidentHistory.map(incident => (
              <div key={incident.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-shadow duration-200 hover:shadow-xl">
                {/* Clickable Header Area */}
                <div onClick={() => toggleExpand(incident.incident_number)} className="cursor-pointer flex justify-between items-center">
                  {/* Left Side: Incident Info */}
                  <div className="flex-1 min-w-0 mr-4"> {/* Added margin-right */}
                    <h3 className="text-xl font-bold text-gray-800 flex items-center flex-wrap gap-x-3 gap-y-1">
                      <span className="whitespace-nowrap">Incident: {incident.incident_number}</span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 truncate" title={`Last Updated: ${formatDate(incident.resolved_at)}`}>
                        Last Updated: {formatDate(incident.resolved_at)}
                    </p>
                  </div>
                  {/* Right Side: Button (Conditional) & Expander */}
                  <div className="flex items-center flex-shrink-0">
                    {/* --- CORRECTED CONDITION --- */}
                    {incident.status === 'SOP not found' && (
                      <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent toggling expand when clicking the button
                            handleDraftRunbookClick(incident);
                        }}
                        className="mr-4 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 transition"
                        title="Draft a new Agent based on this incident"
                      >
                        Draft Agent with AI
                      </button>
                    )}
                    {/* --- END CORRECTION --- */}
                    <button className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition duration-200">
                      {expandedIncidents[incident.incident_number] ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </button>
                  </div>
                </div>
                {/* Expandable Details Area */}
                {expandedIncidents[incident.incident_number] && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-700 mb-1">Initial Incident Details:</h4>
                      <div className="text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-1 font-mono text-xs overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(incident.incident_data, null, 2)}</pre>
                      </div>
                    </div>
                    {/* Only show LLM plan if it exists */}
                    {incident.llm_plan && Object.keys(incident.llm_plan).length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-700 mb-1">LLM Plan:</h4>
                          <div className="text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-1 font-mono text-xs overflow-x-auto">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(incident.llm_plan, null, 2)}</pre>
                          </div>
                        </div>
                    )}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-700 mb-1">Resolution Workflow:</h4>
                        {incident.resolved_scripts && incident.resolved_scripts.length > 0 ? (
                            <div className="mt-2 pl-2 border-l-4 border-gray-200"> {/* Indent workflow slightly */}
                                <WorkflowTimeline steps={incident.resolved_scripts} />
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mt-2 italic">No automated workflow steps were executed or recorded for this incident.</p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                <button onClick={handlePrev} disabled={page === 1 || loading} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-sm hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Previous
                </button>
                <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                <button onClick={handleNext} disabled={page === totalPages || loading} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-sm hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Next
                </button>
              </div>
          )}
        </>
      )}

      {/* Alert Modal */}
      <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
    </div>
  );
};

export default History;

