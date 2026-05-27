import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from 'motion/react';
import './LandingPage.css';

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const spring = useSpring(inView ? value : 0, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState(0);
  spring.on('change', (v) => setDisplay(Math.round(v)));
  return <span ref={ref}>{display}{suffix}</span>;
}

// ─── Animated schema graph (hero) ────────────────────────────────────────────
const NODES = [
  { id: 'users',    x: 60,  y: 30,  cols: ['id', 'email', 'created_at'] },
  { id: 'orders',   x: 260, y: 20,  cols: ['id', 'user_id', 'total'] },
  { id: 'products', x: 460, y: 50,  cols: ['id', 'name', 'price'] },
  { id: 'order_items', x: 310, y: 170, cols: ['id', 'order_id', 'product_id'] },
  { id: 'reviews',  x: 60,  y: 180, cols: ['id', 'user_id', 'rating'] },
];
const EDGES = [
  { from: 'orders',      to: 'users',    fx: 310, fy: 55,  tx: 160, ty: 55 },
  { from: 'order_items', to: 'orders',   fx: 360, fy: 205, tx: 360, ty: 75 },
  { from: 'order_items', to: 'products', fx: 460, fy: 205, tx: 510, ty: 105 },
  { from: 'reviews',     to: 'users',    fx: 110, fy: 215, tx: 110, ty: 85 },
];

function SchemaGraph() {
  return (
    <svg viewBox="0 0 640 310" className="lp-hero-graph" aria-hidden="true">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#4A7FD4" opacity="0.7" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {EDGES.map((e, i) => (
        <motion.path
          key={e.from + e.to}
          d={`M${e.fx},${e.fy} C${e.fx},${(e.fy + e.ty) / 2} ${e.tx},${(e.fy + e.ty) / 2} ${e.tx},${e.ty}`}
          fill="none"
          stroke="#4A7FD4"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          markerEnd="url(#arrow)"
          opacity={0.55}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          transition={{ duration: 1.2, delay: 0.4 + i * 0.18, ease: [0.25, 0, 0.2, 1] }}
        />
      ))}

      {/* Nodes */}
      {NODES.map((n, i) => (
        <motion.g
          key={n.id}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22, delay: i * 0.12 }}
        >
          <rect
            x={n.x} y={n.y}
            width={160} height={20 + n.cols.length * 18}
            rx="8"
            fill="#EEF0F5"
            style={{ filter: 'drop-shadow(3px 3px 8px rgba(0,0,0,0.12)) drop-shadow(-2px -2px 5px rgba(255,255,255,0.9))' }}
          />
          <rect x={n.x} y={n.y} width={160} height={22} rx="8" fill="#4A7FD4" opacity="0.12" />
          <text x={n.x + 10} y={n.y + 15} fontSize="9" fontWeight="700" fill="#2A3F6F" fontFamily="'Syne', sans-serif" letterSpacing="0.5">
            {n.id.toUpperCase()}
          </text>
          {n.cols.map((c, j) => (
            <text key={c} x={n.x + 14} y={n.y + 32 + j * 18} fontSize="8" fill="#5A6A8A" fontFamily="'DM Sans', sans-serif">
              {c}
            </text>
          ))}
        </motion.g>
      ))}

      {/* Pulse dots on FK columns */}
      {[{ x: 273, y: 60 }, { x: 323, y: 210 }, { x: 383, y: 210 }].map((p, i) => (
        <motion.circle
          key={i} cx={p.x} cy={p.y} r={3}
          fill="#4A7FD4"
          animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0.2, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.7 }}
        />
      ))}
    </svg>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
    title: 'Schema Visualizer',
    desc: 'Interactive FK dependency graph. Pan, zoom, and click any table to explore relationships at a glance.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: 'Constraint Analyzer',
    desc: 'Detect NOT NULL, UNIQUE, and CHECK violations. Drill into any table for a full diagnosis report.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Index Gap Finder',
    desc: 'Spot FK columns with no covering index. Severity-ranked with ready-to-run CREATE INDEX SQL.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    ),
    title: 'Circular FK Detector',
    desc: 'Find and visualize circular foreign key dependencies before they create deletion deadlocks.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Schema Drift Tracker',
    desc: 'Snapshot your schema at any point. Compare two snapshots to see exactly what changed.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: 'AI Schema Advisor',
    desc: 'Ask questions in plain English. Get SQL-level recommendations for indexes, constraints, and structure.',
  },
];

