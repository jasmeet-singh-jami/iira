import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ClipboardList } from 'lucide-react'; 

const StepNode = ({ data, isConnectable }) => {
  return (
    // REMOVED overflow-hidden from this outer div
    <div className="w-[250px] bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow relative">
        
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-gray-400"
      />

      {/* Inner wrapper for content restricts overflow without hiding handles */}
      <div className="overflow-hidden rounded-lg"> 
          {/* Node Header */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded mr-2">
                <ClipboardList size={14} />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Step {data.index + 1}
            </span>
          </div>

          {/* Node Body */}
          <div className="p-3">
            <p className="text-sm font-medium text-gray-800 line-clamp-2">
                {data.description || "No description"}
            </p>
            {data.script && (
                <div className="mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 font-mono truncate">
                    {data.script}
                </div>
            )}
          </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-blue-500"
      />
    </div>
  );
};

export default memo(StepNode);