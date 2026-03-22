import { useEffect, useRef, useState } from 'react';
import type { ScanProgressEvent, ViolationAlert } from '../types';

interface ViolationPanelProps {
  violations: ViolationAlert[];
  scanProgress: ScanProgressEvent | null;
  isConnected: boolean;
}

export default function ViolationPanel({ violations, scanProgress, isConnected }: ViolationPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [violations]);

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return '';
    }
  };

  const getProgressPercent = () => {
    if (!scanProgress || scanProgress.totalTables === 0) return 0;
    return Math.round((scanProgress.tablesScanned / scanProgress.totalTables) * 100);
  };

  return (
    <div className="violation-panel">
      <div className="panel-header">
        <h3>
          <span className="panel-icon">🛡️</span>
          Violations
          {violations.length > 0 && (
            <span className="violation-count">{violations.length}</span>
          )}
        </h3>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot" />
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Scan Progress */}
      {scanProgress && scanProgress.status === 'SCANNING' && (
        <div className="scan-progress">
          <div className="progress-header">
            <span className="progress-label">Scanning: {scanProgress.currentTable}</span>
            <span className="progress-percent">{getProgressPercent()}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
          <div className="progress-stats">
            <span>{scanProgress.tablesScanned}/{scanProgress.totalTables} tables</span>
            <span>{scanProgress.violationsFound} violations</span>
          </div>
        </div>
      )}

      {scanProgress && scanProgress.status === 'COMPLETE' && (
        <div className="scan-complete">
          <span className="complete-icon">✅</span>
          Scan complete — {scanProgress.violationsFound} violation{scanProgress.violationsFound !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Violation Feed */}
      <div className="violation-feed" ref={feedRef}>
        {violations.length === 0 && (
          <div className="empty-feed">
            <span className="empty-icon">📋</span>
            <p>No violations detected yet</p>
            <p className="empty-hint">Click "Scan" to check for FK integrity violations</p>
          </div>
        )}

        {violations.map((v, i) => (
          <div
            key={i}
            className={`violation-card ${getSeverityClass(v.severity)} ${expandedIndex === i ? 'expanded' : ''}`}
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
          >
            <div className="violation-card-header">
              <span className={`severity-badge ${getSeverityClass(v.severity)}`}>
                {v.severity}
              </span>
              <span className="violation-table">{v.table}</span>
              <span className="violation-column">.{v.column}</span>
            </div>
            <div className="violation-card-body">
              <div className="violation-stat">
                <span className="stat-label">Orphaned Rows</span>
                <span className="stat-value">{v.orphanedRows}</span>
              </div>
              <div className="violation-stat">
                <span className="stat-label">References</span>
                <span className="stat-value">{v.referencedTable}</span>
              </div>
            </div>
            {expandedIndex === i && (
              <div className="violation-fix">
                <span className="fix-label">💡 Suggested Fix:</span>
                <code>{v.suggestedFix}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
