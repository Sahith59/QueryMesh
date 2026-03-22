import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import DependencyGraph from './components/DependencyGraph';
import ViolationPanel from './components/ViolationPanel';
import DiagnosePanel from './components/DiagnosePanel';
import { schemaApi } from './services/api';
import { createStompClient } from './services/websocket';
import type { SchemaGraph, ViolationResult, ScanProgressEvent, ViolationAlert } from './types';
import type { Client } from '@stomp/stompjs';

function App() {
  const [graph, setGraph] = useState<SchemaGraph | null>(null);
  const [violations, setViolations] = useState<ViolationResult[]>([]);
  const [wsViolations, setWsViolations] = useState<ViolationAlert[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgressEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const stompClientRef = useRef<Client | null>(null);

  // Connect to WebSocket on mount
  useEffect(() => {
    const client = createStompClient(
      (progress) => {
        setScanProgress(progress);
        if (progress.status === 'COMPLETE' || progress.status === 'ERROR') {
          setIsScanning(false);
        }
      },
      (alert) => {
        setWsViolations((prev) => [...prev, alert]);
      },
      () => setIsWsConnected(true),
      () => setIsWsConnected(false)
    );

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, []);

  const handleLoadGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const [graphData, violationData] = await Promise.all([
        schemaApi.getGraph(),
        schemaApi.getViolations(),
      ]);
      setGraph(graphData);
      setViolations(violationData);
    } catch (err) {
      console.error('Failed to load graph:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true);
    setWsViolations([]);
    setScanProgress(null);
    try {
      await schemaApi.startScan();
    } catch (err) {
      console.error('Failed to start scan:', err);
      setIsScanning(false);
    }
  }, []);

  const handleNodeClick = useCallback((tableName: string) => {
    // Auto-fill the diagnose panel when a node is clicked
    const input = document.querySelector('.diagnose-input') as HTMLInputElement;
    if (input) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      nativeInputValueSetter?.call(input, tableName);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, []);

  // Auto-load graph on mount
  useEffect(() => {
    handleLoadGraph();
  }, [handleLoadGraph]);

  // Combine REST violations and WebSocket violations for display
  const allViolationAlerts: ViolationAlert[] = wsViolations.length > 0
    ? wsViolations
    : violations.map((v) => ({
        table: v.tableName,
        column: v.columnName,
        orphanedRows: v.orphanedRows,
        severity: v.severity,
        suggestedFix: v.suggestedFix,
        referencedTable: v.referencedTable,
        constraintName: v.constraintName,
      }));

  return (
    <div className="app">
      <Header
        onLoadGraph={handleLoadGraph}
        onStartScan={handleStartScan}
        isLoading={isLoading}
        isScanning={isScanning}
        graphLoaded={graph !== null}
      />

      <div className="main-content">
        <div className="graph-section">
          <DependencyGraph
            graph={graph}
            violations={violations}
            onNodeClick={handleNodeClick}
          />
        </div>

        <div className="side-panel">
          <ViolationPanel
            violations={allViolationAlerts}
            scanProgress={scanProgress}
            isConnected={isWsConnected}
          />
        </div>
      </div>

      <div className="bottom-panel">
        <DiagnosePanel />
      </div>
    </div>
  );
}

export default App;
