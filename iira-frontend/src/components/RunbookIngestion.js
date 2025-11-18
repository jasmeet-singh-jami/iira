// src/components/RunbookIngestion.js
import React, { useState, useRef } from 'react';
import { Wand2, FileText, Plus, Save, RotateCcw, AlertCircle, Loader2, BrainCircuit } from 'lucide-react';

// --- We are using your existing API services ---
import { parseSOPApi, uploadSOPApi } from '../services/apis'; 

// --- This is your friend's WorkflowNode component ---
const WorkflowNode = ({ node, onUpdate, onDelete, isSelected, onClick }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title);
  const [editDescription, setEditDescription] = useState(node.description || '');

  const handleSave = () => {
    onUpdate(node.id, { title: editTitle, description: editDescription });
    setIsEditing(false);
  };

  const getNodeColor = () => {
    switch (node.type) {
      case 'start': return 'bg-green-500';
      case 'end': return 'bg-red-500';
      case 'condition': return 'bg-yellow-500';
      case 'action': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div
      className={`absolute cursor-pointer transition-all ${isSelected ? 'ring-4 ring-purple-400' : ''}`}
      style={{ left: node.x, top: node.y }}
      onClick={() => onClick(node.id)}
    >
      {isEditing ? (
        <div className="bg-white p-4 rounded-lg shadow-xl w-80 border-2 border-blue-500 z-10 relative">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full p-2 border rounded mb-2 font-semibold"
            placeholder="Node title"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full p-2 border rounded mb-2 text-sm"
            rows="3"
            placeholder="Description"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 bg-blue-500 text-white px-3 py-1 rounded text-sm">
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-300 px-3 py-1 rounded text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={`${getNodeColor()} text-white p-4 rounded-lg shadow-lg min-w-48 max-w-64`}>
          <div className="font-semibold mb-1">{node.title}</div>
          {node.description && (
            <div className="text-xs opacity-90 mb-2">{node.description}</div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded hover:bg-opacity-30"
            >
              Edit
            </button>
            {node.type !== 'start' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                className="text-xs bg-red-600 bg-opacity-70 px-2 py-1 rounded hover:bg-opacity-90"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// --- This is your friend's App component, renamed to RunbookIngestion ---
// It's modified to call your APIs.
export default function RunbookIngestion({
    // We get these props from the 'real' App.js
    title,
    setTitle,
    issue,
    setIssue,
    tags,
    setTags,
    resetRunbookSteps, // This is your 'reset' function from App.js
}) {
  const [sopText, setSopText] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // --- MODIFIED FUNCTION ---
  // This now calls your existing FastAPI backend via apis.js
  const handleParseDocument = async () => {
    if (!sopText.trim()) {
      setError('Please enter an SOP document');
      return;
    }
    setLoading(true);
    setError('');
    try {
        // We call your existing API
        const parsedWorkflow = await parseSOPApi(sopText);
        
        // --- IMPORTANT ---
        // Your backend must return the JSON structure this frontend expects.
        // See Step 2 below.
        if (!parsedWorkflow.nodes || !parsedWorkflow.connections) {
            throw new Error("Invalid workflow structure received from API.");
        }

        setWorkflow(parsedWorkflow);
        // Sync the title from the parsed data
        setTitle(parsedWorkflow.title || 'Untitled'); 
        setIssue(parsedWorkflow.issue || ''); // We can't get this from the new format, but we'll try
        setError('');
    } catch (err) {
      setError(`Failed to parse SOP: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- MODIFIED FUNCTION ---
  // This is your "Generate Agent" button
  const handleGenerateRunbook = async () => {
     if (!sopText.trim()) {
      setError('Please enter a problem description');
      return;
    }
    setLoading(true);
    setError('');
    try {
        // We call your existing API.
        // NOTE: This assumes `generateSOPApi` is also updated 
        // to return the new JSON workflow format.
        // For now, we'll just re-use `parseSOPApi`.
        const parsedWorkflow = await parseSOPApi(sopText);

        if (!parsedWorkflow.nodes || !parsedWorkflow.connections) {
            throw new Error("Invalid workflow structure received from API.");
        }
        
        setWorkflow(parsedWorkflow);
        setTitle(parsedWorkflow.title || 'Untitled');
        setIssue(parsedWorkflow.issue || '');
        setError('');
    } catch (err) {
      setError(`Failed to generate SOP: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW FUNCTION ---
  // This function adds the example text to the textarea
  const draftAgent = () => {
    setSopText(`Apache Server Not Responding

Users are unable to access websites hosted on Apache due to the server not responding. This SOP aims to resolve this issue by restarting the Apache service and verifying its successful restart. The purpose of this SOP is to ensure that critical files in the Apache config do not have pending changes, which could affect the stability of the server.

Steps:
1. Check if Apache service is running
2. If not running, check Apache configuration files for errors
3. If configuration is valid, restart Apache service
4. Verify Apache is responding to requests
5. If still not responding, check system resources and logs
6. Escalate to senior administrator if issue persists`);
  };

  // Add new node (from friend's code)
  const addNode = (type) => {
    if (!workflow) return;
    const newNode = {
      id: `node-${Date.now()}`,
      type: type,
      title: type === 'condition' ? 'New Condition' : 'New Step',
      description: '',
      x: 400,
      y: workflow.nodes.length * 120 + 50
    };
    setWorkflow({ ...workflow, nodes: [...workflow.nodes, newNode] });
  };

  // Update node (from friend's code)
  const updateNode = (nodeId, updates) => {
    setWorkflow({
      ...workflow,
      nodes: workflow.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    });
  };

  // Delete node (from friend's code)
  const deleteNode = (nodeId) => {
    setWorkflow({
      ...workflow,
      nodes: workflow.nodes.filter(n => n.id !== nodeId),
      connections: workflow.connections.filter(c => c.from !== nodeId && c.to !== nodeId)
    });
  };

  // --- MODIFIED FUNCTION ---
  // This calls your existing uploadSOPApi
  const saveWorkflow = async () => {
    // 1. We must transform the new workflow format back into the
    // simple 'steps' array your backend API expects.
    const steps = workflow.nodes
        .filter(n => n.type === 'action') // Only "action" nodes are steps
        .map(n => ({
            description: n.description || n.title,
            script: n.data?.script || null, // Assuming you add this in the editor
            script_id: n.data?.script_id || null
        }));

    const sopPayload = {
        title: title,
        issue: issue,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        steps: steps
    };

    try {
        await uploadSOPApi(sopPayload); // This is your existing API call
        alert('Agent saved successfully!');
        reset(); // Call the reset function from App.js
    } catch (err) {
        setError(`Failed to save workflow: ${err.message}`);
    }
  };

  // --- MODIFIED FUNCTION ---
  // This calls your reset function from App.js
  const reset = () => {
    setSopText('');
    setWorkflow(null);
    setSelectedNode(null);
    setError('');
    // This prop comes from App.js and resets the parent state
    resetRunbookSteps(); 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-800">Onboard New Agent</h1>
          <p className="mt-1 text-gray-500">Create a new automated workflow using AI or by parsing an existing document.</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Form
        </button>
      </div>

      {!workflow ? (
        /* SOP Input Section */
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <div className="flex items-center gap-3 mb-6">
            <Wand2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">AI-Powered Agent Onboarding</h2>
          </div>
          <p className="text-slate-600 mb-6">
            Enter a problem description to generate a new Agent, or paste an existing document to parse it.
          </p>

          <textarea
            value={sopText}
            onChange={(e) => setSopText(e.target.value)}
            placeholder="Describe the problem you want to solve (e.g., 'A web server is down and needs to be restarted') OR paste in a full, pre-written Agent document..."
            className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-4 mt-6">
             <button
              onClick={draftAgent}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
            >
              <Wand2 className="w-5 h-5" />
              Load Example Text
            </button>
            <button
              onClick={handleGenerateRunbook}
              disabled={loading || !sopText.trim()}
              className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${loading ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 text-white shadow-lg hover:bg-purple-700'}`}
            >
              {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <BrainCircuit size={20} className="mr-2" />}
              {loading ? 'Drafting...' : 'Draft Agent with AI'}
            </button>
            <button
              onClick={handleParseDocument}
              disabled={loading || !sopText.trim()}
              className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}
            >
              {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <FileText size={20} className="mr-2" />}
              {loading ? 'Parsing...' : 'Parse Existing Agent'}
            </button>
          </div>
        </div>
      ) : (
        /* Workflow Editor */
        <div className="space-y-4">
          {/* This part now uses your 'title', 'issue', 'tags' state from App.js */}
          <div className="space-y-4 mb-6">
             <input
                type="text"
                placeholder="Agent Title"
                value={title} // From App.js
                onChange={e => setTitle(e.target.value)} // From App.js
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
             />
             <textarea
                placeholder="Issue Description"
                value={issue} // From App.js
                onChange={e => setIssue(e.target.value)} // From App.js
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-y h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
             />
             <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={tags} // From App.js
                onChange={e => setTags(e.target.value)} // From App.js
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
             />
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">Workflow Editor</h2>
            <div className="flex gap-3">
              <button
                onClick={() => addNode('action')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
              <button
                onClick={() => addNode('condition')}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>
              <button
                onClick={saveWorkflow}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                Save Agent
              </button>
            </div>
          </div>

          {/* Workflow Canvas */}
          <div className="bg-white rounded-lg shadow-sm border overflow-auto" style={{ height: '600px' }}>
            <div ref={canvasRef} className="relative" style={{ width: '100%', minHeight: '100%' }}>
              {/* Render connections */}
              <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                {workflow.connections.map((conn, idx) => {
                  const fromNode = workflow.nodes.find(n => n.id === conn.from);
                  const toNode = workflow.nodes.find(n => n.id === conn.to);
                  if (!fromNode || !toNode) return null;

                  // Simple straight line logic
                  const x1 = fromNode.x + 96; // center of node
                  const y1 = fromNode.y + 70; // bottom of node
                  const x2 = toNode.x + 96; // center of node
                  const y2 = toNode.y; // top of node

                  return (
                    <g key={idx}>
                      <line
                        x1={x1} y1={y1}
                        x2={x2} y2={y2}
                        stroke="#94a3b8" strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                      {conn.label && (
                        <text
                          x={(x1 + x2) / 2} y={(y1 + y2) / 2}
                          fill="#475569" fontSize="12" fontWeight="600"
                          textAnchor="middle"
                        >
                          {conn.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>

              {/* Render nodes */}
              {workflow.nodes.map(node => (
                <WorkflowNode
                  key={node.id}
                  node={node}
                  onUpdate={updateNode}
                  onDelete={deleteNode}
                  isSelected={selectedNode === node.id}
                  onClick={setSelectedNode}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}