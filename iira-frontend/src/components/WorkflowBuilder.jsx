import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MarkerType,
    getBezierPath,
    BaseEdge,
    EdgeLabelRenderer,
    useReactFlow,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre'; 

import StepNode from './custom-nodes/StepNode';
import DecisionNode from './custom-nodes/DecisionNode';
import PropertiesPanel from './PropertiesPanel';
import { Plus } from 'lucide-react'; 

const nodeTypes = { stepNode: StepNode, decisionNode: DecisionNode };

// --- Dagre Utility Function for Layout ---
const nodeWidth = 250; 
const nodeHeight = 100; 

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { 
            width: node.data.width || nodeWidth, 
            height: node.data.height || nodeHeight 
        });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 1 }); 
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithLayout = dagreGraph.node(node.id);
        
        node.position = {
            x: nodeWithLayout.x - (node.data.width || nodeWidth) / 2,
            y: nodeWithLayout.y - (node.data.height || nodeHeight) / 2,
        };

        if (node.id === 'start' || node.id === 'end') {
            node.draggable = false;
        } else {
            node.draggable = true;
        }

        return node;
    });

    return { layoutedNodes, layoutedEdges: edges };
};

// --- Helper: Reconstruct Backend Graph from Visual Nodes/Edges ---
const reconstructGraph = (nodes, edges) => {
    const nodesMap = {};
    let startNodeId = 'start'; 

    nodes.forEach(node => {
        // Extract backend data, ignoring visual props like width/height/label if redundant
        // We also explicitly remove the 'id' we injected into data so it doesn't duplicate in backend JSON
        const { label, width, height, id, ...backendData } = node.data; 
        
        const cleanNode = { ...backendData };
        
        // Normalize types
        if (node.type === 'stepNode') cleanNode.type = 'step';
        if (node.type === 'decisionNode') cleanNode.type = 'decision';
        if (node.type === 'input') { cleanNode.type = 'input'; startNodeId = node.id; }
        if (node.type === 'output') cleanNode.type = 'output';

        // Reset connections to be rebuilt from edges
        cleanNode.next = null;
        if (cleanNode.type === 'decision') cleanNode.paths = {};

        nodesMap[node.id] = cleanNode;
    });

    edges.forEach(edge => {
        const sourceNode = nodesMap[edge.source];
        if (!sourceNode) return;

        if (sourceNode.type === 'decision') {
            if (edge.sourceHandle) {
                // Ensure paths object exists
                if (!sourceNode.paths) sourceNode.paths = {};
                sourceNode.paths[edge.sourceHandle] = edge.target;
            }
        } else {
            sourceNode.next = edge.target;
        }
    });

    return { start_node_id: startNodeId, nodes: nodesMap };
};


// --- Custom Edge with Insert Button ---
function CustomEdge({
    id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data, 
}) {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    
    const isDecisionPath = data?.sourceHandle && data.sourceHandle !== 'input';
    const edgeLabel = isDecisionPath ? data.sourceHandle.toUpperCase() : null;
    const isEdgeToEndNode = data?.targetId === 'end';

    const onEdgeClick = (event) => {
        event.stopPropagation();
        if (data && typeof data.onInsertStep === 'function' && data.sourceId) { 
             data.onInsertStep(data.sourceId, data.sourceHandle);
        } else {
             console.error("CustomEdge Error: Missing data for insert.", data);
        }
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: isDecisionPath ? 3 : 2 }} id={id} />

            {edgeLabel && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'none',
                            fontSize: 10,
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: 4
                        }}
                        className="nodrag nopan"
                    >
                        {edgeLabel}
                    </div>
                </EdgeLabelRenderer>
            )}

            {!isEdgeToEndNode && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan absolute z-10"
                    >
                        <button
                            className="p-1 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 transition"
                            onClick={onEdgeClick}
                            title="Insert Step After This"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
             )}
        </>
    );
}

const edgeTypes = {
    custom: CustomEdge,
};


