import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

interface AlgorithmStatusWidgetProps {
  lastTuned: Date;
  reason: string;
  adjustment: 'tighten' | 'loosen';
}

/**
 * Algorithm Status Widget (Refactored from NeuralLinkLog)
 * Professional, clean "System Notification" card showing AI optimization updates
 */
const AlgorithmStatusWidget: React.FC<AlgorithmStatusWidgetProps> = ({
  lastTuned,
  reason,
  adjustment,
}) => {
  const getNextOptimization = () => {
    const now = new Date();
    const nextOptimization = new Date(lastTuned.getTime() + 14 * 60 * 60 * 1000);
    const diff = nextOptimization.getTime() - now.getTime();

    if (diff <= 0) return 'Processing...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  return (
    <motion.div
      initial={{ y: 20 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[var(--color-accent)]/10 rounded-lg">
          <Brain className="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            Optimization Update
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {lastTuned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-[var(--color-accent)] rounded-full"
        />
      </div>

      {/* Status Message */}
      <div className="space-y-3">
        <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Algorithm adjusted for{' '}
              <span className="font-semibold text-[var(--color-accent)]">{reason}</span> based on
              recent drift.
              {adjustment === 'tighten' ? ' Intervals tightened.' : ' Intervals relaxed.'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="text-center p-2 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Adjustment</p>
            <p
              className={`text-sm font-semibold ${
                adjustment === 'tighten'
                  ? 'text-[var(--color-data-provisional)]'
                  : 'text-[var(--color-data-pass)]'
              }`}
            >
              {adjustment === 'tighten' ? '↑ Tighter' : '↓ Looser'}
            </p>
          </div>
          <div className="text-center p-2 bg-[var(--color-bg-tertiary)] rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Next Update</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {getNextOptimization()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AlgorithmStatusWidget;
