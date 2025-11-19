import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Check, X } from 'lucide-react';

const DecisionNode = ({ data, isConnectable }) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-yellow-400 w-[200px]">
      {/* Input Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-gray-500"
      />

      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-yellow-100 text-yellow-600 mr-3">
          <GitBranch size={16} />
        </div>
        <div className="flex-grow">
          <p className="text-xs font-bold text-gray-500 uppercase">Decision</p>
          <p className="text-sm font-semibold text-gray-900">{data.label || 'Condition?'}</p>
        </div>
      </div>

      {/* Output Handles (Bottom) - Fork Logic */}
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-100 relative h-6">
        
        {/* True/Yes Path */}
        <div className="absolute left-2 -bottom-1 flex flex-col items-center">
            <span className="text-[10px] font-bold text-green-600 mb-1">YES</span>
            <Handle
                type="source"
                position={Position.Bottom}
                id="true"
                isConnectable={isConnectable}
                className="!bg-green-500 !w-3 !h-3 !relative !transform-none !left-0"
            />
        </div>

        {/* False/No Path */}
        <div className="absolute right-2 -bottom-1 flex flex-col items-center">
            <span className="text-[10px] font-bold text-red-600 mb-1">NO</span>
             <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                isConnectable={isConnectable}
                className="!bg-red-500 !w-3 !h-3 !relative !transform-none !left-0"
            />
        </div>
      </div>
    </div>
  );
};

export default memo(DecisionNode);