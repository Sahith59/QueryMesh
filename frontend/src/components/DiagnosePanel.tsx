import { useState } from 'react';
import { schemaApi } from '../services/api';
import type { DiagnoseResult } from '../types';

interface DiagnosePanelProps {
  onDiagnose?: (tableName: string) => void;
}

export default function DiagnosePanel({ onDiagnose }: DiagnosePanelProps) {
  const [tableName, setTableName] = useState('');
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnose = async () => {
    if (!tableName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await schemaApi.diagnose(tableName.trim().toLowerCase());
      setResult(data);
      onDiagnose?.(tableName.trim().toLowerCase());
    } catch (err) {
      setError('Table not found or diagnosis failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDiagnose();
  };

  return (
    <div className="diagnose-panel">
      <div className="diagnose-header">
        <span className="panel-icon">🔍</span>
        <h3>Diagnose Table</h3>
      </div>

      <div className="diagnose-input-row">
        <input
          type="text"
          placeholder="Enter table name (e.g., orders)"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="diagnose-input"
        />
        <button
          onClick={handleDiagnose}
          disabled={loading || !tableName.trim()}
          className="diagnose-btn"
        >
          {loading ? (
            <span className="btn-spinner" />
          ) : (
            <>Run Diagnosis</>
          )}
        </button>
      </div>

      {error && <div className="diagnose-error">{error}</div>}

      {result && (
        <div className="diagnose-results">
          <div className="result-section">
            <div className="result-header">
              <span className="result-icon">💥</span>
              <span className="result-title">Blast Radius</span>
              <span className="blast-radius-value">{result.blastRadius}</span>
            </div>
            <div className="affected-tables">
              {result.affectedTables.map((t) => (
                <span key={t} className="affected-table-tag">{t}</span>
              ))}
            </div>
          </div>

          <div className="result-section">
            <div className="result-header">
              <span className="result-icon">🔗</span>
              <span className="result-title">Dependency Chain</span>
            </div>
            <div className="dependency-chain">
              {result.dependencyChain.map((t, i) => (
                <span key={i} className="chain-item">
                  {i > 0 && <span className="chain-arrow">→</span>}
                  <span className="chain-table">{t}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="result-columns">
            <div className="result-section">
              <div className="result-header">
                <span className="result-icon">⬇️</span>
                <span className="result-title">Incoming FKs ({result.incomingForeignKeys.length})</span>
              </div>
              <div className="fk-list">
                {result.incomingForeignKeys.map((fk, i) => (
                  <div key={i} className="fk-item">
                    <span className="fk-table">{fk.from}</span>
                    <span className="fk-col">.{fk.fromColumn}</span>
                    <span className="fk-arrow">→</span>
                    <span className="fk-col">.{fk.toColumn}</span>
                  </div>
                ))}
                {result.incomingForeignKeys.length === 0 && (
                  <span className="fk-empty">No incoming references</span>
                )}
              </div>
            </div>

            <div className="result-section">
              <div className="result-header">
                <span className="result-icon">⬆️</span>
                <span className="result-title">Outgoing FKs ({result.outgoingForeignKeys.length})</span>
              </div>
              <div className="fk-list">
                {result.outgoingForeignKeys.map((fk, i) => (
                  <div key={i} className="fk-item">
                    <span className="fk-table">{fk.to}</span>
                    <span className="fk-col">.{fk.toColumn}</span>
                    <span className="fk-arrow">←</span>
                    <span className="fk-col">.{fk.fromColumn}</span>
                  </div>
                ))}
                {result.outgoingForeignKeys.length === 0 && (
                  <span className="fk-empty">No outgoing references</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
