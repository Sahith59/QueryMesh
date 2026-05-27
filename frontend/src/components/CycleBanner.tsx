import { motion } from 'motion/react';
import { IconAlertTriangle, IconX } from './Icons';
import type { CycleInfo } from '../types';

interface CycleBannerProps {
  cycles: CycleInfo[];
  onDismiss: () => void;
  onViewDetails: () => void;
}

export default function CycleBanner({ cycles, onDismiss, onViewDetails }: CycleBannerProps) {
  if (cycles.length === 0) return null;

  const label = cycles.length === 1
    ? '1 circular FK dependency detected'
    : `${cycles.length} circular FK dependencies detected`;

  return (
    <motion.div
      className="cycle-banner"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.8 }}
      style={{ overflow: 'hidden' }}
    >
      <div className="cycle-banner-left">
        <IconAlertTriangle size={13} />
        <span className="cycle-banner-text">{label}</span>
        <button className="cycle-banner-link" onClick={onViewDetails}>
          View details
        </button>
      </div>
      <button className="cycle-banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <IconX size={11} />
      </button>
    </motion.div>
  );
}
