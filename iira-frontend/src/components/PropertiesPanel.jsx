// iira-frontend/src/components/PropertiesPanel.jsx
import React from 'react';
// We don't need any special imports from react-flow-builder here

// --- THIS IS THE FIX ---
// The component receives 'node' and 'onChange' directly as props
// from FlowBuilder when it's registered as a 'configComponent'.
// We also receive 'availableScripts' which we passed in via 'props'
// in WorkflowBuilder.jsx
const PropertiesPanel = ({ node, onChange, availableScripts = [] }) => {
  // --- END OF FIX ---

  // Handler to update a node's data
  const handleChange = (field, value) => {
    // We update the 'data' property of the node
    const newNode = {
      ...node,
      data: {
        ...node.data,
        [field]: value,
      },
    };

    // For a task, we also update the node's 'name'
    if (field === 'description') {
        newNode.name = value.substring(0, 30) || 'Task';
    }

    onChange(newNode);
  };

  // Handler for the script dropdown
  const handleScriptChange = (e) => {
    const scriptId = e.target.value;
    const selectedScript = availableScripts.find(s => String(s.id) === scriptId);

    const newNode = {
      ...node,
      data: {
        ...node.data,
        script_id: scriptId ? parseInt(scriptId, 10) : null,
        script: selectedScript ? selectedScript.name : null,
      },
    };
    onChange(newNode);
  };

  if (!node) {
    return <div className="p-4 text-gray-500">Select a node to edit its properties.</div>;
  }

  // We only show this form for 'Task' nodes (type: 'node')
  if (node.type !== 'node') {
     return <div className="p-4 text-gray-500">Select a Task node to edit its description and script.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Step Description
        </label>
        <textarea
          id="description"
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          value={node.data?.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="script" className="block text-sm font-medium text-gray-700">
          Associated Script
        </label>
        <select
          id="script"
          className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          value={node.data?.script_id || ''}
          onChange={handleScriptChange}
        >
          <option value="">No Script (Manual Step)</option>
          {availableScripts.map((script) => (
            <option key={script.id} value={script.id}>
              {script.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PropertiesPanel;