const buildFlowFromGraph = (graphData, onInsertStep) => {
    const { nodes: graphNodes, start_node_id } = graphData;
    const initialNodes = [];
    const initialEdges = [];
    const visited = new Set();
    const queue = [start_node_id];

    const edgeStyle = { stroke: '#6b7280', strokeWidth: 2 };
    const markerEnd = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6b7280'};

    const typeMap = {
        'input': { rfType: 'input', width: 100, height: 40 },
        'output': { rfType: 'output', width: 100, height: 40 },
        'step': { rfType: 'stepNode', width: nodeWidth, height: nodeHeight },
        'decision': { rfType: 'decisionNode', width: nodeWidth, height: nodeHeight },
    };

    while (queue.length > 0) {
        const sourceId = queue.shift();
        if (visited.has(sourceId)) continue;
        visited.add(sourceId);

        const sourceNodeData = graphNodes[sourceId];
        if (!sourceNodeData) continue;
        
        const typeInfo = typeMap[sourceNodeData.type] || typeMap['step'];
        
        const rfNode = {
            id: sourceId,
            type: typeInfo.rfType,
            data: { 
                ...sourceNodeData, 
                id: sourceId, // <<< CRITICAL FIX: Inject ID so PropertiesPanel can read it
                label: sourceNodeData.name || sourceId, 
                width: typeInfo.width, 
                height: typeInfo.height 
            },
            position: { x: 0, y: 0 }, 
            deletable: sourceNodeData.type !== 'input' && sourceNodeData.type !== 'output',
            draggable: true, 
        };
        initialNodes.push(rfNode);

        let connections = [];
        if (sourceNodeData.type === 'decision' && sourceNodeData.paths) {
            connections = Object.entries(sourceNodeData.paths).map(([handle, targetId]) => ({
                targetId,
                sourceHandle: handle 
            }));
        } else if (sourceNodeData.next) {
            connections.push({
                targetId: sourceNodeData.next,
                sourceHandle: null
            });
        }
        
        connections.forEach(({ targetId, sourceHandle }) => {
            if (targetId) {
                const edgeId = sourceHandle 
                    ? `e-${sourceId}-${sourceHandle}-${targetId}` 
                    : `e-${sourceId}-${targetId}`;

                initialEdges.push({
                    id: edgeId,
                    source: sourceId,
                    target: targetId,
                    sourceHandle: sourceHandle,
                    type: 'custom',
                    animated: false,
                    style: edgeStyle,
                    markerEnd: markerEnd,
                    data: { 
                        onInsertStep: onInsertStep,
                        sourceId: sourceId, 
                        targetId: targetId,
                        sourceHandle: sourceHandle
                    }
                });

                if (!visited.has(targetId)) {
                    queue.push(targetId);
                }
            }
        });
    }

    return { initialNodes, initialEdges };
}


const WorkflowBuilder = ({
    graphData,    
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
    const { fitView } = useReactFlow();

    // Recalculate Nodes and Edges when graphData changes
    useEffect(() => {
        if (!graphData || !graphData.nodes || !graphData.start_node_id) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const { initialNodes, initialEdges } = buildFlowFromGraph(graphData, onInsertStep);
        
        const { layoutedNodes, layoutedEdges } = getLayoutedElements(
            initialNodes, 
            initialEdges, 
            'TB' 
        );
        
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        if (selectedNodeId && !layoutedNodes.find(n => n.id === selectedNodeId)) {
            setSelectedNodeId(null);
        }

        setTimeout(() => { fitView({ padding: 0.2, duration: 300 }); }, 50);

    }, [graphData, setNodes, setEdges, onInsertStep, fitView]); 

    const onNodeClick = useCallback((event, node) => {
         event.stopPropagation();
        if (node.type === 'stepNode' || node.type === 'decisionNode') {
            setSelectedNodeId(node.id);
        } else {
            setSelectedNodeId(null);
        }
    }, []);

    const handleUpdateNode = useCallback((updatedData) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === selectedNodeId) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...updatedData
                    }
                };
            }
            return node;
        }));
    }, [selectedNodeId, setNodes]);

    // --- UPDATED: Save Logic ---
    const handleSave = () => {
        // Reconstruct valid graph data from current nodes and edges
        const currentGraphPayload = reconstructGraph(nodes, edges);
        
        // Pass the updated graph payload to parent onSave handler
        onSave(currentGraphPayload);
    };
    // ---------------------------

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

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
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    nodesDraggable={true} 
                    nodesConnectable={true} 
                    elementsSelectable={true}
                    deleteKeyCode={null}
                >
                    <Controls />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>

                 <button
                    onClick={onAddStep}
                    className="absolute top-4 left-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-600 transition flex items-center focus:outline-none focus:ring-2 focus:ring-green-400"
                    title="Add New Step to End"
                >
                    <Plus size={18} className="mr-2"/> Add Step
                </button>

                <button
                    onClick={handleSave} // <<< Call new handler
                    className="absolute top-4 right-4 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                    Save Agent
                </button>
            </div>
            {selectedNode && (
                <PropertiesPanel
                    key={selectedNode.id}
                    nodeData={selectedNode.data}
                    availableScripts={availableScripts}
                    onUpdate={handleUpdateNode}
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

// Wrap WorkflowBuilder with ReactFlowProvider to use hooks like useReactFlow
const WorkflowBuilderWrapper = (props) => (
    <ReactFlowProvider>
        <WorkflowBuilder {...props} />
    </ReactFlowProvider>
);

export default WorkflowBuilderWrapper;