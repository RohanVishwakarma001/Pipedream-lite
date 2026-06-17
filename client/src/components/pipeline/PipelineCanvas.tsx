'use client';

import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStartParams,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
const uuidv4 = () => crypto.randomUUID();
import { nodeTypes } from './nodes';
import { NodePalette, NODE_DEFINITIONS } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import type { PipelineNode, PipelineEdge, LiveNodeStatus } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  initialNodes: PipelineNode[];
  initialEdges: PipelineEdge[];
  liveStatuses?: Record<string, { status: string; data?: unknown }>;
  onChange?: (nodes: PipelineNode[], edges: PipelineEdge[]) => void;
  readOnly?: boolean;
}

function toFlowNode(n: PipelineNode, execStatus?: string): Node {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      label: n.name,
      config: n.config,
      execStatus,
    },
    draggable: true,
    selectable: true,
  };
}

function toFlowEdge(e: PipelineEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.label,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
    style: { stroke: '#4b5563', strokeWidth: 1.5 },
  };
}

function fromFlowNode(n: Node): PipelineNode {
  return {
    id: n.id,
    type: n.type as PipelineNode['type'],
    name: n.data.label,
    config: n.data.config || {},
    position: n.position,
  };
}

function fromFlowEdge(e: Edge): PipelineEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    label: typeof e.label === 'string' ? e.label : undefined,
  };
}

export function PipelineCanvas({
  initialNodes,
  initialEdges,
  liveStatuses,
  onChange,
  readOnly = false,
}: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pipelineNodes, setPipelineNodes] = useState<PipelineNode[]>(initialNodes);

  const flowNodes = useMemo(
    () =>
      pipelineNodes.map((n) =>
        toFlowNode(n, liveStatuses?.[n.id]?.status)
      ),
    [pipelineNodes, liveStatuses]
  );
  const flowEdges = useMemo(
    () => (initialEdges || []).map(toFlowEdge),
    [initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync live statuses to nodes
  useEffect(() => {
    if (!liveStatuses) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          execStatus: liveStatuses[n.id]?.status,
        },
      }))
    );
  }, [liveStatuses, setNodes]);

  // Reset when initialNodes/edges change (e.g. loading a different version)
  useEffect(() => {
    const fn = initialNodes.map((n) => toFlowNode(n, liveStatuses?.[n.id]?.status));
    setNodes(fn);
    setPipelineNodes(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    setEdges((initialEdges || []).map(toFlowEdge));
  }, [initialEdges]);

  const notifyChange = useCallback(
    (ns: Node[], es: Edge[]) => {
      if (!onChange) return;
      onChange(ns.map(fromFlowNode), es.map(fromFlowEdge));
    },
    [onChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-${uuidv4()}`,
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
        style: { stroke: '#4b5563', strokeWidth: 1.5 },
      } as Edge;
      setEdges((eds) => {
        const next = addEdge(newEdge, eds);
        notifyChange(nodes, next);
        return next;
      });
    },
    [nodes, notifyChange, setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (readOnly || !reactFlowInstance || !reactFlowWrapper.current) return;

      const nodeType = e.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const def = NODE_DEFINITIONS.find((d) => d.type === nodeType);
      if (!def) return;

      addNewNode(nodeType, def.label, { ...def.defaultConfig }, position);
    },
    [reactFlowInstance, readOnly]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const addNewNode = useCallback(
    (
      type: string,
      label: string,
      config: Record<string, unknown>,
      position?: { x: number; y: number }
    ) => {
      if (readOnly) return;
      const id = `node-${uuidv4()}`;
      const pos = position || {
        x: 200 + nodes.length * 30,
        y: 200 + nodes.length * 30,
      };

      const pipelineNode: PipelineNode = {
        id,
        type: type as PipelineNode['type'],
        name: label,
        config,
        position: pos,
      };

      const flowNode = toFlowNode(pipelineNode);
      setPipelineNodes((prev) => {
        const next = [...prev, pipelineNode];
        setNodes((nds) => {
          const nextNds = [...nds, flowNode];
          notifyChange(nextNds, edges);
          return nextNds;
        });
        return next;
      });
    },
    [nodes, edges, readOnly, notifyChange, setNodes]
  );

  const onNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<PipelineNode>) => {
      setPipelineNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
      );
      setNodes((nds) => {
        const next = nds.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: {
              ...n.data,
              label: updates.name ?? n.data.label,
              config: updates.config ?? n.data.config,
            },
          };
        });
        notifyChange(next, edges);
        return next;
      });
    },
    [edges, notifyChange, setNodes]
  );

  const onNodeDelete = useCallback(
    (nodeId: string) => {
      setPipelineNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setNodes((nds) => {
        const next = nds.filter((n) => n.id !== nodeId);
        setEdges((eds) => {
          const nextEdges = eds.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          );
          notifyChange(next, nextEdges);
          return nextEdges;
        });
        return next;
      });
    },
    [notifyChange, setNodes, setEdges]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const n of deleted) {
        setPipelineNodes((prev) => prev.filter((p) => p.id !== n.id));
      }
    },
    []
  );

  const selectedNode = selectedNodeId
    ? pipelineNodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Node Palette */}
      {!readOnly && (
        <div className="w-52 flex-shrink-0">
          <NodePalette onAddNode={addNewNode} />
        </div>
      )}

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={!readOnly ? onNodesChange : undefined}
          onEdgesChange={!readOnly ? onEdgesChange : undefined}
          onConnect={!readOnly ? onConnect : undefined}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={!readOnly ? onDrop : undefined}
          onDragOver={!readOnly ? onDragOver : undefined}
          onInit={setReactFlowInstance}
          onNodesDelete={!readOnly ? onNodesDelete : undefined}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Backspace', 'Delete']}
          className="bg-gray-950"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#1f2937"
          />
          <Controls
            className="!bg-gray-800 !border-gray-700 !shadow-xl"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-gray-900 !border-gray-700"
            nodeColor={(n) => {
              const status = n.data?.execStatus;
              if (status === 'SUCCESS') return '#10b981';
              if (status === 'FAILED') return '#ef4444';
              if (status === 'RUNNING') return '#3b82f6';
              return '#374151';
            }}
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <div className="text-sm font-medium text-gray-400">
                Drag nodes from the left panel
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Start with a Webhook Trigger node
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Node Config Panel */}
      {!readOnly && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={onNodeUpdate}
          onDelete={onNodeDelete}
        />
      )}
    </div>
  );
}
