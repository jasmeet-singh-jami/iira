import '@xyflow/react/dist/style.css';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    MarkerType,
    useReactFlow,
    ReactFlowProvider,
    Panel,
} from '@xyflow/react';

import dagre from 'dagre'; // Helper for auto-layout
import { Plus, GitBranch, Save, Layout } from 'lucide-react';

// Custom Nodes
import StepNode from './custom-nodes/StepNode';
import DecisionNode from './custom-nodes/DecisionNode';
import PropertiesPanel from './PropertiesPanel';

const nodeTypes = {
    stepNode: StepNode,
    decisionNode: DecisionNode,
};

// --- Auto Layout Helper Function ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        // Approximate width/height for layout calculation
        dagreGraph.setNode(node.id, { width: 200, height: 100 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            // Shift slightly to center the node
            position: {
                x: nodeWithPosition.x - 100,
                y: nodeWithPosition.y - 50,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

const WorkflowBuilder = ({
    initialSteps,
    availableScripts,
    onStepsChange,
    onSave,
    onAddNewScript,
    onRematchStep,
    onCreateScript,
    onDeleteStep,
    setConfirmationModal
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const reactFlowWrapper = useRef(null);
    const { fitView, getViewport } = useReactFlow();

    // --- 1. Handle Connections (Manual Linking) ---
    const onConnect = useCallback(
        (params) => {
            let edgeColor = '#6b7280'; // Default Gray
            
            // Color code edges coming from Decision Nodes
            if (params.sourceHandle === 'true') edgeColor = '#10b981'; // Green
            if (params.sourceHandle === 'false') edgeColor = '#ef4444'; // Red

            const newEdge = {
                ...params,
                type: 'default', // or 'smoothstep' for cleaner lines
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                style: { stroke: edgeColor, strokeWidth: 2 },
            };
            setEdges((eds) => addEdge(newEdge, eds));
        },
        [setEdges],
    );

    // --- 2. Handle Node Deletion ---
    const onNodesDelete = useCallback(
        (deletedNodes) => {
            deletedNodes.forEach((node) => {
                // If it's a sequential step linked to the original data index, notify parent
                if (node.type === 'stepNode' && typeof node.data.index === 'number') {
                    onDeleteStep(node.data.index);
                }
            });
        },
        [onDeleteStep]
    );

    // --- 3. Transform Initial Data to Graph (Run Once or on Reset) ---
    useEffect(() => {
        if (!initialSteps || initialSteps.length === 0) return;

        const initialNodes = [];
        const initialEdges = [];

        // Create Start Node
        initialNodes.push({
            id: 'start',
            type: 'input',
            data: { label: 'Start' },
            position: { x: 0, y: 0 },
        });

        // Convert Linear Steps to Nodes
        initialSteps.forEach((step, index) => {
            initialNodes.push({
                id: `step-${index}`,
                type: 'stepNode',
                data: { ...step, index }, // Pass all step data
                position: { x: 0, y: 0 }, // Position handled by dagre later
            });
        });

        // Create End Node
        initialNodes.push({
            id: 'end',
            type: 'output',
            data: { label: 'End' },
            position: { x: 0, y: 0 },
        });

        // Create Default Sequential Edges (Linear Flow)
        initialEdges.push({ id: 'e-start-0', source: 'start', target: 'step-0', type: 'default' });

        for (let i = 0; i < initialSteps.length - 1; i++) {
            initialEdges.push({
                id: `e-${i}-${i + 1}`,
                source: `step-${i}`,
                target: `step-${i + 1}`,
                type: 'default',
                markerEnd: { type: MarkerType.ArrowClosed },
            });
        }

        initialEdges.push({
            id: `e-${initialSteps.length - 1}-end`,
            source: `step-${initialSteps.length - 1}`,
            target: 'end',
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed },
        });

        // Apply Auto Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        setTimeout(() => fitView(), 100);

    }, [initialSteps, setNodes, setEdges, fitView]);


    // --- 4. Interactions ---
    const onNodeClick = useCallback((event, node) => {
        // Only show properties for configurable nodes
        if (node.type === 'stepNode' || node.type === 'decisionNode') {
            setSelectedNodeId(node.id);
        } else {
            setSelectedNodeId(null);
        }
    }, []);

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges
        );
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        fitView({ duration: 400 });
    }, [nodes, edges, setNodes, setEdges, fitView]);

    const handleUpdateStep = useCallback((updatedStepData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNodeId) {
                    // Update internal node data
                    return { ...node, data: { ...node.data, ...updatedStepData } };
                }
                return node;
            })
        );
        
        // Notify parent if strictly needed (optional depending on your save logic)
        // const newSteps = ... reconstruct linear array if needed
        // onStepsChange(newSteps); 
    }, [selectedNodeId, setNodes]);

    const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

    // --- 5. Add New Nodes ---
    const addNode = useCallback((type) => {
        const viewport = getViewport();
        // Randomize slightly so they don't stack perfectly on top of each other
        const x = -viewport.x / viewport.zoom + (Math.random() * 100 + 100);
        const y = -viewport.y / viewport.zoom + (Math.random() * 100 + 100);

        const newNode = {
            id: `${type}-${Date.now()}`,
            type: type,
            position: { x, y },
            data: { 
                label: type === 'stepNode' ? 'New Step' : 'Check Condition',
                description: 'Describe task...'
            },
        };

        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, getViewport]);


    return (
        <div className="flex h-[75vh] border rounded-lg overflow-hidden bg-gray-50">
            <div className="flex-grow relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onNodesDelete={onNodesDelete}
                    onPaneClick={() => setSelectedNodeId(null)}
                    nodeTypes={nodeTypes}
                    fitView
                >
                    <Controls />
                    <Background color="#aaa" gap={16} />
                    
                    {/* Floating Toolbar */}
                    <Panel position="top-left" className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 flex gap-2">
                        <button
                            onClick={() => addNode('stepNode')}
                            className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition text-sm font-medium"
                        >
                            <Plus size={16} className="mr-1" /> Step
                        </button>
                        <button
                            onClick={() => addNode('decisionNode')}
                            className="flex items-center px-3 py-1.5 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-md transition text-sm font-medium"
                        >
                            <GitBranch size={16} className="mr-1" /> Decision
                        </button>
                        <div className="w-px bg-gray-300 mx-1"></div>
                        <button
                            onClick={onLayout}
                            className="flex items-center px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-md transition text-sm font-medium"
                            title="Auto Arrange"
                        >
                            <Layout size={16} className="mr-1" /> Arrange
                        </button>
                    </Panel>

                    <Panel position="top-right">
                        <button
                            onClick={onSave}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md rounded-md transition font-semibold"
                        >
                            <Save size={18} className="mr-2" /> Save Workflow
                        </button>
                    </Panel>
                </ReactFlow>
            </div>

            {/* Properties Sidebar */}
            {selectedNode && (
                <div className="w-96 border-l border-gray-200 bg-white shadow-xl z-10 overflow-y-auto">
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
                </div>
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