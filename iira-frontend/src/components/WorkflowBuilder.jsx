import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    MarkerType,
    getBezierPath, // Import path function
    BaseEdge,      // Import BaseEdge for custom edge
    EdgeLabelRenderer, // To render label/button on edge
    useReactFlow,   // Hook to access reactflow instance
    ReactFlowProvider, // Import Provider
} from 'reactflow';
import 'reactflow/dist/style.css';
import StepNode from './custom-nodes/StepNode';
import PropertiesPanel from './PropertiesPanel';
import { Plus } from 'lucide-react'; // Import Plus icon

const nodeTypes = { stepNode: StepNode };

// --- Custom Edge with Insert Button ---
function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data, // We'll pass the onInsertStep function and sourceIndex here
}) {
    // Note: useReactFlow hook cannot be used directly inside the edge component
    // If complex interactions are needed, pass necessary functions via `data` prop.
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onEdgeClick = (event) => {
        event.stopPropagation(); // Prevent node selection when clicking button
        // Check if data and the function exist before calling
        if (data && typeof data.onInsertStep === 'function' && data.sourceIndex !== undefined) {
             console.log("CustomEdge attempting to call onInsertStep for index:", data.sourceIndex);
             data.onInsertStep(data.sourceIndex);
        } else {
             // Log more details if the function is missing
             console.error("CustomEdge Error: Missing data for insert.", { dataExists: !!data, onInsertStepType: typeof data?.onInsertStep, sourceIndex: data?.sourceIndex });
        }
    };

    // Don't show insert button for the edge going into the 'End' node
    const isEdgeToEndNode = data?.targetId === 'end';

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} id={id} />
            {/* Conditionally render the button only if not connected to the 'end' node */}
            {!isEdgeToEndNode && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all', // Make the button clickable
                        }}
                        className="nodrag nopan absolute z-10" // Ensure button is above edge
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
// --- END Custom Edge ---

// Define edge types map
const edgeTypes = {
    custom: CustomEdge,
};


const WorkflowBuilder = ({
    initialSteps,
    availableScripts,
    onStepsChange,
    onSave,
    onAddNewScript,
    onRematchStep,
    onCreateScript,
    onAddStep,
    onDeleteStep, // <<< RECEIVE PROP
    onInsertStep, // <<< RECEIVE PROP
    setConfirmationModal // <<< RECEIVE PROP
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const reactFlowWrapper = useRef(null);
    const { fitView } = useReactFlow();

    // <<< ADDED DEBUG LOG >>>
    console.log("WorkflowBuilder rendering or received props. Type of onInsertStep:", typeof onInsertStep);

    // Recalculate Nodes and Edges when initialSteps changes
    useEffect(() => {
        // <<< ADDED DEBUG LOG INSIDE EFFECT >>>
        console.log("WorkflowBuilder useEffect for initialSteps running. Type of onInsertStep:", typeof onInsertStep);
        if (typeof onInsertStep !== 'function') {
            console.error("!!! onInsertStep is NOT a function inside useEffect !!!");
        }

        const yPos = (index) => 100 + index * 150;
        const xPos = 150;

        const stepNodes = initialSteps.map((step, index) => ({
            id: `step-${index}`, type: 'stepNode', data: { ...step, index }, position: { x: xPos, y: yPos(index) },
        }));

        const startNode = { id: 'start', type: 'input', data: { label: 'Start' }, position: { x: xPos + 100, y: 0 }, deletable: false, draggable: false };
        const endNode = { id: 'end', type: 'output', data: { label: 'End' }, position: { x: xPos + 100, y: yPos(initialSteps.length) }, deletable: false, draggable: false };

        const allNodes = [startNode, ...stepNodes, endNode];

        // --- Recalculate Edges: Pass onInsertStep correctly ---
        const newEdges = [];
        const edgeStyle = { stroke: '#6b7280', strokeWidth: 2 };
        const markerEnd = { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6b7280'};

        // --- Helper function to create edge data ---
        const createEdgeData = (index, targetId) => {
            // Log right before creating the data object
            console.log(`Creating edge data for index ${index}. typeof onInsertStep:`, typeof onInsertStep);
            return {
                onInsertStep: onInsertStep, // Use the onInsertStep from the useEffect's scope
                sourceIndex: index,
                targetId: targetId
            };
        };

        if (stepNodes.length > 0) {
            newEdges.push({
                id: `e-start-step-0`, source: 'start', target: `step-0`, type: 'custom', animated: false, style: edgeStyle, markerEnd: markerEnd,
                data: createEdgeData(-1, 'step-0') // Use helper
            });
        } else {
             newEdges.push({
                id: `e-start-end`, source: 'start', target: `end`, type: 'custom', animated: false, style: edgeStyle, markerEnd: markerEnd,
                data: createEdgeData(-1, 'end') // Use helper
            });
        }

        for (let i = 0; i < stepNodes.length - 1; i++) {
            newEdges.push({
                id: `e-step-${i}-step-${i + 1}`, source: `step-${i}`, target: `step-${i + 1}`, type: 'custom', animated: false, style: edgeStyle, markerEnd: markerEnd,
                data: createEdgeData(i, `step-${i + 1}`) // Use helper
            });
        }

        if (stepNodes.length > 0) {
            newEdges.push({
                id: `e-step-${stepNodes.length - 1}-end`, source: `step-${stepNodes.length - 1}`, target: 'end', type: 'custom', animated: false, style: edgeStyle, markerEnd: markerEnd,
                data: createEdgeData(stepNodes.length - 1, 'end') // Use helper
            });
        }
        // --- End Edge Recalculation ---

        setNodes(allNodes);
        setEdges(newEdges);

        if (selectedNodeId && !allNodes.find(n => n.id === selectedNodeId)) {
            setSelectedNodeId(null);
        }

        setTimeout(() => { fitView({ padding: 0.2, duration: 300 }); }, 50);

    // Make sure onInsertStep is in the dependency array
    }, [initialSteps, setNodes, setEdges, onInsertStep, selectedNodeId, fitView]);


    const onNodeClick = useCallback((event, node) => {
         event.stopPropagation();
        if (node.type === 'stepNode') {
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
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    deleteKeyCode={null}
                >
                    <Controls />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>

                 <button
                    onClick={onAddStep}
                    className="absolute top-4 left-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition flex items-center focus:outline-none focus:ring-2 focus:ring-green-400"
                    title="Add New Step to End"
                >
                    <Plus size={18} className="mr-2"/> Add Step
                </button>

                <button
                    onClick={onSave}
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
                    onUpdate={handleUpdateStep}
                    onClose={() => setSelectedNodeId(null)}
                    onAddNewScript={onAddNewScript}
                    onRematchStep={onRematchStep}
                    onCreateScript={onCreateScript}
                    onDeleteStep={onDeleteStep} // <<< PASS PROP DOWN
                    setConfirmationModal={setConfirmationModal} // <<< PASS PROP DOWN
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

export default WorkflowBuilderWrapper; // Export the wrapper

