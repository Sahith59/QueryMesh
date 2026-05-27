import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Header from './components/Header';
import DependencyGraph from './components/DependencyGraph';
import ViolationPanel from './components/ViolationPanel';
import DiagnosePanel from './components/DiagnosePanel';
import ToolsPanel from './components/ToolsPanel';
import CycleBanner from './components/CycleBanner';
import ConnectModal from './components/ConnectModal';
import { IconAlertTriangle, IconRetry } from './components/Icons';
import { schemaApi, toolsApi } from './services/api';
import { createStompClient } from './services/websocket';
import type { SchemaGraph, ViolationResult, ScanProgressEvent, ViolationAlert, IndexGap, CircularDepsResult } from './types';
import type { Client } from '@stomp/stompjs';

const panelVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 28 },
  },
};

const appVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

function App() {
  const [graph, setGraph] = useState<SchemaGraph | null>(null);
  const [violations, setViolations] = useState<ViolationResult[]>([]);
  const [wsViolations, setWsViolations] = useState<ViolationAlert[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgressEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [indexGaps, setIndexGaps] = useState<IndexGap[]>([]);
  const [circularDeps, setCircularDeps] = useState<CircularDepsResult>({ hasCycles: false, cycles: [] });
  const [cycleBannerDismissed, setCycleBannerDismissed] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<'violations' | 'index-gaps' | 'circular-deps'>('violations');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [toolsInitialTab, setToolsInitialTab] = useState<'deletion-order' | 'schema-drift'>('deletion-order');
  const [sidePanelWidth, setSidePanelWidth] = useState(340);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220);
  const stompClientRef = useRef<Client | null>(null);
  const diagnosePanelRef = useRef<HTMLDivElement>(null);

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
    setLoadError(null);
    try {
      const [graphData, violationData, gapData, cycleData] = await Promise.all([
        schemaApi.getGraph(),
        schemaApi.getViolations(),
        toolsApi.indexGaps(),
        toolsApi.circularDeps(),
      ]);
      setGraph(graphData);
      setViolations(violationData);
      setIndexGaps(gapData);
      setCircularDeps(cycleData);
      setCycleBannerDismissed(false);
    } catch {
      setLoadError('Cannot connect to backend. Make sure Docker is running: docker compose up');
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
    } catch {
      setIsScanning(false);
    }
  }, []);

  const handleNodeClick = useCallback((tableName: string) => {
    setSelectedTable(tableName);
    diagnosePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    handleLoadGraph();
  }, [handleLoadGraph]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidePanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setSidePanelWidth(Math.max(260, Math.min(520, startWidth + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidePanelWidth]);

  const handleBottomResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setBottomPanelHeight(Math.max(100, Math.min(700, startHeight + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [bottomPanelHeight]);

  const allViolationAlerts: ViolationAlert[] = useMemo(() => wsViolations.length > 0
    ? wsViolations
    : violations.map((v) => ({
        table: v.tableName,
        column: v.columnName,
        orphanedRows: v.orphanedRows,
        severity: v.severity,
        suggestedFix: v.suggestedFix,
        referencedTable: v.referencedTable,
        constraintName: v.constraintName,
      })), [wsViolations, violations]);

  return (
    <div className="app">
      <ToolsPanel
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        tables={graph?.nodes.map((n) => n.tableName) ?? []}
        initialTab={toolsInitialTab}
      />

      <Header
        onLoadGraph={handleLoadGraph}
        onStartScan={handleStartScan}
        onOpenTools={() => { setToolsInitialTab('deletion-order'); setIsToolsOpen(true); }}
        onOpenDrift={() => { setToolsInitialTab('schema-drift'); setIsToolsOpen(true); }}
        isLoading={isLoading}
        isScanning={isScanning}
        graphLoaded={graph !== null}
        totalTables={graph?.totalTables ?? 0}
        totalRelationships={graph?.totalRelationships ?? 0}
        totalViolations={violations.length}
      />

      {/* Demo data banner */}
      <div className="demo-banner">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        Running on <strong>demo data</strong> — e-commerce schema with 10 tables.
        <button className="demo-banner-connect-btn" onClick={() => setIsConnectOpen(true)}>
          Connect your PostgreSQL →
        </button>
      </div>

      <ConnectModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} onConnected={handleLoadGraph} />

      <AnimatePresence>
        {loadError && (
          <motion.div
            className="load-error-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <IconAlertTriangle size={14} />
            {loadError}
            <button className="retry-btn" onClick={handleLoadGraph}>
              <IconRetry size={11} />
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {circularDeps.hasCycles && !cycleBannerDismissed && (
          <CycleBanner
            cycles={circularDeps.cycles}
            onDismiss={() => setCycleBannerDismissed(true)}
            onViewDetails={() => setSidePanelTab('circular-deps')}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="main-content"
        variants={appVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="graph-section" variants={panelVariants}>
          <DependencyGraph
            graph={graph}
            violations={violations}
            indexGapTables={new Set(indexGaps.map((g) => g.table))}
            cycleEdgePairs={new Set(
              circularDeps.cycles.flatMap((c) => c.edges.map((e) => `${e.from}|${e.to}`))
            )}
            cycleNodeSet={new Set(
              circularDeps.cycles.flatMap((c) => c.path)
            )}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedTable}
            isLoading={isLoading}
          />
        </motion.div>

        <div className="resize-handle" onMouseDown={handleResizeMouseDown} />

        <motion.div className="side-panel" variants={panelVariants} style={{ width: sidePanelWidth, flexShrink: 0 }}>
          <ViolationPanel
            violations={allViolationAlerts}
            scanProgress={scanProgress}
            isConnected={isWsConnected}
            indexGaps={indexGaps}
            circularDeps={circularDeps}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
          />
        </motion.div>
      </motion.div>

      <div className="bottom-resize-handle" onMouseDown={handleBottomResizeMouseDown} />

      <motion.div
        className="bottom-panel"
        ref={diagnosePanelRef}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.22 }}
        style={{ height: bottomPanelHeight }}
      >
        <DiagnosePanel
          selectedTable={selectedTable}
          graph={graph}
          violations={allViolationAlerts}
          indexGaps={indexGaps}
          circularDeps={circularDeps}
        />
      </motion.div>
    </div>
  );
}

export default App;
