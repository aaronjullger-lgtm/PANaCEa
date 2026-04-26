/**
 * Learning Calibration
 *
 * Displays calibration from behavioral signals only. This module intentionally
 * contains no learner-facing rating controls.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

export interface ImplicitCalibrationRecord {
  inferredSignal: number;
  wasCorrect: boolean;
  timestamp: number;
}

interface ConfidenceCalibrationProps {
  records: ImplicitCalibrationRecord[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

type CalibrationBand = 'strong' | 'developing' | 'collecting';

export const ConfidenceCalibration: React.FC<ConfidenceCalibrationProps> = ({
  records,
  isExpanded = false,
  onToggle,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const stats = useMemo(() => {
    if (records.length === 0) return null;

    const buckets: Record<CalibrationBand, { correct: number; total: number }> = {
      strong: { correct: 0, total: 0 },
      developing: { correct: 0, total: 0 },
      collecting: { correct: 0, total: 0 },
    };

    records.forEach((record) => {
      const normalized = Math.max(0, Math.min(1, record.inferredSignal));
      const bucket: CalibrationBand =
        normalized >= 0.72 ? 'strong' : normalized >= 0.42 ? 'developing' : 'collecting';

      buckets[bucket].total++;
      if (record.wasCorrect) buckets[bucket].correct++;
    });

    const getAccuracy = (band: CalibrationBand) => {
      const { correct, total } = buckets[band];
      return total > 0 ? Math.round((correct / total) * 100) : null;
    };

    const stableBuckets = Object.values(buckets).filter((bucket) => bucket.total >= 3);
    const calibrationScore =
      stableBuckets.length > 0
        ? Math.round(
            stableBuckets.reduce((sum, bucket) => sum + (bucket.correct / bucket.total) * 100, 0) /
              stableBuckets.length
          )
        : null;

    return {
      buckets,
      strongAccuracy: getAccuracy('strong'),
      developingAccuracy: getAccuracy('developing'),
      collectingAccuracy: getAccuracy('collecting'),
      calibrationScore,
      total: records.length,
    };
  }, [records]);

  if (!stats || stats.total < 5) {
    return (
      <div className="text-xs text-data-neutral italic">
        Complete {5 - (stats?.total || 0)} more questions to unlock learning calibration.
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-tertiary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-data-neutral" aria-hidden="true" />
            <span className="text-sm font-medium text-data-neutral">Learning Calibration</span>
          </div>
          {stats.calibrationScore !== null && (
            <div
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                stats.calibrationScore >= 75
                  ? 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]'
                  : stats.calibrationScore >= 50
                    ? 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]'
                    : 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]'
              }`}
            >
              {stats.calibrationScore}%
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-data-neutral" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-data-neutral" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-data-neutral pt-3">
              <CalibrationRow
                label="Stable retrieval"
                accuracy={stats.strongAccuracy}
                count={stats.buckets.strong.total}
                color="emerald"
              />
              <CalibrationRow
                label="Developing retrieval"
                accuracy={stats.developingAccuracy}
                count={stats.buckets.developing.total}
                color="amber"
              />
              <CalibrationRow
                label="Needs reinforcement"
                accuracy={stats.collectingAccuracy}
                count={stats.buckets.collecting.total}
                color="slate"
              />

              <div className="pt-2 text-xs text-data-neutral leading-relaxed">
                {stats.calibrationScore !== null && stats.calibrationScore >= 75 ? (
                  <span className="text-[var(--color-data-pass)]">
                    Retrieval signals align well with recent performance.
                  </span>
                ) : stats.collectingAccuracy !== null && stats.collectingAccuracy < 50 ? (
                  <span className="text-[var(--color-data-provisional)]">
                    Slow down on patterns marked for reinforcement before adding new topics.
                  </span>
                ) : (
                  <span className="text-[var(--color-accent)] flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Keep answering to sharpen the next study recommendation.
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CalibrationRow: React.FC<{
  label: string;
  accuracy: number | null;
  count: number;
  color: 'emerald' | 'amber' | 'slate';
}> = ({ label, accuracy, count, color }) => {
  const colorClasses = {
    emerald: 'bg-[var(--color-data-pass)]/10',
    amber: 'bg-[var(--color-data-provisional)]/10',
    slate: 'bg-data-neutral',
  };
  const StatusIcon = accuracy === null ? Minus : accuracy >= 70 ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorClasses[color]}`} />
        <span className="text-sm text-data-neutral">{label}</span>
        <span className="text-xs text-data-neutral">({count})</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIcon className="w-3.5 h-3.5 text-data-neutral" aria-hidden="true" />
        {accuracy !== null ? (
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{accuracy}%</span>
        ) : (
          <span className="text-xs text-data-neutral">Need more data</span>
        )}
      </div>
    </div>
  );
};

export default ConfidenceCalibration;
