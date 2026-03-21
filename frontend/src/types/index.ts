// ===== Schema Graph Types =====
export interface SchemaNode {
  tableName: string;
  schema: string;
  columns: string[];
  indexes: string[];
  rowCount: number;
}

export interface SchemaEdge {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  constraintName: string;
}

export interface SchemaGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  totalTables: number;
  totalRelationships: number;
}

// ===== Violation Types =====
export interface ViolationResult {
  tableName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
  orphanedRows: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedFix: string;
}

// ===== WebSocket Event Types =====
export interface ScanProgressEvent {
  currentTable: string;
  tablesScanned: number;
  totalTables: number;
  violationsFound: number;
  status: 'SCANNING' | 'COMPLETE' | 'ERROR';
}

export interface ViolationAlert {
  table: string;
  column: string;
  orphanedRows: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedFix: string;
  referencedTable: string;
  constraintName: string;
}

// ===== Diagnose Types =====
export interface DiagnoseResult {
  tableName: string;
  dependencyChain: string[];
  incomingForeignKeys: SchemaEdge[];
  outgoingForeignKeys: SchemaEdge[];
  blastRadius: number;
  affectedTables: string[];
}
