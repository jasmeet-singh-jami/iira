// src/components/ClarificationModal.jsx
import React from 'react';
import { HelpCircle, Send, X, Loader2 } from 'lucide-react';

const ClarificationModal = ({ isOpen, questions, answers, setAnswers, onSubmit, onClose, loading }) => {
    if (!isOpen) return null;

    const handleAnswerChange = (question, value) => {
        setAnswers(prev => ({ ...prev, [question]: value }));
    };

    const allQuestionsAnswered = questions.every(q => answers[q]?.trim());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60">
            <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h3 className="text-2xl font-bold text-blue-800 flex items-center">
                        <HelpCircle size={28} className="mr-3 text-blue-500" />
                        More Information Needed
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition duration-300">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <p className="text-gray-600 mb-4">
                        To generate a more accurate SOP, please answer the following questions:
                    </p>
                    {questions.map((q, index) => (
                        <div key={index} className="space-y-2">
                            <label className="font-semibold text-gray-700">{q}</label>
                            <input
                                type="text"
                                value={answers[q] || ''}
                                onChange={e => handleAnswerChange(q, e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Your answer..."
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onSubmit}
                        disabled={!allQuestionsAnswered || loading}
                        className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-300 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 size={20} className="animate-spin mr-2" />
                        ) : (
                            <Send size={20} className="mr-2" />
                        )}
                        {loading ? 'Generating...' : 'Submit Answers'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClarificationModal;
