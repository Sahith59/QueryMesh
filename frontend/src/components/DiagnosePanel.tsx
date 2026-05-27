import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { schemaApi, toolsApi } from '../services/api';
import {
  IconSearch, IconLoader, IconTarget, IconLink,
  IconArrowDown, IconArrowUp, IconChevronRight, IconAlertTriangle,
} from './Icons';
import type { DiagnoseResult, MigrationScoreResponse, MigrationChangeType, SchemaGraph, ViolationAlert, IndexGap, CircularDepsResult } from '../types';
import SchemaAdvisorPanel from './SchemaAdvisorPanel';

interface DiagnosePanelProps {
  selectedTable?: string;
  graph?: SchemaGraph | null;
  violations?: ViolationAlert[];
  indexGaps?: IndexGap[];
  circularDeps?: CircularDepsResult;
}

type PanelTab = 'diagnose' | 'scorer' | 'advisor';

const CHANGE_TYPES: { value: MigrationChangeType; label: string }[] = [
  { value: 'ADD_COLUMN',    label: 'Add Column' },
  { value: 'DROP_COLUMN',   label: 'Drop Column' },
  { value: 'RENAME_COLUMN', label: 'Rename Column' },
  { value: 'DROP_TABLE',    label: 'Drop Table' },
  { value: 'RENAME_TABLE',  label: 'Rename Table' },
  { value: 'ADD_FK',        label: 'Add Foreign Key' },
  { value: 'DROP_FK',       label: 'Drop Foreign Key' },
  { value: 'ADD_INDEX',     label: 'Add Index' },
  { value: 'DROP_INDEX',    label: 'Drop Index' },
];

