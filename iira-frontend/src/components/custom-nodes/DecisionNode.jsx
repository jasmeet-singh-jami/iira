import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch, CornerRightDown } from 'lucide-react'; 

// Component for the Decision Node
const DecisionNode = ({ data }) => {
    // The outputs are dynamically read from the data structure paths
    const paths = data.paths || {};
    const pathKeys = Object.keys(paths);

    return (
        <div 
            style={{ 
                padding: '10px 15px',
                borderRadius: '10px',
                border: '2px solid #3b82f6', // Blue border
                backgroundColor: '#eff6ff', // Light blue background
                textAlign: 'center',
                width: 180,
                minHeight: 80,
            }} 
            className="shadow-lg relative"
        >
            <div className="flex items-center justify-center space-x-2 text-blue-800 font-bold">
                <GitBranch size={20} />
                <span>{data.name || 'Decision'}</span>
            </div>
            <p className="text-sm mt-1 text-gray-700 font-semibold">{data.condition || 'Define Condition'}</p>

            {/* Input Handle (Always one at the top) */}
            <Handle type="target" position={Position.Top} isConnectable={true} id="input" />

            {/* Output Handles (Multiple handles at the bottom, one for each path) */}
            {pathKeys.map((key, index) => {
                const totalPaths = pathKeys.length;
                // Distribute handles horizontally. e.g., for 2 paths: 30%, 70%
                const leftPosition = (100 / (totalPaths + 1)) * (index + 1);
                
                // Assign a color based on key for visual distinction
                let color = '#ccc';
                if (key.toLowerCase() === 'true' || key.toLowerCase() === 'success') {
                    color = '#10b981'; // Green
                } else if (key.toLowerCase() === 'false' || key.toLowerCase() === 'failure') {
                    color = '#f43f5e'; // Red
                }

                return (
                    <Handle
                        key={key}
                        type="source"
                        position={Position.Bottom}
                        id={key} // Use the path key (e.g., 'true', 'false') as the handle ID
                        style={{ left: `${leftPosition}%`, backgroundColor: color }}
                        isConnectable={true}
                        title={`Path: ${key}`}
                    >
                        {/* Display path label next to the handle */}
                        <span className="absolute bottom-[-15px] text-xs font-semibold" style={{ 
                            transform: 'translateX(-50%)', 
                            pointerEvents: 'none',
                            color: color
                        }}>{key.toUpperCase()}</span>
                    </Handle>
                );
            })}
        </div>
    );
};

export default memo(DecisionNode);