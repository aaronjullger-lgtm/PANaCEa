/**
 * ProgressRingWidget - Persistent curriculum completion indicator
 *
 * Shows at-a-glance curriculum coverage as a circular progress ring.
 * Floats in top-right corner; expands to detailed breakdown on click.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import type { SystemCode } from '@/types';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface SystemProgress {
  system: SystemCode;
  name: string;
  reviewed: number;
  total: number;
  percent: number;
  accuracy: number;
}

interface ProgressRingWidgetProps {
  /** Overall curriculum completion % (0-100) */
  percent: number;
  /** Per-system breakdown for detail modal */
  systemProgress?: SystemProgress[];
  /** Navigate to system drill */
  onSystemClick?: (system: SystemCode) => void;
  className?: string;
}

/**
 * Calculate ring color based on completion
 */
function getRingColor(percent: number): string {
  if (percent >= 80) return 'var(--color-data-pass)';
  if (percent >= 50) return 'var(--color-accent)';
  return 'var(--color-data-provisional)';
}

/**
 * Floating progress ring (small, persistent)
 */
export const ProgressRingWidget: React.FC<ProgressRingWidgetProps> = ({
  percent,
  systemProgress = [],
  onSystemClick,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const circumference = 2 * Math.PI * 28; // radius = 28
  const strokeDashoffset = circumference - (circumference * percent) / 100;
  const ringColor = getRingColor(percent);

  return (
    <>
      {/* Floating ring button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(true)}
        className={`
          fixed top-20 right-4 z-30
          bg-[var(--color-bg-secondary)] 
          border-2 border-[var(--color-border)]
          rounded-full 
          shadow-lg 
          hover:shadow-xl 
          transition-shadow
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
          ${className}
        `}
        aria-label={`Curriculum progress: ${Math.round(percent)}%`}
      >
        <div className="relative w-16 h-16 p-2">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--color-bg-tertiary)"
              strokeWidth="5"
            />
            {/* Progress circle */}
            <motion.circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>

          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {Math.round(percent)}%
            </span>
          </div>
        </div>
      </motion.button>

      {/* Expanded detail modal */}
      <BottomSheet
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title="Curriculum Progress"
        snapPoints={[0.7, 0.9]}
      >
        <div className="p-6">
          {/* Overall stats */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 relative mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="var(--color-bg-tertiary)"
                  strokeWidth="10"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 * (1 - percent / 100)}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - percent / 100) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold text-[var(--color-text-primary)]">
                  {Math.round(percent)}%
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">Complete</div>
              </div>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
              {percent >= 80
                ? "Excellent progress! You've covered most of the curriculum."
                : percent >= 50
                  ? "You're making solid progress. Keep building your foundation."
                  : 'Early stages - focus on consistent daily practice.'}
            </p>
          </div>

          {/* System breakdown */}
          {systemProgress.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
                System Breakdown
              </h3>
              {systemProgress
                .sort((a, b) => a.percent - b.percent) // Weakest first
                .map((sys) => (
                  <button
                    key={sys.system}
                    onClick={() => {
                      if (onSystemClick) {
                        setIsExpanded(false);
                        onSystemClick(sys.system);
                      }
                    }}
                    className="w-full text-left p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                          {sys.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {sys.reviewed} of {sys.total} conditions reviewed
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            sys.percent >= 80
                              ? 'text-[var(--color-data-pass)]'
                              : sys.percent >= 50
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-data-provisional)]'
                          }`}
                        >
                          {Math.round(sys.percent)}%
                        </span>
                        {onSystemClick && (
                          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-1 transition-all" />
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          sys.percent >= 80
                            ? 'bg-[var(--color-data-pass)]'
                            : sys.percent >= 50
                              ? 'bg-[var(--color-accent)]'
                              : 'bg-[var(--color-data-provisional)]'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${sys.percent}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      />
                    </div>

                    {/* Accuracy badge */}
                    {sys.accuracy > 0 && (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        {Math.round(sys.accuracy * 100)}% accuracy
                      </div>
                    )}
                  </button>
                ))}
            </div>
          )}

          {/* Empty state */}
          {systemProgress.length === 0 && (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              <p className="text-sm">Complete some questions to see system breakdown.</p>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
};

export default ProgressRingWidget;
