import React from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'; // Keep Info icon for default value indication

const WorkflowTimeline = ({ steps, onExecuteStep, executionDisabled }) => {

    const renderStepIcon = (status) => {
        switch (status) {
            case 'running':
                return <Loader2 className="animate-spin text-blue-500" size={24} />;
            case 'success':
                return <CheckCircle className="text-green-500" size={24} />;
            case 'error':
                return <XCircle className="text-red-500" size={24} />;
            // Removed 'skipped' case
            default: // idle or undefined
                // Keep the default grey circle for steps without a specific status yet
                return <div className="w-6 h-6 rounded-full bg-gray-300 border-4 border-white" />;
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'running':
                return { borderColor: 'border-blue-500', bgColor: 'bg-blue-50' };
            case 'success':
                return { borderColor: 'border-green-500', bgColor: 'bg-green-50' };
            case 'error':
                 return { borderColor: 'border-red-500', bgColor: 'bg-red-50' };
            // Removed 'skipped' case
            default: // idle or undefined (or any other status)
                 return { borderColor: 'border-gray-300', bgColor: 'bg-gray-50' };
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    // Ensure steps is always an array before mapping
    const validSteps = Array.isArray(steps) ? steps : [];

    return (
        <motion.div
            className="relative pl-8" // Padding left for the line and icons
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* The vertical timeline line */}
            <div className="absolute left-11 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true"></div>

            {validSteps.map((step, index) => {
                // Determine status based on executionStatus (live) or status (historical)
                const currentStatus = step.executionStatus || step.status;
                const { borderColor, bgColor } = getStatusStyles(currentStatus);
                const taskName = step.script_name; // Use existing variable name

                return (
                    <motion.div key={index} className="relative mb-8" variants={itemVariants}>
                        {/* Icon positioning */}
                        <div className="absolute top-0 left-0 flex items-center justify-center transform -translate-x-1/2">
                            <div className={`flex items-center justify-center w-8 h-8 ${bgColor} rounded-full border-4 border-white shadow-sm`}>
                                {renderStepIcon(currentStatus)}
                            </div>
                        </div>

                        {/* Step Content Box */}
                        <div className={`ml-12 p-4 rounded-lg shadow-sm border ${borderColor} ${bgColor}`}>
                            <div className="flex items-start justify-between">
                                {/* Step Description and Details */}
                                <div className="flex-1 min-w-0"> {/* Allow shrinking */}
                                    <p className="font-semibold text-base text-gray-800 break-words">{step.step_description || 'No Description Provided'}</p>

                                    {/* Worker Task (Script) Details */}
                                    {taskName ? ( // Check if taskName exists
                                        <div className="mt-3 font-mono text-xs">
                                            <p className="font-medium text-blue-700">Worker Task: <span className="text-gray-700 bg-blue-100 px-1.5 py-0.5 rounded">{taskName}</span></p>

                                            {/* Parameters Section */}
                                            {(Array.isArray(step.parameters) && step.parameters.length > 0) && (
                                                <div className="mt-2">
                                                    <p className="font-bold text-gray-600 mb-1">Parameters Used:</p>
                                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                                        {step.parameters.map((param, i) => {
                                                            // Use optional chaining for safer access
                                                            const extractedValue = step.extracted_parameters?.[param.param_name];
                                                            const defaultValue = param.default_value;

                                                            // Determine if default was used:
                                                            // - Extracted value is null/undefined/empty string
                                                            // - AND Default value is not null/undefined/empty string
                                                            const wasExtracted = extractedValue !== null && extractedValue !== undefined && extractedValue !== '';
                                                            const hasDefault = defaultValue !== null && defaultValue !== undefined && defaultValue !== '';
                                                            const usedDefault = !wasExtracted && hasDefault;

                                                            return (
                                                                <li key={i} className="flex items-center space-x-2 text-gray-700">
                                                                    <span className="font-semibold">{param.param_name}:</span>
                                                                    {wasExtracted ? (
                                                                        // Display extracted value
                                                                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-md font-medium">{String(extractedValue)}</span>
                                                                    ) : usedDefault ? (
                                                                        // Display default value and indicator
                                                                        <>
                                                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md font-medium">{String(defaultValue)}</span>
                                                                            <span className="text-yellow-600 text-[10px] font-semibold">(default)</span>
                                                                        </>
                                                                    ) : (
                                                                        // Display Value Not Found only if no value AND no default
                                                                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-md font-medium">Value Not Found</span>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Output Section */}
                                            {step.output && (
                                                <div className="mt-3 p-2 bg-white rounded border border-gray-300 overflow-x-auto max-h-40">
                                                    <p className="font-semibold text-xs text-gray-600 mb-1">Output:</p>
                                                    <pre className="text-[11px] text-gray-800 whitespace-pre-wrap font-mono">{step.output}</pre>
                                                </div>
                                            )}
                                        </div>
                                    // Removed the specific 'skipped' message handling here
                                    ): (
                                        // Display if no task name was associated (original logic)
                                        <div className="mt-2 bg-orange-100 text-orange-800 p-2 rounded font-medium text-xs flex items-center">
                                            <AlertCircle size={14} className="inline mr-1.5 flex-shrink-0" />
                                            No matching worker task found for this step.
                                        </div>
                                    )}
                                </div>

                                {/* Execute Button (only if handler provided) */}
                                {/* Condition remains largely the same, just checking currentStatus */}
                                {onExecuteStep && currentStatus !== 'success' && currentStatus !== 'running' && step.script_id && step.script_id !== 'Not Found' && (
                                    <button
                                        onClick={() => onExecuteStep(step, index)}
                                        disabled={currentStatus === 'running' || executionDisabled}
                                        className="ml-4 flex-shrink-0 p-2 rounded-full shadow-md transition duration-300 disabled:bg-gray-300 disabled:cursor-not-allowed bg-green-500 hover:bg-green-600 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500"
                                        title={`Execute Step ${index + 1}`}
                                    >
                                        <Play size={18} />
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

