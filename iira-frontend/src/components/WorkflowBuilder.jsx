// iira-frontend/src/components/WorkflowBuilder.jsx
import React from 'react';
import FlowBuilder from 'react-flow-builder';

// Import our node display components
import {
  StartNodeDisplay,
  EndNodeDisplay,
  ConditionNodeDisplay,
  TaskNodeDisplay
} from './custom-nodes/WorkflowNodes';

// --- 1. Import our new editing panel ---
import PropertiesPanel from './PropertiesPanel';

// Register all our node types with the builder
const registerNodes = [
  { type: 'start', name: 'Start', displayComponent: StartNodeDisplay, isStart: true },
  { type: 'end', name: 'End', displayComponent: EndNodeDisplay, isEnd: true },
  { type: 'condition', name: 'Gateway', displayComponent: ConditionNodeDisplay },
  { type: 'node', name: 'Task', displayComponent: TaskNodeDisplay },
];

// This component receives props from RunbookIngestion.js
const WorkflowBuilder = (props) => {
  
  const { 
    initialSteps,     
    onStepsChange,    
    onSave,
    availableScripts // <-- 2. Receive availableScripts prop
  } = props;

  // --- 3. Define the props for our registered nodes ---
  // This tells FlowBuilder to use PropertiesPanel for the 'node' type
  const registerNodeProps = {
    // All node types can be deleted
    all: {
      deletable: true,
    },
    // The 'node' (Task) type gets our special editor
    node: {
      // 'configComponent' is the component for the properties panel
      configComponent: PropertiesPanel,
      // We pass 'availableScripts' as a prop to PropertiesPanel
      props: {
        availableScripts: availableScripts,
      }
    },
    // The 'condition' (Gateway) type can be deleted, but no special config
    condition: {
      deletable: true,
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px' }}>
      <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingBottom: '10px',
          borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
        >
          Save Agent
        </button>
      </div>
      <div style={{ height: '600px', width: '100%' }}>
        <FlowBuilder
          nodes={initialSteps}      
          onChange={onStepsChange}  
          registerNodes={registerNodes} 
          
          // --- 4. Pass the new props to the builder ---
          registerNodeProps={registerNodeProps}
          // This ensures the zoom/fit/etc. toolbar is visible
          showToolbar={true} 
        />
      </div>
    </div>
  );
};

export default WorkflowBuilder;