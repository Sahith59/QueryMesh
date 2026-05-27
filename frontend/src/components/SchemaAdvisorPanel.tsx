import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { SchemaGraph, ViolationAlert, IndexGap, CircularDepsResult } from '../types';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const LS_KEY = 'qm_groq_api_key';

const PRESETS = [
  'What are the biggest risks in my schema?',
  'Which FK violations should I fix first?',
  'How do I safely resolve the circular dependency?',
  'What indexes will improve FK query performance?',
  'Generate SQL to fix all integrity violations',
  'Give me an overall schema health score',
];

interface Props {
  graph: SchemaGraph | null;
  violations: ViolationAlert[];
  indexGaps: IndexGap[];
  circularDeps: CircularDepsResult;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

function buildSystemPrompt(
  graph: SchemaGraph | null,
  violations: ViolationAlert[],
  indexGaps: IndexGap[],
  circularDeps: CircularDepsResult,
): string {
  const tableCount = graph?.totalTables ?? 0;
  const fkCount = graph?.totalRelationships ?? 0;
  const tableNames = graph?.nodes.map(n => n.tableName) ?? [];

  const violationText = violations.length > 0
    ? violations.map(v => `• ${v.table}.${v.column} → ${v.referencedTable}: ${v.orphanedRows} orphaned rows (${v.severity})`).join('\n')
    : 'None detected';

  const gapText = indexGaps.length > 0
    ? indexGaps.map(g => `• ${g.table}.${g.column} → ${g.referencedTable} (~${g.estimatedRows.toLocaleString()} rows, ${g.severity})`).join('\n')
    : 'None';

  const cycleText = circularDeps.hasCycles
    ? circularDeps.cycles.map(c => `• ${c.path.join(' → ')}: ${c.explanation}`).join('\n')
    : 'None';

  return `You are QueryMesh AI, an expert PostgreSQL database schema advisor.

Schema Overview:
- ${tableCount} tables, ${fkCount} FK relationships
- Tables: ${tableNames.join(', ')}

FK Integrity Violations:
${violationText}

Missing FK Indexes:
${gapText}

Circular FK Dependencies:
${cycleText}

Rules: Provide specific, actionable advice. Use **bold** for table names, \`backtick\` for SQL/column names. Keep responses focused (under 350 words). Always reference actual table names from this schema. If asked for SQL, write complete, runnable PostgreSQL.`;
}

async function streamGroq(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: true, max_tokens: 800, temperature: 0.5 }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Groq API error ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const data = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const chunk = data.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch { /* ignore parse errors */ }
    }
  }
}

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|DELETE|INSERT|UPDATE|CREATE|DROP|ALTER|ADD|TABLE|INDEX|ON|NOT|IN|NULL|AND|OR|AS|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|SET|VALUES|REFERENCES|FOREIGN|KEY|PRIMARY|CONSTRAINT|CASCADE|UNIQUE|DEFAULT|CHECK|BEGIN|COMMIT|ROLLBACK|WITH|HAVING|GROUP|BY|ORDER|LIMIT|OFFSET|RETURNING|IF|EXISTS|THEN|END|CASE|WHEN|ELSE|DISTINCT|COUNT|SUM|AVG|MAX|MIN|COALESCE|INTO)\b/g;

function highlightSQL(raw: string): string {
  const safe = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return safe.replace(SQL_KEYWORDS, (kw) => `<span class="sql-kw">${kw}</span>`);
}

function renderCodeBlock(lang: string, code: string): string {
  const highlighted = ['sql', 'postgresql', 'psql', ''].includes(lang.toLowerCase())
    ? highlightSQL(code)
    : code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const label = lang || 'sql';
  return `<div class="advisor-code-block">
<div class="advisor-code-header"><span class="advisor-code-lang">${label}</span><button class="advisor-code-copy" onclick="var c=this.closest('.advisor-code-block').querySelector('code').textContent;navigator.clipboard.writeText(c);this.textContent='✓ Copied';setTimeout(()=>{this.textContent='Copy'},2000)">Copy</button></div>
<pre class="advisor-code-pre"><code class="advisor-code-content">${highlighted}
</code></pre></div>`;
}

