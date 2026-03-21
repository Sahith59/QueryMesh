import axios from 'axios';
import type { SchemaGraph, SchemaNode, ViolationResult, DiagnoseResult } from '../types';

const API_BASE = 'http://localhost:8080/api';

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
