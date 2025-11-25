import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react';

const StepNode = ({ data, selected }) => {
  // Logic to determine what label to show
  // 1. data.label (Passed by Graph Builder)
  // 2. data.name (Raw backend name)
  // 3. Fallback to "Step" + index if strictly linear
  let displayLabel = data.label || data.name;
  
  // Handling the NaN issue: Only show index if it exists and is a number
  // If data.index is undefined (graph mode), we default to just "STEP" or ignore the number
  const stepNumber = (typeof data.index === 'number' && !isNaN(data.index))
    ? `STEP ${data.index + 1}` 
    : 'STEP';

  if (!displayLabel) {
      displayLabel = "Untitled Step";
  }

  // Determine status color/icon
  const isScriptMatched = !!data.script_id && data.script_id !== 'Not Found';
  const borderColor = selected ? '#2563eb' : (isScriptMatched ? '#10b981' : '#f59e0b');
  const bgColor = selected ? '#eff6ff' : '#ffffff';

  return (
    <div
      className="shadow-md rounded-md bg-white border-2 min-w-[160px] max-w-[200px]"
      style={{ borderColor: borderColor, backgroundColor: bgColor }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      
      {/* Header: Step Number/Tag */}
      <div className="p-2 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-md">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            {stepNumber}
        </span>
        {isScriptMatched ? 
            <CheckCircle2 size={14} className="text-green-500" /> : 
            <AlertCircle size={14} className="text-amber-500" />
        }
      </div>

      {/* Body: Step Name and Script */}
      <div className="p-3">
        <div className="text-sm font-bold text-gray-800 mb-2 leading-tight" title={displayLabel}>
          {displayLabel}
        </div>
        
        {data.script ? (
            <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
                <PlayCircle size={12} className="mr-1.5 flex-shrink-0" />
                <span className="truncate" title={data.script}>{data.script}</span>
            </div>
        ) : (
            <div className="text-xs text-amber-600 italic px-1">
                Action required
            </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  );
};

export default memo(StepNode);