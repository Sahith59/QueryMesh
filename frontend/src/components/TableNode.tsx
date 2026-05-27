import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SchemaNode } from '../types';

interface TableNodeData {
  label: string;
  table: SchemaNode;
  hasViolation: boolean;
  hasForeignKeys: boolean;
  hasIndexGap?: boolean;
  isCycleNode?: boolean;
  isSelected?: boolean;
}

function TableNode({ data }: { data: TableNodeData }) {
  const { table, hasViolation, hasForeignKeys, hasIndexGap, isCycleNode, isSelected } = data;

  const statusColor = hasViolation
    ? 'var(--danger)'
    : hasForeignKeys
    ? 'var(--warning)'
    : 'var(--success)';

  const badgeLabel = hasViolation ? 'VIOLATION' : hasForeignKeys ? 'HAS FKs' : 'HEALTHY';

  const nodeClass = [
    'table-node',
    hasViolation ? 'violation' : hasForeignKeys ? 'has-fk' : 'healthy',
    isSelected ? 'selected' : '',
    isCycleNode ? 'cycle-node' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={nodeClass}>
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="table-node-header">
        <div className="status-dot" style={{ background: statusColor }} />
        <span className="table-node-name">{table.tableName}</span>
      </div>

      <div className="table-node-stats">
        <div className="node-stat">
          <span className="node-stat-num">{table.rowCount.toLocaleString()}</span>
          <span className="node-stat-label">ROWS</span>
        </div>
        <div className="node-stat">
          <span className="node-stat-num">{table.columns.length}</span>
          <span className="node-stat-label">COLS</span>
        </div>
        <div className="node-stat">
          <span className="node-stat-num">{table.indexes.length}</span>
          <span className="node-stat-label">IDX</span>
        </div>
      </div>

      <div className="table-node-badge">{badgeLabel}</div>

      {hasIndexGap && (
        <div className="node-index-gap-dot" title="Missing FK index" />
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}

export default memo(TableNode);
