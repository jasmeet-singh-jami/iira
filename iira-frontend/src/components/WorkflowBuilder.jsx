import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    ReactFlow, // <--- NAME CHANGED in v12 (was default export in v11)
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    MarkerType,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react'; // <--- UPDATED IMPORT
import '@xyflow/react/dist/style.css'; // <--- UPDATED CSS

import StepNode from './custom-nodes/StepNode';
import DecisionNode from './custom-nodes/DecisionNode'; 
import PropertiesPanel from './PropertiesPanel';
import { Plus, GitBranch } from 'lucide-react'; 

const nodeTypes = { 
    stepNode: StepNode,
    decisionNode: DecisionNode 
};

const edgeTypes = {};

const WorkflowBuilder = ({
    initialSteps,
    availableScripts,
    onStepsChange,
    onSave,
    onAddNewScript,
    onRematchStep,
    onCreateScript,
    onAddStep,
    onDeleteStep,
    onInsertStep,
    setConfirmationModal
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const reactFlowWrapper = useRef(null);
    const { fitView, getViewport } = useReactFlow();

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ 
            ...params, 
            type: 'default', 
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6b7280' },
            style: { stroke: '#6b7280', strokeWidth: 2 }
        }, eds)),
        [setEdges],
    );

    const onNodesDelete = useCallback(
        (deletedNodes) => {
            deletedNodes.forEach(node => {
                if (node.type === 'stepNode' && node.data.index !== undefined) {
                    onDeleteStep(node.data.index);
                }
            });
            setEdges((eds) => deletedNodes.reduce((acc, node) => acc.filter(edge => edge.source !== node.id && edge.target !== node.id), eds));
        },
        [onDeleteStep, setEdges]
    );

    useEffect(() => {
        const existingNodeMap = new Map(nodes.map(n => [n.id, n]));
        const yPos = (index) => 150 + index * 150;
        const xPos = 200;

        const stepNodes = initialSteps.map((step, index) => {
             const id = `step-${index}`;
             const existing = existingNodeMap.get(id);
             return {
                 id: id, 
                 type: 'stepNode', 
                 data: { ...step, index }, 
                 position: existing ? existing.position : { x: xPos, y: yPos(index) },
                 deletable: true,
                 draggable: true, // Explicitly enable dragging
             }
         });

        const startNode = { 
            id: 'start', type: 'input', data: { label: 'Start' }, 
            position: existingNodeMap.get('start')?.position || { x: xPos + 50, y: 0 }, 
            deletable: false, draggable: false 
        };
        const endNode = { 
            id: 'end', type: 'output', data: { label: 'End' }, 
            position: existingNodeMap.get('end')?.position || { x: xPos + 50, y: yPos(initialSteps.length + 3) }, 
            deletable: false, draggable: false 
        };

        // --- DEMO NODES ---
        const decisionNode = {
            id: 'decision-1',
            type: 'decisionNode', 
            data: { label: 'Is Service Up?' },
            position: existingNodeMap.get('decision-1')?.position || { x: xPos + 50, y: yPos(1) },
            deletable: true,
            draggable: true,
        };
        
        const joinNode = {
            id: 'join-1',
            type: 'stepNode',
            data: { 
                description: 'Joined execution path.', 
                script: 'merge_logs.sh', 
                index: initialSteps.length 
            },
            position: existingNodeMap.get('join-1')?.position || { x: xPos + 150, y: yPos(initialSteps.length + 1) },
            deletable: true,
            draggable: true,
        };

        const demoNode = stepNodes.length > 0 ? stepNodes[0] : { 
            id: 'step-0', 
            type: 'stepNode', 
            data: { description: 'Placeholder Step', index: 0 }, 
            position: { x: xPos - 50, y: yPos(2) } 
        };

        const defaultEdgeProps = { 
            type: 'default', 
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6b7280' }, 
            style: { stroke: '#6b7280', strokeWidth: 2 } 
        };

        const autoEdges = [];
        autoEdges.push({ id: 'e-start-decision', source: 'start', target: 'decision-1', ...defaultEdgeProps });
        autoEdges.push({ id: 'e-decision-step-true', source: 'decision-1', target: demoNode.id, sourceHandle: 'b', ...defaultEdgeProps, style: { ...defaultEdgeProps.style, stroke: '#10b981' } });
        autoEdges.push({ id: 'e-decision-join-false', source: 'decision-1', target: 'join-1', sourceHandle: 'a', ...defaultEdgeProps, style: { ...defaultEdgeProps.style, stroke: '#ef4444' } });
        autoEdges.push({ id: 'e-step-join', source: demoNode.id, target: 'join-1', ...defaultEdgeProps });
        autoEdges.push({ id: 'e-join-end', source: 'join-1', target: 'end', ...defaultEdgeProps });
        
        const allNodes = [startNode, endNode, decisionNode, joinNode, demoNode, ...stepNodes.slice(stepNodes.length > 0 ? 1 : 0)];

        setNodes(allNodes);
        setEdges(autoEdges);

        if (selectedNodeId && !allNodes.find(n => n.id === selectedNodeId)) {
            setSelectedNodeId(null);
        }

        if (nodes.length === 0 || initialSteps.length > 0) {
             setTimeout(() => { fitView({ padding: 0.2, duration: 300 }); }, 50);
        }

    }, [initialSteps, setNodes, setEdges, selectedNodeId, fitView, nodes.length]); 

    const onNodeClick = useCallback((event, node) => {
        event.stopPropagation(); // Important for selection
        if (node.type === 'stepNode' || node.type === 'decisionNode') { 
            setSelectedNodeId(node.id);
        } else {
            setSelectedNodeId(null);
        }
    }, []);

    const handleUpdateStep = useCallback((updatedStepData) => {
        const newSteps = initialSteps.map((step, index) => {
             if (`step-${index}` === selectedNodeId) {
                 return { ...step, ...updatedStepData };
             }
             return step;
         });
         onStepsChange(newSteps);
    }, [selectedNodeId, initialSteps, onStepsChange]);

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

    const addNode = useCallback((type) => {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const viewport = getViewport();
        const x = (reactFlowBounds.width / 2 - viewport.x) / viewport.zoom;
        const y = (reactFlowBounds.height / 2 - viewport.y) / viewport.zoom;
        
        const newNode = {
            id: `${type}-${Date.now()}`,
            type: type,
            position: { x, y },
            data: { label: type === 'stepNode' ? 'New Step' : 'New Decision' },
            deletable: true,
            draggable: true,
        };
        
        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, getViewport]);

    const handleAddStepClick = useCallback(() => addNode('stepNode'), [addNode]);
    const handleAddDecisionClick = useCallback(() => addNode('decisionNode'), [addNode]);

    return (
        <div className="flex h-[70vh] border rounded-lg overflow-hidden">
            <div className="flex-grow relative bg-gray-100" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    onPaneClick={() => setSelectedNodeId(null)}
                    onConnect={onConnect} 
                    onNodesDelete={onNodesDelete}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    minZoom={0.1} // Ensure zoom limits aren't locking it
                    maxZoom={4}
                >
                    <Controls />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>

                <div className="absolute top-4 left-4 flex space-x-3">
                    <button onClick={handleAddStepClick} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition flex items-center focus:outline-none focus:ring-2 focus:ring-green-400" title="Add New Sequential Step">
                        <Plus size={18} className="mr-2"/> Add Step
                    </button>
                     <button onClick={handleAddDecisionClick} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition flex items-center focus:outline-none focus:ring-2 focus:ring-red-400" title="Add Conditional/Decision Node (Fork)">
                        <GitBranch size={18} className="mr-2"/> Add Decision
                    </button>
                </div>

                <button onClick={onSave} className="absolute top-4 right-4 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400">
                    Save Agent
                </button>
            </div>
            {selectedNode && (
                <PropertiesPanel
                    key={selectedNode.id}
                    nodeData={selectedNode.data}
                    availableScripts={availableScripts}
                    onUpdate={handleUpdateStep}
                    onClose={() => setSelectedNodeId(null)}
                    onAddNewScript={onAddNewScript}
                    onRematchStep={onRematchStep}
                    onCreateScript={onCreateScript}
                    onDeleteStep={onDeleteStep} 
                    setConfirmationModal={setConfirmationModal} 
                />
            )}
        </div>
    );
};

const WorkflowBuilderWrapper = (props) => (
    <ReactFlowProvider>
        <WorkflowBuilder {...props} />
    </ReactFlowProvider>
);

export default WorkflowBuilderWrapper;