import { useState, useEffect, useCallback } from 'react';
import { useSpring, useTransform, motion, AnimatePresence } from 'motion/react';
import { IconRefresh, IconScan, IconWrench, IconCamera } from './Icons';

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { isFullscreen, toggle };
}

function IconExpand({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/>
      <polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/>
      <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  );
}

function IconCompress({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/>
      <polyline points="20 10 14 10 14 4"/>
      <line x1="10" y1="14" x2="3" y2="21"/>
      <line x1="21" y1="3" x2="14" y2="10"/>
    </svg>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 90, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  return <motion.span>{display}</motion.span>;
}

interface HeaderProps {
  onLoadGraph: () => void;
  onStartScan: () => void;
  onOpenTools: () => void;
  onOpenDrift: () => void;
  isLoading: boolean;
  isScanning: boolean;
  graphLoaded: boolean;
  totalTables: number;
  totalRelationships: number;
  totalViolations: number;
}

const statsVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const chipVariant = {
  hidden: { opacity: 0, y: -8, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
};

export default function Header({
  onLoadGraph,
  onStartScan,
  onOpenTools,
  onOpenDrift,
  isLoading,
  isScanning,
  graphLoaded,
  totalTables,
  totalRelationships,
  totalViolations,
}: HeaderProps) {
  const { isFullscreen, toggle } = useFullscreen();

  return (
    <header className="app-header">
      {/* Brand */}
      <div className="header-brand">
        <div className="logo">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="10" cy="10" r="2.5" fill="currentColor"/>
              <line x1="10" y1="2" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="12.5" x2="10" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="2" y1="10" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12.5" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="logo-wordmark">Query<span>Mesh</span></span>
        </div>

        <div className="header-divider" />
        <span className="header-tagline">FK Dependency Analyzer</span>
      </div>

      {/* Centered metric readouts */}
      <AnimatePresence>
        {graphLoaded && (
          <motion.div
            className="header-stats"
            variants={statsVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div className="stat-chip" variants={chipVariant}>
              <span className="stat-chip-num"><AnimatedNumber value={totalTables} /></span>
              <span>TABLES</span>
            </motion.div>
            <motion.div className="stat-chip" variants={chipVariant}>
              <span className="stat-chip-num"><AnimatedNumber value={totalRelationships} /></span>
              <span>FK LINKS</span>
            </motion.div>
            <motion.div
              className={`stat-chip ${totalViolations > 0 ? 'chip-danger' : 'chip-ok'}`}
              variants={chipVariant}
            >
              <span className="stat-chip-num"><AnimatedNumber value={totalViolations} /></span>
              <span>VIOLATIONS</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="header-actions">
        <motion.button
          onClick={toggle}
          className="header-btn btn-fullscreen"
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          {isFullscreen ? <IconCompress size={13} /> : <IconExpand size={13} />}
        </motion.button>

        <motion.button
          onClick={onOpenDrift}
          disabled={!graphLoaded}
          className="header-btn btn-camera"
          title="Schema Drift — snapshot & compare"
          aria-label="Schema Drift"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          <IconCamera size={13} />
        </motion.button>

        <motion.button
          onClick={onOpenTools}
          disabled={!graphLoaded}
          className="header-btn btn-tools"
          title="Tools"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          <IconWrench size={13} />
          <span className="btn-label">Tools</span>
        </motion.button>

        <motion.button
          onClick={onLoadGraph}
          disabled={isLoading}
          className={`header-btn btn-secondary ${isLoading ? 'btn-loading' : ''}`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          {isLoading ? (
            <><span className="spinner spinner-dark" /><span className="btn-label">Loading...</span></>
          ) : (
            <><IconRefresh size={13} /><span className="btn-label">{graphLoaded ? 'Refresh' : 'Load Graph'}</span></>
          )}
        </motion.button>

        <motion.button
          onClick={onStartScan}
          disabled={isScanning || !graphLoaded}
          className={`header-btn btn-primary ${isScanning ? 'btn-loading' : ''}`}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          {isScanning ? (
            <><span className="spinner" /><span className="btn-label">Scanning...</span></>
          ) : (
            <><IconScan size={13} /><span className="btn-label">Scan Violations</span></>
          )}
        </motion.button>
      </div>
    </header>
  );
}
