import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import TableNode from './TableNode';
import CustomEdge from './CustomEdge';
import { IconGrid } from './Icons';
import type { SchemaGraph, ViolationResult } from '../types';

const NODE_WIDTH  = 200;
const NODE_HEIGHT = 135;

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { custom: CustomEdge };

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // Generous spacing so nodes never overlap
  g.setGraph({ rankdir: direction, nodesep: 100, ranksep: 130, edgesep: 50 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

interface DependencyGraphProps {
  graph: SchemaGraph | null;
  violations: ViolationResult[];
  indexGapTables?: Set<string>;
  cycleEdgePairs?: Set<string>;
  cycleNodeSet?: Set<string>;
  onNodeClick?: (tableName: string) => void;
  selectedNodeId?: string;
  isLoading?: boolean;
}

export default function DependencyGraph({
  graph,
  violations,
  indexGapTables = new Set(),
  cycleEdgePairs = new Set(),
  cycleNodeSet = new Set(),
  onNodeClick,
  selectedNodeId,
  isLoading,
}: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const violatedTables = useMemo(
    () => new Set(violations.map((v) => v.tableName)),
    [violations]
  );

  const fkTables = useMemo(() => {
    if (!graph) return new Set<string>();
    const s = new Set<string>();
    graph.edges.forEach((e) => { s.add(e.from); s.add(e.to); });
    return s;
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
        hasViolation:  violatedTables.has(table.tableName),
        hasForeignKeys: fkTables.has(table.tableName),
        hasIndexGap:   indexGapTables.has(table.tableName),
        isCycleNode:   cycleNodeSet.has(table.tableName),
        isSelected:    table.tableName === selectedNodeId,
      },
    }));

    const flowEdges: Edge[] = graph.edges.map((edge, i) => {
      const isCycle     = cycleEdgePairs.has(`${edge.from}|${edge.to}`);
      const isViolation = violatedTables.has(edge.from);

      const stroke      = isCycle ? '#FF9F0A' : isViolation ? '#FF3B30' : '#007AFF';
      const strokeWidth = isCycle ? 1.6 : isViolation ? 1.8 : 1.4;
      const opacity     = isCycle ? 0.38 : isViolation ? 0.80 : 0.65;

      // Short human-readable label for hover tooltip only
      const label = edge.constraintName
        .replace(/_fkey$/, '')
        .replace(/_id$/, '')
        .replace(/_/g, ' ');

      return {
        id: `edge-${i}`,
        source: edge.from,
        target: edge.to,
        type: 'custom',
        animated: isViolation,
        data: { label },
        style: {
          stroke,
          strokeWidth,
          strokeDasharray: isCycle ? '6 6' : isViolation ? '5 3' : undefined,
          opacity,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 14,
          height: 14,
        },
      };
    });

    const { nodes: ln, edges: le } = getLayoutedElements(flowNodes, flowEdges);
    setNodes(ln);
    setEdges(le);
  }, [graph, violatedTables, fkTables, cycleEdgePairs, cycleNodeSet, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected:  n.id === selectedNodeId,
          hasIndexGap: indexGapTables.has(n.id),
          isCycleNode: cycleNodeSet.has(n.id),
        },
      }))
    );
  }, [selectedNodeId, indexGapTables, cycleNodeSet, setNodes]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => { onNodeClick?.(node.id); },
    [onNodeClick]
  );

  if (isLoading && !graph) {
    return (
      <div className="graph-placeholder">
        <div className="graph-loading-ring" />
        <h3>Introspecting schema…</h3>
        <p>Querying PostgreSQL information_schema</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="graph-placeholder">
        <div className="graph-placeholder-icon">
          <IconGrid size={22} />
        </div>
        <h3>No graph loaded</h3>
        <p>Click <strong>Load Graph</strong> to visualise FK dependencies</p>
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
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.20 }}
        minZoom={0.20}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'custom' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.3}
          color="rgba(0,0,0,0.09)"
        />
        <Controls
          showInteractive={false}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.90)',
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as { hasViolation?: boolean; hasForeignKeys?: boolean };
            if (d?.hasViolation)   return '#FF3B30';
            if (d?.hasForeignKeys) return '#FF9F0A';
            return '#34C759';
          }}
          style={{
            background: 'rgba(255,255,255,0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.90)',
          }}
          maskColor="rgba(235,235,240,0.70)"
        />

        {/* Legend */}
        <div className="graph-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#FF3B30' }} />
            <span>Violation FK</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#FF9F0A' }} />
            <span>Circular FK</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#007AFF' }} />
            <span>Foreign Key</span>
          </div>
        </div>
      </ReactFlow>
    </div>
  );
}
