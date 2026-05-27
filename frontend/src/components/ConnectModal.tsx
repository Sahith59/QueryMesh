import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { connectionApi } from '../services/api';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type Mode = 'form' | 'manual';
type FormStatus = 'idle' | 'connecting' | 'success' | 'error';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="connect-copy-btn" onClick={async () => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

const RESTART_CMD = `docker compose down\ndocker compose up -d`;
const MANUAL_YAML = `# docker-compose.yml — backend environment section
backend:
  environment:
    SPRING_DATASOURCE_URL: jdbc:postgresql://<host>:<port>/<db>
    SPRING_DATASOURCE_USERNAME: <username>
    SPRING_DATASOURCE_PASSWORD: <password>`;

export default function ConnectModal({ isOpen, onClose, onConnected }: ConnectModalProps) {
  const [mode, setMode] = useState<Mode>('form');
  const [dbType, setDbType] = useState<'postgresql' | 'mysql' | 'mariadb'>('postgresql');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const defaultPort = dbType === 'postgresql' ? '5432' : '3306';
  const [status, setStatus] = useState<FormStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [tableCount, setTableCount] = useState(0);

  const canSubmit = host.trim() && database.trim() && username.trim() && status !== 'connecting';

  const handleConnect = async () => {
    if (!canSubmit) return;
    setStatus('connecting');
    setStatusMsg('');
    try {
      const res = await connectionApi.connect({
        host: host.trim(),
        port: parseInt(port) || (dbType === 'postgresql' ? 5432 : 3306),
        database: database.trim(),
        username: username.trim(),
        password,
        dbType,
      } as Parameters<typeof connectionApi.connect>[0]);
      if (res.success) {
        setStatus('success');
        setTableCount(res.tableCount ?? 0);
        setStatusMsg(`Connected to "${res.database}" on ${res.host}`);
      } else {
        setStatus('error');
        setStatusMsg(res.message);
      }
    } catch {
      setStatus('error');
      setStatusMsg('Could not reach QueryMesh backend. Make sure Docker is running.');
    }
  };

  const handleDone = () => {
    onConnected();
    onClose();
    // Reset form
    setStatus('idle');
    setStatusMsg('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="connect-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="connect-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div className="connect-modal-header">
              <div className="connect-modal-title-row">
                <div className="connect-modal-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                </div>
                <div>
                  <h3 className="connect-modal-title">Connect Your PostgreSQL</h3>
                  <p className="connect-modal-subtitle">Live connection — no restart required</p>
                </div>
              </div>
              <button className="connect-close-btn" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Mode tabs */}
            <div className="connect-mode-toggle">
              <button className={`connect-mode-btn ${mode === 'form' ? 'active' : ''}`} onClick={() => setMode('form')}>
                Connect via Form
              </button>
              <button className={`connect-mode-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>
                Self-host / Manual
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'form' ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="connect-form-body"
                >
                  {/* Info */}
                  <div className="connect-how-it-works">
                    <div className="connect-how-icon">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                      </svg>
                    </div>
                    <p>Enter your credentials — QueryMesh switches connections instantly without any restart. Your database is never modified (read-only).</p>
                  </div>

                  {/* DB type selector */}
                  <div className="connect-db-type-row">
                    {(['postgresql', 'mysql', 'mariadb'] as const).map(t => (
                      <button
                        key={t}
                        className={`connect-db-type-btn ${dbType === t ? 'active' : ''}`}
                        onClick={() => { setDbType(t); setPort(t === 'postgresql' ? '5432' : '3306'); }}
                        disabled={status === 'connecting'}
                      >
                        {t === 'postgresql' ? 'PostgreSQL' : t === 'mysql' ? 'MySQL' : 'MariaDB'}
                      </button>
                    ))}
                  </div>

                  {/* Form fields */}
                  <div className="connect-fields">
                    <div className="connect-field-row">
                      <div className="connect-field connect-field--grow">
                        <label className="connect-label">Host</label>
                        <input className="connect-input" placeholder="localhost or your-db.example.com"
                          value={host} onChange={e => setHost(e.target.value)} disabled={status === 'connecting'} />
                      </div>
                      <div className="connect-field connect-field--port">
                        <label className="connect-label">Port</label>
                        <input className="connect-input" placeholder={defaultPort}
                          value={port} onChange={e => setPort(e.target.value)} disabled={status === 'connecting'} />
                      </div>
                    </div>
                    <div className="connect-field">
                      <label className="connect-label">Database</label>
                      <input className="connect-input" placeholder="my_database"
                        value={database} onChange={e => setDatabase(e.target.value)} disabled={status === 'connecting'} />
                    </div>
                    <div className="connect-field-row">
                      <div className="connect-field connect-field--grow">
                        <label className="connect-label">Username</label>
                        <input className="connect-input" placeholder="postgres"
                          value={username} onChange={e => setUsername(e.target.value)} disabled={status === 'connecting'} />
                      </div>
                      <div className="connect-field connect-field--grow">
                        <label className="connect-label">Password</label>
                        <input className="connect-input" type="password" placeholder="••••••••"
                          value={password} onChange={e => setPassword(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleConnect(); }}
                          disabled={status === 'connecting'} />
                      </div>
                    </div>
                  </div>

                  {/* Status feedback */}
                  <AnimatePresence>
                    {status === 'error' && (
                      <motion.div className="connect-status connect-status--error"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {statusMsg}
                      </motion.div>
                    )}
                    {status === 'success' && (
                      <motion.div className="connect-status connect-status--success"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {statusMsg} — {tableCount} tables found
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action */}
                  <div className="connect-form-actions">
                    {status === 'success' ? (
                      <motion.button className="connect-submit-btn connect-submit-btn--success"
                        onClick={handleDone}
                        initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Load My Schema
                      </motion.button>
                    ) : (
                      <motion.button className="connect-submit-btn"
                        onClick={handleConnect}
                        disabled={!canSubmit}
                        whileHover={canSubmit ? { scale: 1.02 } : {}}
                        whileTap={canSubmit ? { scale: 0.97 } : {}}>
                        {status === 'connecting' ? (
                          <><span className="spinner" />Connecting...</>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                            Test & Connect
                          </>
                        )}
                      </motion.button>
                    )}
                    <p className="connect-form-note">
                      QueryMesh is <strong>read-only</strong> — only SELECT + information_schema queries.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="connect-manual-body"
                >
                  <div className="connect-steps">
                    <div className="connect-step">
                      <div className="connect-step-num">1</div>
                      <div className="connect-step-body">
                        <p className="connect-step-title">Edit docker-compose.yml</p>
                        <p className="connect-step-desc">Update the backend environment section with your PostgreSQL credentials.</p>
                        <div className="connect-code-block">
                          <div className="connect-code-header">
                            <span className="connect-code-lang">yaml</span>
                            <CopyBtn text={MANUAL_YAML} />
                          </div>
                          <pre className="connect-code-pre"><code>{MANUAL_YAML}</code></pre>
                        </div>
                      </div>
                    </div>
                    <div className="connect-step">
                      <div className="connect-step-num">2</div>
                      <div className="connect-step-body">
                        <p className="connect-step-title">Restart the stack</p>
                        <p className="connect-step-desc">Run from the QueryMesh project root.</p>
                        <div className="connect-code-block">
                          <div className="connect-code-header">
                            <span className="connect-code-lang">bash</span>
                            <CopyBtn text={RESTART_CMD} />
                          </div>
                          <pre className="connect-code-pre"><code>{RESTART_CMD}</code></pre>
                        </div>
                      </div>
                    </div>
                    <div className="connect-step">
                      <div className="connect-step-num">3</div>
                      <div className="connect-step-body">
                        <p className="connect-step-title">Load Graph</p>
                        <p className="connect-step-desc">Open <strong>localhost:3001</strong> and click Load Graph — your real schema loads automatically.</p>
                        <div className="connect-callout">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Read-only — QueryMesh never modifies your database.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="connect-modal-footer">
                    <p className="connect-footer-note">
                      pg_dump: <code className="connect-inline-code">pg_dump --schema-only -U &lt;user&gt; &lt;db&gt; &gt; schema.sql</code>
                    </p>
                    <button className="connect-close-footer-btn" onClick={onClose}>Got it</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