function renderInline(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code class="advisor-inline-code">$1</code>')
    .replace(/\*(.*?)\*/gs, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function renderMarkdown(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const fence = /```(\w*)\n?([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(renderInline(text.slice(lastIndex, m.index)));
    parts.push(renderCodeBlock(m[1], m[2].trimEnd()));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(renderInline(text.slice(lastIndex)));
  return parts.join('');
}

export default function SchemaAdvisorPanel({ graph, violations, indexGaps, circularDeps }: Props) {
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GROQ_API_KEY ?? '';
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) ?? envKey);
  const [keyInput, setKeyInput] = useState('');
  const [showKeySetup, setShowKeySetup] = useState(() => !localStorage.getItem(LS_KEY) && !envKey);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveApiKey = useCallback(() => {
    const key = keyInput.trim();
    if (!key) return;
    localStorage.setItem(LS_KEY, key);
    setApiKey(key);
    setShowKeySetup(false);
    setKeyInput('');
  }, [keyInput]);

  const sendMessage = useCallback(async (userContent: string) => {
    if (!apiKey || isStreaming || !userContent.trim()) return;
    setError(null);

    const systemPrompt = buildSystemPrompt(graph, violations, indexGaps, circularDeps);
    const userMsg: Message = { role: 'user', content: userContent };
    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    abortRef.current = new AbortController();

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userContent },
    ];

    try {
      let accumulated = '';
      await streamGroq(apiMessages, apiKey, (chunk) => {
        accumulated += chunk;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
          return next;
        });
      }, abortRef.current.signal);

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: false };
        return next;
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [apiKey, isStreaming, messages, graph, violations, indexGaps, circularDeps]);

  const handlePreset = useCallback((q: string) => { sendMessage(q); }, [sendMessage]);
  const handleSubmit = useCallback((e: React.FormEvent) => { e.preventDefault(); sendMessage(input); }, [input, sendMessage]);
  const handleStop = useCallback(() => { abortRef.current?.abort(); setIsStreaming(false); }, []);
  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  if (showKeySetup) {
    return (
      <div className="advisor-key-setup">
        <motion.div
          className="advisor-key-card"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        >
          <div className="advisor-key-icon-wrap">
            <div className="advisor-key-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                <path d="M12 16v-4m0-4h.01"/>
              </svg>
            </div>
            <div className="advisor-key-glow" />
          </div>
          <h4 className="advisor-key-title">Connect Groq AI</h4>
          <p className="advisor-key-desc">
            Paste your Groq API key to enable AI-powered schema analysis using Llama 3.
          </p>
          <div className="advisor-key-row">
            <input
              className="advisor-key-input"
              type="password"
              placeholder="gsk_..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveApiKey(); }}
              autoFocus
            />
            <motion.button
              className="advisor-key-btn"
              onClick={saveApiKey}
              disabled={!keyInput.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
            >
              Connect
            </motion.button>
          </div>
          <p className="advisor-key-hint">
            Free at <strong>console.groq.com</strong> · Stored in browser only · Never sent to QueryMesh servers
          </p>
        </motion.div>
      </div>
    );
  }

  const hasGraph = graph !== null;

  return (
    <div className="advisor-panel">
      {/* Header bar */}
      <div className="advisor-header">
        <div className="advisor-header-left">
          <div className="advisor-ai-badge">AI</div>
          <span className="advisor-title">Schema Advisor</span>
          <span className="advisor-model-chip">Llama 3 · Groq</span>
        </div>
        <div className="advisor-header-right">
          {messages.length > 0 && (
            <button className="advisor-action-btn" onClick={handleClear}>Clear</button>
          )}
          <button className="advisor-action-btn advisor-action-btn--icon" onClick={() => setShowKeySetup(true)} title="Change API key">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages thread */}
      <div className="advisor-messages">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              key="presets"
              className="advisor-presets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              {!hasGraph && (
                <div className="advisor-no-graph">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  Load a graph first to get schema-aware advice
                </div>
              )}
              <p className="advisor-presets-label">
                {hasGraph ? 'Ask anything about your schema, or try:' : 'Example questions:'}
              </p>
              <div className="advisor-preset-list">
                {PRESETS.map((q, i) => (
                  <motion.button
                    key={q}
                    className="advisor-preset-chip"
                    onClick={() => handlePreset(q)}
                    disabled={isStreaming || !hasGraph}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.22 }}
                    whileHover={hasGraph ? { x: 3, scale: 1.01 } : {}}
                    whileTap={hasGraph ? { scale: 0.97 } : {}}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="advisor-chip-arrow">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    {q}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`advisor-msg advisor-msg--${msg.role}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.26, ease: [0.25, 0, 0.2, 1] }}
            >
              {msg.role === 'user' ? (
                <div className="advisor-bubble-user">{msg.content}</div>
              ) : (
                <div className="advisor-bubble-assistant">
                  {msg.content === '' && msg.streaming ? (
                    <div className="advisor-thinking">
                      <span className="advisor-think-dot" />
                      <span className="advisor-think-dot" />
                      <span className="advisor-think-dot" />
                    </div>
                  ) : (
                    <span
                      className="advisor-msg-text"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.content) + (msg.streaming ? '<span class="advisor-cursor"></span>' : ''),
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="advisor-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form className="advisor-input-row" onSubmit={handleSubmit}>
        <input
          className="advisor-input"
          type="text"
          placeholder={hasGraph ? 'Ask about your schema...' : 'Load graph first to analyze'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isStreaming || !hasGraph}
        />
        <AnimatePresence mode="wait">
          {isStreaming ? (
            <motion.button
              key="stop"
              type="button"
              className="advisor-stop-btn"
              onClick={handleStop}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="submit"
              className="advisor-send-btn"
              disabled={!input.trim() || !hasGraph}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
