// src/components/custom-nodes/WorkflowNodes.js
import React, { useContext } from 'react';
import { NodeContext } from 'react-flow-builder';

// --- Start Node Component ---
export const StartNodeDisplay = () => {
  const node = useContext(NodeContext);
  return (
    <div style={{
      backgroundColor: '#28a745',
      color: 'white',
      borderRadius: '50%',
      width: '70px',
      height: '70px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #1e7e34',
      fontWeight: 'bold',
      fontSize: '0.9rem'
    }}>
      {node.name}
    </div>
  );
};

// --- End Node Component (THIS WAS MISSING) ---
export const EndNodeDisplay = () => {
  const node = useContext(NodeContext);
  return (
    <div style={{
      backgroundColor: '#dc3545',
      color: 'white',
      borderRadius: '50%',
      width: '70px',
      height: '70px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #b22c3a',
      fontWeight: 'bold',
      fontSize: '0.9rem'
    }}>
      {node.name}
    </div>
  );
};

// --- Gateway/Condition Node Component ---
export const ConditionNodeDisplay = () => {
  const node = useContext(NodeContext);
  return (
    <div style={{
      backgroundColor: '#ffc107',
      color: 'black',
      width: '90px',
      height: '90px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #d39e00',
      transform: 'rotate(45deg)', // This makes it a diamond
    }}>
      <span style={{ 
        transform: 'rotate(-45deg)', // Un-rotate the text
        display: 'block',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '0.9rem'
      }}>
        {node.name}
      </span>
    </div>
  );
};

// --- Task Node Component (Renamed from OtherNodeDisplay to TaskNodeDisplay) ---
export const TaskNodeDisplay = () => {
  const node = useContext(NodeContext);
  return (
    <div style={{
      backgroundColor: 'white',
      color: 'black',
      border: '2px solid #007bff',
      borderRadius: '8px',
      padding: '10px 15px',
      width: '200px',
      textAlign: 'left'
    }}>
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
        {node.name}
      </div>
      <div style={{ fontSize: '0.8rem', paddingTop: '5px', color: '#555' }}>
        {/* We store our old data in the 'data' field */}
        {node.data?.description || 'Click to edit...'} 
      </div>
    </div>
  );
};