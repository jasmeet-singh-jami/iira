// src/components/custom-nodes/StepNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';
import { FileCode } from 'lucide-react';

const StepNode = ({ data }) => {
    return (
        <div className="p-4 border-2 border-gray-300 rounded-lg bg-white w-80 shadow-md">
            <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />
            
            <div className="flex items-center mb-2">
                <div className="font-bold text-gray-800">Step {data.index + 1}</div>
            </div>

            <div className="text-sm text-gray-600 mb-3 truncate">{data.description}</div>
            
            {data.script || data.script_id ? (
                 <div className="flex items-center text-xs text-blue-600 bg-blue-100 p-2 rounded">
                    <FileCode size={16} className="mr-2 flex-shrink-0" />
                    <span className="font-mono truncate">{data.script || `ID: ${data.script_id}`}</span>
                </div>
            ) : (
                <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded font-semibold">
                    No script associated
                </div>
            )}
            
            <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
        </div>
    );
};

export default StepNode;