// ─── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', title: 'Connect', desc: 'Enter your PostgreSQL, MySQL, or MariaDB credentials. No restart — QueryMesh hot-swaps connections live.' },
  { num: '02', title: 'Visualize', desc: 'Your schema graph loads instantly. Every table, column, and FK relationship rendered interactively.' },
  { num: '03', title: 'Analyze', desc: 'Run constraint checks, find index gaps, detect cycles, score migrations, and query the AI advisor.' },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'What databases does QueryMesh support?',
    a: 'PostgreSQL, MySQL, and MariaDB — all via live connection. Switch between databases without restarting anything.',
  },
  {
    q: 'Is my data safe? Does QueryMesh modify anything?',
    a: 'QueryMesh is strictly read-only. It only runs SELECT queries and reads information_schema / pg_catalog metadata. Your data is never touched.',
  },
  {
    q: 'How does live connection switching work?',
    a: 'The backend uses Spring\'s HotSwappableTargetSource to atomically swap the active DataSource at runtime. No restart, no downtime — just instant schema switching.',
  },
  {
    q: 'Do I need to install anything on my database server?',
    a: 'Nothing. QueryMesh connects over your normal database port using standard JDBC drivers. No extensions, no agents, no schema changes.',
  },
  {
    q: 'Can I self-host QueryMesh?',
    a: 'Yes — it ships as a Docker Compose stack. Clone the repo, fill in your credentials in docker-compose.yml, and run docker compose up. Or use the live connection form to switch databases without touching config.',
  },
  {
    q: 'What is the AI Schema Advisor?',
    a: 'A Claude-powered chat interface embedded in the app. Ask anything about your schema — "why is this query slow?", "what indexes should I add?", "is this circular FK a problem?" — and get SQL-level answers.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div className="lp-faq-item" layout onClick={() => setOpen(!open)} whileHover={{ scale: 1.005 }}>
      <div className="lp-faq-q">
        <span>{q}</span>
        <motion.span
          className="lp-faq-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="lp-faq-a"
            key="answer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0, 0.2, 1] }}
          >
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Section wrapper with scroll reveal ──────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Feature card with 3D tilt ────────────────────────────────────────────────
function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    el.style.transform = `perspective(600px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg) scale(1.02)`;
  }
  function onMouseLeave() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <motion.div
      ref={ref}
      className="lp-feature-card"
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ type: 'spring', stiffness: 200, damping: 24, delay: index * 0.08 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ transition: 'transform 0.18s ease' }}
    >
      <div className="lp-feature-icon">{feature.icon}</div>
      <h3 className="lp-feature-title">{feature.title}</h3>
      <p className="lp-feature-desc">{feature.desc}</p>
    </motion.div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0, 0.2, 1] as [number,number,number,number] } },
  };

  return (
    <div className="lp-root">
      {/* Background dot grid */}
      <div className="lp-bg-grid" aria-hidden="true" />
      <div className="lp-bg-orb lp-bg-orb--1" aria-hidden="true" />
      <div className="lp-bg-orb lp-bg-orb--2" aria-hidden="true" />

      {/* ── Nav ── */}
      <motion.nav
        className="lp-nav"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0, 0.2, 1] }}
      >
        <div className="lp-nav-logo">
          <div className="lp-nav-logomark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <span className="lp-nav-wordmark">QueryMesh</span>
        </div>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#how-it-works" className="lp-nav-link">How it works</a>
          <a href="#faq" className="lp-nav-link">FAQ</a>
        </div>
        <div className="lp-nav-right">
          <a
            href="https://github.com/Sahith59/QueryMesh"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-github"
            aria-label="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
          </a>
          <motion.button
            className="lp-nav-cta"
            onClick={() => navigate('/app')}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            Launch App
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </motion.button>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="lp-hero" ref={heroRef}>
        <motion.div className="lp-hero-content" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div
            className="lp-hero-badge"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="lp-badge-dot" />
            PostgreSQL · MySQL · MariaDB
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1 className="lp-hero-title" variants={itemVariants}>
              See Your Database
              <br />
              <span className="lp-hero-accent">Schema Clearly</span>
            </motion.h1>

            <motion.p className="lp-hero-sub" variants={itemVariants}>
              QueryMesh is a real-time schema visualizer and analyzer for backend engineers.
              Map FK dependencies, detect constraint violations, find index gaps, and get AI-powered recommendations — all from one interface.
            </motion.p>

            <motion.div className="lp-hero-chips" variants={itemVariants}>
              {[
                {
                  label: 'Read-only safe',
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                },
                {
                  label: 'Live hot-swap',
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
                },
                {
                  label: 'AI-powered',
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                },
                {
                  label: 'No agents needed',
                  icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>,
                },
              ].map(({ icon, label }) => (
                <span key={label} className="lp-hero-chip">{icon}{label}</span>
              ))}
            </motion.div>

            <motion.div className="lp-hero-actions" variants={itemVariants}>
              <motion.button
                className="lp-btn-primary"
                onClick={() => navigate('/app')}
                whileHover={{ scale: 1.04, boxShadow: '8px 8px 24px rgba(74,127,212,0.25), -4px -4px 16px rgba(255,255,255,0.9)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Launch QueryMesh
              </motion.button>
              <motion.a
                className="lp-btn-secondary"
                href="#features"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              >
                Explore Features
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </motion.a>
            </motion.div>
          </motion.div>

        </motion.div>

        {/* Graph preview */}
        <motion.div
          className="lp-hero-graph-wrap"
          initial={{ opacity: 0, x: 40, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0, 0.2, 1] }}
        >
          <SchemaGraph />
          <div className="lp-graph-shimmer" aria-hidden="true" />
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="lp-stats">
        {[
          { val: 3, suffix: '', label: 'Database Types' },
          { val: 6, suffix: '+', label: 'Analysis Tools' },
          { val: 0, suffix: 'ms', label: 'Restart Required' },
          { val: 100, suffix: '%', label: 'Read-Only Safe' },
        ].map(({ val, suffix, label }, i) => (
          <Reveal key={label} delay={i * 0.09} className="lp-stat-card">
            <div className="lp-stat-num">
              <Counter value={val} suffix={suffix} />
            </div>
            <div className="lp-stat-label">{label}</div>
          </Reveal>
        ))}
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <Reveal>
          <div className="lp-section-header">
            <p className="lp-section-eyebrow">What it does</p>
            <h2 className="lp-section-title">Everything your schema needs</h2>
            <p className="lp-section-sub">Six tools in one interface. No plugins, no config, no setup beyond a connection string.</p>
          </div>
        </Reveal>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-section--alt" id="how-it-works">
        <Reveal>
          <div className="lp-section-header">
            <p className="lp-section-eyebrow">Getting started</p>
            <h2 className="lp-section-title">From zero to graph in seconds</h2>
          </div>
        </Reveal>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.12} className="lp-step">
              <div className="lp-step-num">{s.num}</div>
              <div className="lp-step-body">
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && <div className="lp-step-connector" aria-hidden="true" />}
            </Reveal>
          ))}
        </div>

        {/* CTA card */}
        <Reveal delay={0.2}>
          <motion.div
            className="lp-cta-card"
            whileHover={{ scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="lp-cta-card-text">
              <h3>Ready to visualize your schema?</h3>
              <p>Connect any PostgreSQL, MySQL, or MariaDB database — no restart, no friction.</p>
            </div>
            <motion.button
              className="lp-btn-primary"
              onClick={() => navigate('/app')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            >
              Open the App
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </motion.button>
          </motion.div>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section" id="faq">
        <Reveal>
          <div className="lp-section-header">
            <p className="lp-section-eyebrow">Common questions</p>
            <h2 className="lp-section-title">Frequently asked</h2>
          </div>
        </Reveal>
        <div className="lp-faq-list">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-nav-logo">
              <div className="lp-nav-logomark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <span className="lp-nav-wordmark">QueryMesh</span>
            </div>
            <p className="lp-footer-tagline">Built for backend engineers who care about their schema.</p>
          </div>
          <div className="lp-footer-links">
            <button onClick={() => navigate('/app')} className="lp-footer-link">Launch App</button>
            <a href="#features" className="lp-footer-link">Features</a>
            <a href="#faq" className="lp-footer-link">FAQ</a>
            <a
              href="https://github.com/Sahith59/QueryMesh"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-footer-link lp-footer-github"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>Read-only · No data stored · Open source</span>
        </div>
      </footer>
    </div>
  );
}
