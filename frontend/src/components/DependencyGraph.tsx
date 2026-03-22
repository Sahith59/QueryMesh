import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import TableNode from './TableNode';
import type { SchemaGraph, ViolationResult } from '../types';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 140;

const nodeTypes = { tableNode: TableNode };

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = 'TB'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface DependencyGraphProps {
  graph: SchemaGraph | null;
  violations: ViolationResult[];
  onNodeClick?: (tableName: string) => void;
}

export default function DependencyGraph({ graph, violations, onNodeClick }: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const violatedTables = useMemo(
    () => new Set(violations.map((v) => v.tableName)),
    [violations]
  );

  const fkTables = useMemo(() => {
    if (!graph) return new Set<string>();
    const tables = new Set<string>();
    graph.edges.forEach((e) => {
      tables.add(e.from);
      tables.add(e.to);
    });
    return tables;
  }, [graph]);

  useEffect(() => {
    if (!graph) return;

    const flowNodes: Node[] = graph.nodes.map((table) => ({
      id: table.tableName,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: {
        label: table.tableName,
        table,
        hasViolation: violatedTables.has(table.tableName),
        hasForeignKeys: fkTables.has(table.tableName),
      },
    }));

    const flowEdges: Edge[] = graph.edges.map((edge, i) => ({
      id: `edge-${i}`,
      source: edge.from,
      target: edge.to,
      label: edge.constraintName.replace(/_fkey$/, ''),
      animated: violatedTables.has(edge.from),
      style: {
        stroke: violatedTables.has(edge.from) ? '#ff4757' : '#64748b',
        strokeWidth: 2,
      },
      labelStyle: {
        fill: '#94a3b8',
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: '#1e293b',
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      type: 'smoothstep',
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graph, violatedTables, fkTables, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  if (!graph) {
    return (
      <div className="graph-placeholder">
        <div className="placeholder-icon">🔗</div>
        <h3>No Graph Data</h3>
        <p>Click "Load Graph" to fetch the dependency graph from the database</p>
      </div>
    );
  }

  return (
    <div className="graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls
          showInteractive={false}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { hasViolation?: boolean; hasForeignKeys?: boolean };
            if (data?.hasViolation) return '#ff4757';
            if (data?.hasForeignKeys) return '#ffa502';
            return '#2ed573';
          }}
          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
