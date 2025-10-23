// src/components/custom-nodes/StepNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Wrench } from 'lucide-react'; // Changed icon

const StepNode = ({ data }) => {
    // Determine the text to display based on whether a script/task name or ID is available
    const taskIdentifier = data.script || (data.script_id ? `ID: ${data.script_id}` : null);

    return (
        <div className="p-4 border-2 border-gray-300 rounded-lg bg-white w-80 shadow-md">
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />
            
            <div className="flex items-center mb-2">
                <div className="font-bold text-gray-800">Step {data.index + 1}</div>
            </div>

            <div className="text-sm text-gray-600 mb-3 truncate">{data.description}</div>
            
            {taskIdentifier ? (
                 <div className="flex items-center text-xs text-blue-600 bg-blue-100 p-2 rounded">
                    <Wrench size={16} className="mr-2 flex-shrink-0" /> {/* Changed icon */}
                    <span className="font-mono truncate">{taskIdentifier}</span>
                </div>
            ) : (
                <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded font-semibold">
                    No worker task associated {/* Changed text */}
                </div>
            )}
            
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
        </div>
    );
};

export default StepNode;
