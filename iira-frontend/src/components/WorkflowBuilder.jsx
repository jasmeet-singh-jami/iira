// src/components/WorkflowBuilder.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background
} from 'reactflow';
import 'reactflow/dist/style.css';
import StepNode from './custom-nodes/StepNode';
import PropertiesPanel from './PropertiesPanel';

const nodeTypes = { stepNode: StepNode };

const WorkflowBuilder = ({
    initialSteps,
    availableScripts,
    onStepsChange,
    onSave,
    onAddNewScript,
    onRematchStep,
    onCreateScript
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const isInitialized = useRef(false);

    // Convert initial steps to nodes/edges
    useEffect(() => {
        if (isInitialized.current || initialSteps.length === 0 || (initialSteps.length === 1 && !initialSteps[0].description)) {
            return;
        }

        const yPos = (index) => 100 + index * 150;
        const initialNodes = [
            { id: 'start', type: 'input', data: { label: 'Start' }, position: { x: 250, y: 0 }, deletable: false },
            ...initialSteps.map((step, index) => ({
                id: `step-${index}`,
                type: 'stepNode',
                data: { ...step, index },
                position: { x: 100, y: yPos(index) }
            })),
            { id: 'end', type: 'output', data: { label: 'End' }, position: { x: 250, y: yPos(initialSteps.length) }, deletable: false }
        ];

        const initialEdges = initialSteps.map((_, index) => {
            if (index === 0) {
                return { id: `e-start-step-0`, source: 'start', target: `step-0`, animated: true };
            }
            return { id: `e-step-${index - 1}-step-${index}`, source: `step-${index - 1}`, target: `step-${index}`, animated: true };
        });
        initialEdges.push({ id: `e-step-${initialSteps.length - 1}-end`, source: `step-${initialSteps.length - 1}`, target: 'end', animated: true });

        setNodes(initialNodes);
        setEdges(initialEdges);
        isInitialized.current = true;
    }, [initialSteps, setNodes, setEdges]);

    // Sync node data with latest steps (fix loader issue)
    useEffect(() => {
        setNodes((currentNodes) =>
            currentNodes.map((node) => {
                if (node.type === 'stepNode') {
                    const stepIndex = node.data.index;
                    const latestStep = initialSteps[stepIndex];
                    if (latestStep) {
                        return { ...node, data: { ...latestStep, index: stepIndex } };
                    }
                }
                return node;
            })
        );
    }, [initialSteps, setNodes]);

    const onNodeClick = useCallback((event, node) => {
        if (node.type === 'stepNode') {
            setSelectedNodeId(node.id);
        } else {
            setSelectedNodeId(null);
        }
    }, []);

    const handleUpdateStep = useCallback((updatedStepData) => {
        let newNodes;
        setNodes((currentNodes) => {
            newNodes = currentNodes.map(node => {
                if (node.id === selectedNodeId) {
                    return { ...node, data: { ...node.data, ...updatedStepData } };
                }
                return node;
            });
            return newNodes;
        });

        if (newNodes) {
            const newSteps = newNodes
                .filter(n => n.type === 'stepNode')
                .sort((a, b) => a.data.index - b.data.index)
                .map(n => n.data);
            onStepsChange(newSteps);
        }
    }, [selectedNodeId, setNodes, onStepsChange]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className="flex h-[70vh] border rounded-lg">
            <div className="flex-grow relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={(params) => setEdges((eds) => addEdge(params, eds))}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    className="bg-gray-50"
                >
                    <Controls />
                    <Background />
                </ReactFlow>
                <button 
                    onClick={onSave}
                    className="absolute top-4 right-4 px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition"
                >
                    Save Runbook
                </button>
            </div>
            {selectedNode && (
                <PropertiesPanel
                    key={selectedNode.id}
                    nodeData={selectedNode.data} // always latest
                    availableScripts={availableScripts}
                    onUpdate={handleUpdateStep}
                    onClose={() => setSelectedNodeId(null)}
                    onAddNewScript={onAddNewScript}
                    onRematchStep={onRematchStep}
                    onCreateScript={onCreateScript}
                />
            )}
        </div>
    );
};

export default WorkflowBuilder;
