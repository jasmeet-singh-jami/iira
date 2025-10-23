import React from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const WorkflowTimeline = ({ steps, onExecuteStep, executionDisabled }) => {

    const renderStepIcon = (status) => {
        switch (status) {
            case 'running':
                return <Loader2 className="animate-spin text-blue-500" size={24} />;
            case 'success':
                return <CheckCircle className="text-green-500" size={24} />;
            case 'error':
                return <XCircle className="text-red-500" size={24} />;
            default: // idle or undefined
                return <div className="w-6 h-6 rounded-full bg-gray-300 border-4 border-white" />;
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'running':
                return {
                    borderColor: 'border-blue-500',
                    bgColor: 'bg-blue-50',
                };
            case 'success':
                return {
                    borderColor: 'border-green-500',
                    bgColor: 'bg-green-50',
                };
            case 'error':
                 return {
                    borderColor: 'border-red-500',
                    bgColor: 'bg-red-50',
                };
            default:
                 return {
                    borderColor: 'border-gray-300',
                    bgColor: 'bg-gray-50',
                };
        }
    };
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            className="relative pl-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* The vertical line */}
            <div className="absolute left-11 top-0 h-full w-0.5 bg-gray-200" aria-hidden="true"></div>

            {steps.map((step, index) => {
                // Backend data structure still uses 'script_name'
                const taskName = step.script_name; 
                const { borderColor, bgColor } = getStatusStyles(step.executionStatus || step.status);
                
                return (
                    <motion.div key={index} className="relative mb-8" variants={itemVariants}>
                        <div className="absolute top-0 left-0 flex items-center justify-center -translate-x-1/2">
                            <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full">
                                {renderStepIcon(step.executionStatus || step.status)}
                            </div>
                        </div>

                        <div className={`ml-12 p-6 rounded-2xl shadow-inner border ${borderColor} ${bgColor}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="font-bold text-lg text-gray-800">{step.step_description}</p>
                                    
                                    {taskName ? (
                                        <div className="mt-4 font-mono text-sm">
                                            <p className="font-semibold text-blue-700">Worker Task: <span className="text-gray-700">{taskName}</span></p>
                                            
                                            {(step.parameters && step.parameters.length > 0) && (
                                                <div className="mt-2 text-xs">
                                                    <p className="font-bold text-blue-700 mb-1">Parameters:</p>
                                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                                        {step.parameters.map((param, i) => {
                                                            const extractedValue = step.extracted_parameters?.[param.param_name];
                                                            return (
                                                                <li key={i} className="flex items-center space-x-2">
                                                                    <span className="font-semibold text-gray-800">{param.param_name}:</span>
                                                                    {extractedValue ? (
                                                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-semibold text-xs">{extractedValue}</span>
                                                                    ) : (
                                                                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md font-semibold text-xs">Value Not Found</span>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}

                                            {step.output && (
                                                <div className="mt-4 p-3 bg-white rounded-lg border border-gray-300 overflow-x-auto">
                                                    <p className="font-semibold text-sm text-gray-600">Output:</p>
                                                    <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono mt-1">{step.output}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-3 bg-yellow-100 text-yellow-800 p-3 rounded-lg font-semibold text-sm flex items-center">
                                            <AlertCircle size={16} className="inline mr-2" />
                                            No matching worker task found for this step.
                                        </div>
                                    )}
                                </div>
                                {onExecuteStep && (
                                    <button
                                        onClick={() => onExecuteStep(step, index)}
                                        disabled={step.executionStatus === 'running' || executionDisabled}
                                        className="ml-4 flex-shrink-0 p-3 rounded-full shadow-md transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed bg-green-500 hover:bg-green-600 text-white"
                                        title="Execute Step"
                                    >
                                        <Play size={20} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};

export default WorkflowTimeline;