function ScoreGauge({ score, riskLevel }: { score: number; riskLevel: 'GREEN' | 'AMBER' | 'RED' }) {
  const radius   = 40;
  const cx       = 56;
  const cy       = 56;
  const circumference = Math.PI * radius; // half-circle
  const offset   = circumference - (score / 100) * circumference;

  const color = riskLevel === 'GREEN' ? '#30D158' : riskLevel === 'AMBER' ? '#FFD60A' : '#FF453A';
  const riskLabel = riskLevel === 'GREEN' ? 'Low Risk' : riskLevel === 'AMBER' ? 'Moderate Risk' : 'High Risk';

  return (
    <div className="score-gauge-wrap">
      <svg viewBox="0 0 112 70" className="score-gauge-svg">
        {/* Track */}
        <path
          d={`M 16,56 A ${radius},${radius} 0 0,1 96,56`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M 16,56 A ${radius},${radius} 0 0,1 96,56`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.25,0,0.2,1)' }}
        />
        {/* Score number */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="gauge-score-text" fill={color}>{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="gauge-label-text" fill="rgba(255,255,255,0.4)">/ 100</text>
      </svg>
      <div className="gauge-risk-badge" data-risk={riskLevel}>{riskLabel}</div>
    </div>
  );
}

export default function DiagnosePanel({
  selectedTable,
  graph = null,
  violations = [],
  indexGaps = [],
  circularDeps = { hasCycles: false, cycles: [] },
}: DiagnosePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('diagnose');

  // ── Diagnose state ────────────────────────────────────────────────────
  const [tableName,     setTableName]     = useState('');
  const [result,        setResult]        = useState<DiagnoseResult | null>(null);
  const [diagLoading,   setDiagLoading]   = useState(false);
  const [diagError,     setDiagError]     = useState<string | null>(null);

  // ── Scorer state ──────────────────────────────────────────────────────
  const [scoreTable,    setScoreTable]    = useState('');
  const [changeType,    setChangeType]    = useState<MigrationChangeType>('ADD_COLUMN');
  const [scoreResult,   setScoreResult]   = useState<MigrationScoreResponse | null>(null);
  const [scoreLoading,  setScoreLoading]  = useState(false);
  const [scoreError,    setScoreError]    = useState<string | null>(null);

  const runDiagnosis = useCallback(async (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setDiagLoading(true);
    setDiagError(null);
    try {
      const data = await schemaApi.diagnose(trimmed);
      setResult(data);
    } catch {
      setDiagError(`Table "${name.trim()}" not found or diagnosis failed.`);
      setResult(null);
    } finally {
      setDiagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTable) {
      setTableName(selectedTable);
      setScoreTable(selectedTable);
      runDiagnosis(selectedTable);
    }
  }, [selectedTable, runDiagnosis]);

  const handleDiagnose   = () => runDiagnosis(tableName);
  const handleKeyDown    = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleDiagnose(); };

  const handleScore = async () => {
    const trimmed = scoreTable.trim().toLowerCase();
    if (!trimmed) return;
    setScoreLoading(true);
    setScoreError(null);
    try {
      const data = await toolsApi.migrationScore({ tableName: trimmed, changeType });
      setScoreResult(data);
    } catch {
      setScoreError(`Could not score table "${scoreTable.trim()}". Make sure the table exists.`);
      setScoreResult(null);
    } finally {
      setScoreLoading(false);
    }
  };
  const handleScoreKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleScore(); };

  return (
    <div className="diagnose-panel">
      {/* Tab bar */}
      <div className="diagnose-tabs">
        <button
          className={`diagnose-tab${activeTab === 'diagnose' ? ' active' : ''}`}
          onClick={() => setActiveTab('diagnose')}
        >
          <IconSearch size={11} />
          Diagnose
        </button>
        <button
          className={`diagnose-tab${activeTab === 'scorer' ? ' active' : ''}`}
          onClick={() => setActiveTab('scorer')}
        >
          <IconTarget size={11} />
          Scorer
        </button>
        <button
          className={`diagnose-tab${activeTab === 'advisor' ? ' active' : ''} diagnose-tab--advisor`}
          onClick={() => setActiveTab('advisor')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          AI Advisor
        </button>
      </div>

      {/* ── DIAGNOSE TAB ──────────────────────────────────────────────── */}
      {activeTab === 'diagnose' && (
        <>
          <div className="diagnose-header">
            <span className="diagnose-hint">Click any graph node to auto-diagnose</span>
          </div>

          <div className="diagnose-input-row">
            <input
              type="text"
              placeholder="table name (e.g. orders)"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="diagnose-input"
            />
            <button
              onClick={handleDiagnose}
              disabled={diagLoading || !tableName.trim()}
              className="diagnose-btn"
            >
              {diagLoading ? <IconLoader size={13} /> : 'Run Diagnosis'}
            </button>
          </div>

          {diagError && (
            <div className="diagnose-error">
              <IconAlertTriangle size={13} />
              {diagError}
            </div>
          )}

          <AnimatePresence>
          {result && (
            <motion.div
              className="diagnose-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.25, 0, 0.2, 1] }}
            >
              <div className="results-top-row">
                <div className="blast-card">
                  <span className="blast-label">
                    <IconTarget size={11} />
                    Blast Radius
                  </span>
                  <span className="blast-number">{result.blastRadius}</span>
                  <span className="blast-sub">tables affected</span>
                </div>

                <div className="affected-card">
                  <div className="result-section-label">
                    <IconTarget size={10} />
                    Affected Tables
                  </div>
                  <div className="affected-tags">
                    {result.affectedTables.length === 0 ? (
                      <span className="fk-empty">None</span>
                    ) : (
                      result.affectedTables.map((t, i) => (
                        <span key={t} className="affected-tag" style={{ animationDelay: `${i * 30}ms` }}>
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="chain-card">
                <div className="result-section-label">
                  <IconLink size={10} />
                  Dependency Chain
                </div>
                <div className="chain-list">
                  {result.dependencyChain.map((t, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && (
                        <span className="chain-arrow">
                          <IconChevronRight size={10} />
                        </span>
                      )}
                      <span className="chain-node" style={{ animationDelay: `${i * 40}ms` }}>{t}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="fk-grid">
                <div className="fk-card">
                  <div className="result-section-label">
                    <IconArrowDown size={11} />
                    Incoming FKs ({result.incomingForeignKeys.length})
                  </div>
                  <div className="fk-list">
                    {result.incomingForeignKeys.length === 0 ? (
                      <span className="fk-empty">No incoming references</span>
                    ) : (
                      result.incomingForeignKeys.map((fk, i) => (
                        <div key={i} className="fk-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <span className="fk-table">{fk.from}</span>
                          <span className="fk-col">.{fk.fromColumn}</span>
                          <span className="fk-arrow"><IconChevronRight size={9} /></span>
                          <span className="fk-col">.{fk.toColumn}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="fk-card">
                  <div className="result-section-label">
                    <IconArrowUp size={11} />
                    Outgoing FKs ({result.outgoingForeignKeys.length})
                  </div>
                  <div className="fk-list">
                    {result.outgoingForeignKeys.length === 0 ? (
                      <span className="fk-empty">No outgoing references</span>
                    ) : (
                      result.outgoingForeignKeys.map((fk, i) => (
                        <div key={i} className="fk-row" style={{ animationDelay: `${i * 30}ms` }}>
                          <span className="fk-table">{fk.to}</span>
                          <span className="fk-col">.{fk.toColumn}</span>
                          <span className="fk-arrow"><IconChevronRight size={9} /></span>
                          <span className="fk-col">.{fk.fromColumn}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </>
      )}

      {/* ── AI ADVISOR TAB ────────────────────────────────────────────── */}
      {activeTab === 'advisor' && (
        <SchemaAdvisorPanel
          graph={graph}
          violations={violations}
          indexGaps={indexGaps}
          circularDeps={circularDeps}
        />
      )}

      {/* ── MIGRATION SCORER TAB ─────────────────────────────────────── */}
      {activeTab === 'scorer' && (
        <div className="scorer-panel">
          <div className="scorer-input-section">
            <div className="scorer-row">
              <input
                type="text"
                placeholder="table name (e.g. orders)"
                value={scoreTable}
                onChange={(e) => setScoreTable(e.target.value)}
                onKeyDown={handleScoreKey}
                className="diagnose-input"
              />
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as MigrationChangeType)}
                className="change-type-select"
              >
                {CHANGE_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
              <button
                onClick={handleScore}
                disabled={scoreLoading || !scoreTable.trim()}
                className="diagnose-btn"
              >
                {scoreLoading ? <IconLoader size={13} /> : 'Score'}
              </button>
            </div>
          </div>

          {scoreError && (
            <div className="diagnose-error">
              <IconAlertTriangle size={13} />
              {scoreError}
            </div>
          )}

          <AnimatePresence>
          {scoreResult && (
            <motion.div
              className="scorer-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.25, 0, 0.2, 1] }}
            >
              {/* Gauge + breakdown side by side */}
              <div className="scorer-top">
                <ScoreGauge score={scoreResult.score} riskLevel={scoreResult.riskLevel} />

                <div className="score-breakdown">
                  <div className="score-breakdown-header">Factor Breakdown</div>
                  <div className="score-breakdown-rows">
                    {scoreResult.breakdown.map((b) => {
                      const pct = Math.round((b.score / b.maxScore) * 100);
                      return (
                        <div key={b.factor} className="breakdown-row">
                          <div className="breakdown-factor">{b.factor}</div>
                          <div className="breakdown-bar-wrap">
                            <div
                              className="breakdown-bar-fill"
                              style={{ width: `${pct}%` }}
                              data-score={b.score}
                              data-max={b.maxScore}
                            />
                          </div>
                          <div className="breakdown-pts">
                            <span className="breakdown-score">{b.score}</span>
                            <span className="breakdown-max">/{b.maxScore}</span>
                          </div>
                          <div className="breakdown-detail">{b.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {scoreResult.warnings.length > 0 && (
                <div className="scorer-section">
                  <div className="scorer-section-title">
                    <IconAlertTriangle size={11} />
                    Warnings
                  </div>
                  <ul className="score-list score-warnings">
                    {scoreResult.warnings.map((w, i) => (
                      <li key={i} className="score-list-item score-warning-item">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Checklist */}
              {scoreResult.checklist.length > 0 && (
                <div className="scorer-section">
                  <div className="scorer-section-title">Migration Checklist</div>
                  <ul className="score-list score-checklist">
                    {scoreResult.checklist.map((item, i) => (
                      <li key={i} className="score-list-item score-check-item">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
