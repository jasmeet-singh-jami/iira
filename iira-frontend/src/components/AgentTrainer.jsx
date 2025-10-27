// src/components/AgentTrainer.jsx
import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, Search, Loader2, Info, RefreshCcw } from 'lucide-react';
import SearchableDropdown from './SearchableDropdown';

const AgentTrainer = ({
    incidentNumber,
    setIncidentNumber,
    shortDescription,
    setShortDescription,
    description,
    setDescription,
    onFetchRecommendations,
    recommendations,
    thresholds,
    onSubmitFeedback,
    allAgents,
    loading,
    feedbackSessionId,
    clearRecommendations
}) => {
    const [showCorrectionDropdown, setShowCorrectionDropdown] = useState(false);
    const [selectedCorrectionId, setSelectedCorrectionId] = useState('');
    // --- NEW STATE: Track if a search has been attempted ---
    const [searchAttempted, setSearchAttempted] = useState(false);

    const handleCorrectFeedback = (agent) => {
        setShowCorrectionDropdown(false);
        setSearchAttempted(false); // Reset search attempt after feedback
        onSubmitFeedback('Correct', agent);
    };

    const handleIncorrectFeedback = () => {
        setShowCorrectionDropdown(true);
        // Do not reset searchAttempted here, user is still in the process
    };

    const handleSubmitCorrection = () => {
        const selectedAgent = allAgents.find(agent => agent.id === selectedCorrectionId);
        if (selectedAgent) {
            setSearchAttempted(false); // Reset search attempt after feedback
            onSubmitFeedback('Incorrect', recommendations?.[0] || null, selectedAgent);
            setShowCorrectionDropdown(false);
            setSelectedCorrectionId('');
        } else {
             console.error("Invalid agent selected for correction");
        }
    };

    const handleReset = () => {
        setIncidentNumber('');
        setShortDescription('');
        setDescription('');
        setShowCorrectionDropdown(false);
        setSelectedCorrectionId('');
        setSearchAttempted(false); // Reset search attempt flag
        if (clearRecommendations) {
            clearRecommendations();
        }
    };

    // --- Wrapper for fetch to set searchAttempted ---
    const handleFetchClick = () => {
        setSearchAttempted(true); // Mark that a search is being attempted
        onFetchRecommendations();
    }
    // --- End Wrapper ---


    const thresholdValue = thresholds?.INITIAL_SEARCH_THRESHOLD ?? thresholds?.HYDE_SEARCH_THRESHOLD ?? 0.5;
    const thresholdPercent = (thresholdValue * 100).toFixed(0);

    const canSearch = (incidentNumber.trim() || (shortDescription.trim() && description.trim())) && !loading;


    return (
        <div className="p-8 max-w-4xl mx-auto">
             <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Agent Trainer</h1>
                    <p className="mt-1 text-gray-500">Improve Agent recommendations by validating matches.</p>
                </div>
                 <button
                    onClick={handleReset}
                    className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-300 transition duration-300"
                    disabled={loading}
                >
                    <RefreshCcw size={16} className="mr-2" /> Reset Form
                </button>
            </div>


            {/* Input Area */}
            <div className="space-y-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                <h2 className="text-lg font-semibold text-gray-700">Enter Incident Details (Use Number OR Descriptions)</h2>
                <input
                    type="text"
                    value={incidentNumber}
                    onChange={e => setIncidentNumber(e.target.value)}
                    placeholder="Incident Number (e.g., INC001)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                 <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
                    <div className="relative bg-white px-2 text-sm text-gray-500">OR</div>
                </div>
                <input
                    type="text"
                    value={shortDescription}
                    onChange={e => setShortDescription(e.target.value)}
                    placeholder="Short Description (Required if no Incident Number)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                 <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Full Description (Required if no Incident Number)"
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <div className="flex justify-end">
                    <button
                        onClick={handleFetchClick} // Use the wrapper function
                        className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 disabled:bg-blue-300 disabled:cursor-not-allowed"
                        disabled={!canSearch}
                    >
                        {loading ? (<Loader2 className="animate-spin h-5 w-5 mr-2" />) : (<Search size={18} className="mr-2" />)}
                        {loading ? 'Searching...' : 'Find Recommended Agents'}
                    </button>
                </div>
            </div>


            {/* Recommendations Area */}
            {!loading && recommendations.length > 0 && (
                <div className="space-y-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                     <div className="flex justify-between items-center mb-3">
                         <h2 className="text-lg font-semibold text-gray-700">Top Recommendations</h2>
                         <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex items-center">
                            <Info size={12} className="mr-1 text-gray-400"/> Confidence Threshold: {thresholdPercent}%
                         </div>
                     </div>
                    {recommendations.map((agent, index) => (
                        <div key={agent.id || index} className={`p-4 rounded-lg border flex items-center justify-between gap-4 ${agent.score >= thresholdValue ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                            <div>
                                <p className={`font-semibold ${agent.score >= thresholdValue ? 'text-green-800' : 'text-orange-800'}`}>{index + 1}. {agent.title || 'Unknown Agent'}</p>
                                <p className="text-sm text-gray-600">Confidence: {(agent.score * 100).toFixed(1)}%</p>
                            </div>
                            <button onClick={() => handleCorrectFeedback(agent)} disabled={loading || showCorrectionDropdown} className="flex items-center px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full shadow-sm hover:bg-green-600 transition disabled:bg-green-300 disabled:cursor-not-allowed" title="Confirm this is the correct Agent">
                                <ThumbsUp size={14} className="mr-1" /> Correct
                            </button>
                        </div>
                    ))}
                    {!showCorrectionDropdown && (
                        <div className="flex justify-center pt-3">
                             <button onClick={handleIncorrectFeedback} disabled={loading} className="flex items-center px-4 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-full shadow-sm hover:bg-red-600 transition disabled:bg-red-300" title="None of these recommendations are correct">
                                <ThumbsDown size={16} className="mr-1.5" /> None Correct
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Correction Dropdown Area */}
            {!loading && showCorrectionDropdown && (
                 <div className="space-y-3 mb-6 p-4 border border-red-300 rounded-lg bg-red-50 shadow-sm">
                     <label className="text-sm font-semibold text-red-800 mb-1 block">Please select the correct Agent:</label>
                     <div className="flex items-center space-x-2">
                        <div className="flex-grow">
                             <SearchableDropdown options={allAgents} value={selectedCorrectionId} onChange={setSelectedCorrectionId} placeholder="Search and select the correct Agent..."/>
                        </div>
                        <button onClick={handleSubmitCorrection} disabled={!selectedCorrectionId || loading} className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed">
                           <Send size={16} className="mr-1.5" /> Submit Correction
                        </button>
                     </div>
                 </div>
            )}

             {/* Message if no recommendations found */}
             {/* --- UPDATED CONDITION --- */}
             {!loading && searchAttempted && recommendations.length === 0 && feedbackSessionId === null && (
                <div className="text-center py-6 text-gray-500">
                    No recommendations found matching the description provided.
                </div>
             )}
             {/* --- END UPDATED CONDITION --- */}

        </div>
    );
};

export default AgentTrainer;

