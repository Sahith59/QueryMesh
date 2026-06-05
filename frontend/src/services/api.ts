import axios from 'axios';
import type { SchemaGraph, SchemaNode, ViolationResult, DiagnoseResult, DeletionOrderResponse, IndexGap, CircularDepsResult, SnapshotSummary, SchemaDiff, MigrationScoreRequest, MigrationScoreResponse } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080') + '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const schemaApi = {
  getGraph: () => api.get<SchemaGraph>('/schema/graph').then(res => res.data),
  getTables: () => api.get<SchemaNode[]>('/schema/tables').then(res => res.data),
  getViolations: () => api.get<ViolationResult[]>('/schema/violations').then(res => res.data),
  diagnose: (tableName: string) =>
    api.post<DiagnoseResult>('/schema/diagnose', { tableName }).then(res => res.data),
  startScan: () => api.post('/scan/start').then(res => res.data),
};

export const toolsApi = {
  deletionOrder: (tables: string[]) =>
    api.post<DeletionOrderResponse>('/tools/deletion-order', { tables }).then(res => res.data),
  indexGaps: () =>
    api.get<IndexGap[]>('/tools/index-gaps').then(res => res.data),
  circularDeps: () =>
    api.get<CircularDepsResult>('/tools/circular-deps').then(res => res.data),
  migrationScore: (req: MigrationScoreRequest) =>
    api.post<MigrationScoreResponse>('/tools/migration-score', req).then(res => res.data),
};

export const connectionApi = {
  connect: (params: { host: string; port: number; database: string; username: string; password: string; dbType?: string }) =>
    api.post<{ success: boolean; message: string; tableCount?: number; database?: string; host?: string }>(
      '/schema/connect', params
    ).then(res => res.data),
};

export const driftApi = {
  takeSnapshot: (label: string) =>
    api.post<SnapshotSummary>('/drift/snapshot', { label }).then(res => res.data),
  listSnapshots: () =>
    api.get<SnapshotSummary[]>('/drift/snapshots').then(res => res.data),
  computeDiff: (fromId: number, toId: number) =>
    api.post<SchemaDiff>('/drift/diff', { fromId, toId }).then(res => res.data),
};
