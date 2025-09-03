import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { fetchHistoryApi } from '../services/apis';
import Modal from './Modal';

const History = () => {
  const [incidentHistory, setIncidentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncidents, setExpandedIncidents] = useState({});
  const [modal, setModal] = useState({ visible: false, message: '' });

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10; // items per page

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Updated API call to include page and limit
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
    fetchHistory();
    // Dependency array includes 'page' to refetch data on page change
  }, [page]);

  const toggleExpand = (incidentNumber) => {
    setExpandedIncidents(prev => ({
      ...prev,
      [incidentNumber]: !prev[incidentNumber]
    }));
  };

  const formatDate = (dateString) => {
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

  if (loading) {
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
        Incident Resolution History
      </h2>
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
                    Resolved on: {formatDate(incident.resolved_at)}
                  </p>
                </div>
                <button className="text-blue-600 hover:text-blue-800 transition duration-200">
                  {expandedIncidents[incident.incident_number] ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
              </div>
              {expandedIncidents[incident.incident_number] && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">Initial Incident Details:</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg mt-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(incident.incident_data, null, 2)}</pre>
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">LLM Plan:</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg mt-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(incident.llm_plan, null, 2)}</pre>
                    </p>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">Resolved Scripts:</h4>
                    {incident.resolved_scripts && incident.resolved_scripts.length > 0 ? (
                      incident.resolved_scripts.map((script, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg mt-2 space-y-1">
                          <p className="font-semibold text-gray-700">{index + 1}. {script.script_name}</p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Parameters:</span>
                            <span className="font-mono ml-2">{JSON.stringify(script.extracted_parameters)}</span>
                          </p>
                          <div className="bg-gray-200 rounded-lg p-2 mt-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {script.output}
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
          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
      <Modal message={modal.message} visible={modal.visible} onClose={() => setModal({ visible: false, message: '' })} />
    </div>
  );
};

export default History;