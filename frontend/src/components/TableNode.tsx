import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SchemaNode } from '../types';

interface TableNodeData {
  label: string;
  table: SchemaNode;
  hasViolation: boolean;
  hasForeignKeys: boolean;
}

function TableNode({ data }: { data: TableNodeData }) {
  const { table, hasViolation, hasForeignKeys } = data;

  const getStatusColor = () => {
    if (hasViolation) return 'var(--color-danger)';
    if (hasForeignKeys) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getStatusLabel = () => {
    if (hasViolation) return 'VIOLATION';
    if (hasForeignKeys) return 'HAS FKs';
    return 'HEALTHY';
  };

  return (
    <div className={`table-node ${hasViolation ? 'violation' : hasForeignKeys ? 'has-fk' : 'healthy'}`}>
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="table-node-header">
        <div className="table-node-status" style={{ background: getStatusColor() }} />
        <span className="table-node-name">{table.tableName}</span>
      </div>

      <div className="table-node-body">
        <div className="table-node-stat">
          <span className="stat-icon">📊</span>
          <span className="stat-value">{table.rowCount}</span>
          <span className="stat-label">rows</span>
        </div>
        <div className="table-node-stat">
          <span className="stat-icon">📇</span>
          <span className="stat-value">{table.columns.length}</span>
          <span className="stat-label">cols</span>
        </div>
        <div className="table-node-stat">
          <span className="stat-icon">⚡</span>
          <span className="stat-value">{table.indexes.length}</span>
          <span className="stat-label">idx</span>
        </div>
      </div>

      <div className="table-node-badge" style={{ background: getStatusColor() }}>
        {getStatusLabel()}
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}

export default memo(TableNode);
