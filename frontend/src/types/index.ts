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

// ===== Tools Types =====
export interface DeletionOrderRequest {
  tables: string[];
}

export interface DeletionOrderResponse {
  orderedTables: string[];
  hasCycles: boolean;
  cycleNodes: string[];
  script: string;
}

export interface IndexGap {
  table: string;
  column: string;
  referencedTable: string;
  estimatedRows: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedIndex: string;
}

export interface CycleEdge {
  from: string;
  to: string;
  constraint: string;
}

export interface CycleInfo {
  path: string[];
  edges: CycleEdge[];
  riskLevel: string;
  explanation: string;
}

export interface CircularDepsResult {
  hasCycles: boolean;
  cycles: CycleInfo[];
}

// ===== Schema Drift Types =====
export interface SnapshotSummary {
  id: number;
  label: string;
  capturedAt: string;
  tableCount: number;
  relationshipCount: number;
}

export interface ColumnChange { table: string; column: string; }
export interface FkChange     { from: string; to: string; constraint: string; }
export interface IndexChange   { table: string; index: string; }

export interface SchemaDiff {
  from: SnapshotSummary;
  to: SnapshotSummary;
  tablesAdded: string[];
  tablesRemoved: string[];
  columnsAdded: ColumnChange[];
  columnsRemoved: ColumnChange[];
  fksAdded: FkChange[];
  fksRemoved: FkChange[];
  indexesAdded: IndexChange[];
  indexesRemoved: IndexChange[];
}

// ===== Migration Scorer Types =====
export type MigrationChangeType =
  | 'ADD_COLUMN' | 'DROP_COLUMN' | 'RENAME_COLUMN'
  | 'DROP_TABLE' | 'RENAME_TABLE'
  | 'ADD_FK' | 'DROP_FK'
  | 'ADD_INDEX' | 'DROP_INDEX';

export interface MigrationScoreRequest {
  tableName: string;
  changeType: MigrationChangeType;
  details?: string;
}

export interface ScoreBreakdown {
  factor: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface MigrationScoreResponse {
  tableName: string;
  changeType: string;
  score: number;
  riskLevel: 'GREEN' | 'AMBER' | 'RED';
  breakdown: ScoreBreakdown[];
  warnings: string[];
  checklist: string[];
}
