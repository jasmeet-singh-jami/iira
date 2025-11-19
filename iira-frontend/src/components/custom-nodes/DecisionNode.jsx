// iira-frontend/src/components/custom-nodes/DecisionNode.jsx
import React from 'react';
import { Handle, Position } from 'reactflow';
import { Share2 } from 'lucide-react'; 

/**
 * Custom node to represent a decision point (Conditional/Fork). 
 * It has one target (input) and two sources (outputs) for branching: 'True' and 'False'.
 */
const DecisionNode = ({ data }) => {
    return (
        <div className="p-4 border-2 border-red-500 rounded-lg bg-white w-48 shadow-lg text-center">
            {/* Target Handle (Input) */}
            <Handle 
                type="target" 
                position={Position.Top} 
                className="w-3 h-3 !bg-red-500" 
            />
            
            <div className="flex flex-col items-center">
                <Share2 size={24} className="text-red-500 mb-2"/>
                <div className="font-bold text-red-800">Decision/Conditional</div>
                <div className="text-xs text-gray-600 mt-1">
                    {data.label || 'Condition Check'}
                </div>
            </div>
            
            {/* Source Handle 'a' for False Branch (Left) */}
            <Handle 
                type="source" 
                position={Position.Left} 
                id="a" // Unique ID for this specific source handle
                style={{ top: '50%', left: -5, transform: 'translate(0, -50%)', border: '2px solid #ef4444' }} 
                className="w-3 h-3 !bg-white" 
            />
            <div className="absolute top-1/2 left-0 transform -translate-x-full -translate-y-1/2 text-xs text-red-600 pr-1">False</div>

            {/* Source Handle 'b' for True Branch (Right) */}
            <Handle 
                type="source" 
                position={Position.Right} 
                id="b" // Unique ID for this specific source handle
                style={{ top: '50%', right: -5, transform: 'translate(0, -50%)', border: '2px solid #10b981' }} 
                className="w-3 h-3 !bg-white" 
            />
             <div className="absolute top-1/2 right-0 transform translate-x-full -translate-y-1/2 text-xs text-green-600 pl-1">True</div>
        </div>
    );
};

export default DecisionNode;