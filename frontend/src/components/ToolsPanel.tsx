import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toolsApi, driftApi } from '../services/api';
import type { DeletionOrderResponse, SnapshotSummary, SchemaDiff } from '../types';
import {
  IconX, IconCopy, IconDownload, IconCheck, IconAlertTriangle,
  IconSortDesc, IconCamera, IconClock,
} from './Icons';

type Tab = 'deletion-order' | 'schema-drift';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tables: string[];
  initialTab?: Tab;
}

export default function ToolsPanel({ isOpen, onClose, tables, initialTab = 'deletion-order' }: ToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Sync tab when panel opens with a different initialTab
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  // ── Deletion Order state ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DeletionOrderResponse | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  // ── Schema Drift state ────────────────────────────────────────────
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Init deletion-order selections on open
  useEffect(() => {
    if (isOpen && tables.length > 0) {
      setSelectedTables(new Set(tables));
      setResult(null);
      setSearch('');
    }
  }, [isOpen, tables]);

  // Load snapshots when drift tab becomes active
  useEffect(() => {
    if (isOpen && activeTab === 'schema-drift') {
      loadSnapshots();
      setTimeout(() => labelInputRef.current?.focus(), 80);
    }
  }, [isOpen, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // ── Deletion Order handlers ───────────────────────────────────────
  const filteredTables = tables.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const toggleTable = useCallback((name: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleGenerate = async () => {
    if (selectedTables.size === 0) return;
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await toolsApi.deletionOrder(Array.from(selectedTables));
      setResult(res);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyScript = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.script);
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'deletion-order.sql'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Schema Drift handlers ─────────────────────────────────────────
  const loadSnapshots = async () => {
    try {
      const list = await driftApi.listSnapshots();
      setSnapshots(list);
    } catch {
      // silently ignore
    }
  };

  const handleTakeSnapshot = async () => {
    setIsSnapshotting(true);
    setSnapshotError(null);
    try {
      await driftApi.takeSnapshot(snapshotLabel);
      setSnapshotLabel('');
      await loadSnapshots();
    } catch {
      setSnapshotError('Failed to take snapshot. Make sure the graph is loaded.');
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleCompare = async () => {
    if (fromId === null || toId === null) return;
    setIsComparing(true);
    setDiff(null);
    try {
      const d = await driftApi.computeDiff(fromId, toId);
      setDiff(d);
    } finally {
      setIsComparing(false);
    }
  };

  const totalChanges = diff
    ? diff.tablesAdded.length + diff.tablesRemoved.length +
      diff.columnsAdded.length + diff.columnsRemoved.length +
      diff.fksAdded.length + diff.fksRemoved.length +
      diff.indexesAdded.length + diff.indexesRemoved.length
    : 0;

  const handleCopyDiff = async () => {
    if (!diff) return;
    const lines: string[] = [
      `# Schema Diff: "${diff.from.label}" → "${diff.to.label}"`,
      `Captured: ${diff.from.capturedAt} → ${diff.to.capturedAt}`,
      '',
    ];
    if (diff.tablesAdded.length)   lines.push('## Tables Added',   ...diff.tablesAdded.map(t => `+ ${t}`), '');
    if (diff.tablesRemoved.length) lines.push('## Tables Removed', ...diff.tablesRemoved.map(t => `- ${t}`), '');
    if (diff.columnsAdded.length)  lines.push('## Columns Added',  ...diff.columnsAdded.map(c => `+ ${c.table}.${c.column}`), '');
    if (diff.columnsRemoved.length)lines.push('## Columns Removed',...diff.columnsRemoved.map(c => `- ${c.table}.${c.column}`), '');
    if (diff.fksAdded.length)      lines.push('## FKs Added',      ...diff.fksAdded.map(f => `+ ${f.from} → ${f.to} (${f.constraint})`), '');
    if (diff.fksRemoved.length)    lines.push('## FKs Removed',    ...diff.fksRemoved.map(f => `- ${f.from} → ${f.to} (${f.constraint})`), '');
    if (diff.indexesAdded.length)  lines.push('## Indexes Added',  ...diff.indexesAdded.map(i => `+ ${i.table}: ${i.index}`), '');
    if (diff.indexesRemoved.length)lines.push('## Indexes Removed',...diff.indexesRemoved.map(i => `- ${i.table}: ${i.index}`), '');
    if (totalChanges === 0) lines.push('No schema changes detected.');
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <AnimatePresence>
    {isOpen && (
    <motion.div
      className="tools-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="tools-modal"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >

        {/* Modal header */}
        <div className="tools-modal-header">
          <div className="tools-modal-title">
            <span className="tools-modal-eyebrow">QueryMesh</span>
            <h2>Tools</h2>
          </div>
          <button className="tools-close-btn" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="tools-tabs">
          <button
            className={`tools-tab ${activeTab === 'deletion-order' ? 'active' : ''}`}
            onClick={() => setActiveTab('deletion-order')}
          >
            <IconSortDesc size={11} />
            Deletion Order
          </button>
          <button
            className={`tools-tab ${activeTab === 'schema-drift' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema-drift')}
          >
            <IconCamera size={11} />
            Schema Drift
          </button>
        </div>

        {/* ── Deletion Order tab ── */}
        {activeTab === 'deletion-order' && (
          <div className="tools-content">
            <p className="tools-description">
              Select tables to delete. QueryMesh computes the safe FK-respecting deletion order
              using Kahn's topological sort and generates a ready-to-run SQL script.
            </p>

            <div className="deletion-layout">
              <div className="table-selector-pane">
                <div className="selector-header">
                  <span className="selector-title">
                    Tables
                    <span className="selector-count">{selectedTables.size}/{tables.length}</span>
                  </span>
                  <div className="selector-shortcuts">
                    <button className="shortcut-btn" onClick={() => setSelectedTables(new Set(tables))}>All</button>
                    <button className="shortcut-btn" onClick={() => setSelectedTables(new Set())}>Clear</button>
                  </div>
                </div>

                <input
                  className="table-search"
                  type="text"
                  placeholder="Search tables..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <div className="table-list">
                  {filteredTables.length === 0
                    ? <div className="table-list-empty">No tables match</div>
                    : filteredTables.map(name => (
                        <label key={name} className="table-item">
                          <input type="checkbox" checked={selectedTables.has(name)}
                            onChange={() => toggleTable(name)} className="table-checkbox" />
                          <span className="table-item-name">{name}</span>
                        </label>
                      ))}
                </div>

                <div className="generate-btn-footer">
                  <button
                    className={`generate-btn ${isGenerating ? 'btn-loading' : ''}`}
                    onClick={handleGenerate}
                    disabled={selectedTables.size === 0 || isGenerating}
                  >
                    {isGenerating ? <><span className="spinner" />Computing...</> : 'Generate Script'}
                  </button>
                </div>
              </div>

              <div className="sql-output-pane">
                {result ? (
                  <>
                    {result.hasCycles && (
                      <div className="cycle-warning">
                        <IconAlertTriangle size={13} />
                        <div>
                          <strong>Circular FK detected</strong>
                          <span>{result.cycleNodes.join(', ')} — handled with DISABLE TRIGGER ALL in the script</span>
                        </div>
                      </div>
                    )}
                    <div className="sql-meta">
                      <span className="sql-order-label">Deletion order:</span>
                      <div className="sql-order-chain">
                        {result.orderedTables.map((t, i) => (
                          <span key={t} className="sql-chain-item">
                            {t}
                            {i < result.orderedTables.length - 1 && <span className="sql-chain-arrow">→</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="sql-toolbar">
                      <span className="sql-filename">deletion-order.sql</span>
                      <div className="sql-actions">
                        <button className="sql-action-btn" onClick={handleCopyScript}>
                          {copyState === 'copied' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                          {copyState === 'copied' ? 'Copied' : 'Copy'}
                        </button>
                        <button className="sql-action-btn" onClick={handleDownload}>
                          <IconDownload size={12} />Download
                        </button>
                      </div>
                    </div>
                    <pre className="sql-code"><code>{result.script}</code></pre>
                  </>
                ) : (
                  <div className="sql-empty">
                    <div className="sql-empty-icon"><IconSortDesc size={22} /></div>
                    <p>Select tables and click <strong>Generate Script</strong></p>
                    <p className="sql-empty-sub">The script will respect all FK constraints in your schema</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Schema Drift tab ── */}
        {activeTab === 'schema-drift' && (
          <div className="tools-content drift-content">
            <p className="tools-description">
              Capture point-in-time snapshots of your schema and compare any two to see exactly
              what changed — tables, columns, FKs, and indexes.
            </p>

            {/* Take snapshot row */}
            <div className="snapshot-capture-row">
              <input
                ref={labelInputRef}
                className="snapshot-label-input"
                type="text"
                placeholder="Optional label (e.g. before-migration-v4)"
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTakeSnapshot(); }}
              />
              <button
                className={`snapshot-btn ${isSnapshotting ? 'btn-loading' : ''}`}
                onClick={handleTakeSnapshot}
                disabled={isSnapshotting}
              >
                {isSnapshotting
                  ? <><span className="spinner" />Capturing...</>
                  : <><IconCamera size={12} />Snapshot Now</>}
              </button>
            </div>

            {snapshotError && (
              <div className="snapshot-error">
                <IconAlertTriangle size={12} />
                {snapshotError}
              </div>
            )}

            {/* Two-pane layout: snapshot list | diff view */}
            <div className="drift-layout">
              {/* Left: snapshot list */}
              <div className="snapshot-list-pane">
                <div className="snapshot-list-header">
                  <span className="snapshot-list-title">History</span>
                  <span className="snapshot-list-hint">FROM → TO</span>
                </div>

                {snapshots.length === 0 ? (
                  <div className="snapshot-empty">
                    <IconClock size={18} />
                    <p>No snapshots yet</p>
                    <p className="snapshot-empty-sub">Click "Snapshot Now" to capture a baseline</p>
                  </div>
                ) : (
                  <div className="snapshot-list">
                    {snapshots.map(s => (
                      <div
                        key={s.id}
                        className={`snapshot-row ${fromId === s.id ? 'from-selected' : ''} ${toId === s.id ? 'to-selected' : ''}`}
                      >
                        <div className="snapshot-selectors">
                          <button
                            className={`snap-sel-btn ${fromId === s.id ? 'active-from' : ''}`}
                            onClick={() => { setFromId(s.id); setDiff(null); }}
                            title="Select as FROM"
                          >F</button>
                          <button
                            className={`snap-sel-btn ${toId === s.id ? 'active-to' : ''}`}
                            onClick={() => { setToId(s.id); setDiff(null); }}
                            title="Select as TO"
                          >T</button>
                        </div>
                        <div className="snapshot-info">
                          <span className="snapshot-label-text">{s.label}</span>
                          <span className="snapshot-meta">
                            <IconClock size={10} />
                            {s.capturedAt}
                            <span className="snapshot-counts">{s.tableCount}T · {s.relationshipCount}FK</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="compare-btn"
                  onClick={handleCompare}
                  disabled={fromId === null || toId === null || fromId === toId || isComparing}
                >
                  {isComparing ? <><span className="spinner" />Comparing...</> : 'Compare Selected'}
                </button>
              </div>

              {/* Right: diff view */}
              <div className="diff-pane">
                {!diff ? (
                  <div className="diff-empty">
                    <p>Select a <strong>FROM</strong> and <strong>TO</strong> snapshot,<br />then click <strong>Compare Selected</strong></p>
                  </div>
                ) : (
                  <div className="diff-result">
                    <div className="diff-header">
                      <div className="diff-header-meta">
                        <span className="diff-from-label">{diff.from.label}</span>
                        <span className="diff-arrow">→</span>
                        <span className="diff-to-label">{diff.to.label}</span>
                      </div>
                      <div className="diff-header-right">
                        <span className="diff-total">
                          {totalChanges === 0 ? 'No changes' : `${totalChanges} change${totalChanges !== 1 ? 's' : ''}`}
                        </span>
                        <button className="sql-action-btn" onClick={handleCopyDiff}>
                          <IconCopy size={11} />Copy
                        </button>
                      </div>
                    </div>

                    {totalChanges === 0 ? (
                      <div className="diff-no-changes">
                        <IconCheck size={16} />
                        <p>Schemas are identical — no drift detected</p>
                      </div>
                    ) : (
                      <div className="diff-sections">
                        <DiffSection title="Tables Added"    items={diff.tablesAdded.map(t => t)}              kind="added" />
                        <DiffSection title="Tables Removed"  items={diff.tablesRemoved.map(t => t)}            kind="removed" />
                        <DiffSection title="Columns Added"   items={diff.columnsAdded.map(c => `${c.table}.${c.column}`)}   kind="added" />
                        <DiffSection title="Columns Removed" items={diff.columnsRemoved.map(c => `${c.table}.${c.column}`)} kind="removed" />
                        <DiffSection title="FKs Added"       items={diff.fksAdded.map(f => `${f.from} → ${f.to}`)}         kind="added" />
                        <DiffSection title="FKs Removed"     items={diff.fksRemoved.map(f => `${f.from} → ${f.to}`)}       kind="removed" />
                        <DiffSection title="Indexes Added"   items={diff.indexesAdded.map(i => `${i.table}: ${i.index}`)}  kind="added" />
                        <DiffSection title="Indexes Removed" items={diff.indexesRemoved.map(i => `${i.table}: ${i.index}`)}kind="removed" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

function DiffSection({ title, items, kind }: { title: string; items: string[]; kind: 'added' | 'removed' }) {
  if (items.length === 0) return null;
  return (
    <div className="diff-section">
      <span className="diff-section-title">
        {title}
        <span className={`diff-count ${kind}`}>{items.length}</span>
      </span>
      {items.map((item, i) => (
        <div key={i} className={`diff-row diff-${kind}`}>
          <span className="diff-sign">{kind === 'added' ? '+' : '−'}</span>
          <span className="diff-item-text">{item}</span>
        </div>
      ))}
    </div>
  );
}
