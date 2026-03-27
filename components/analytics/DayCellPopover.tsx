/**
 * DayCellPopover Component
 *
 * Mini summary panel that appears when clicking a day cell in the activity heatmap.
 * Shows detailed statistics for the selected day.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export interface DayActivityData {
  date: string; // ISO format
  questionsAnswered: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  avgTimeMs?: number;
  weakestSystem?: string;
  weakestSystemAccuracy?: number;
}

interface DayCellPopoverProps {
  data: DayActivityData | null;
  position?: { x: number; y: number };
  onClose: () => void;
}

/**
 * Format milliseconds to readable time string
 */
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format date to readable string
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DayCellPopover: React.FC<DayCellPopoverProps> = ({ data, position, onClose }) => {
  if (!data) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed z-[60] bg-[var(--color-bg-tertiary)] rounded-xl shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)] overflow-hidden"
        style={{
          left: position ? `${position.x}px` : '50%',
          top: position ? `${position.y}px` : '50%',
          transform: position ? 'translateY(-100%) translateX(-50%)' : 'translate(-50%, -50%)',
          minWidth: '280px',
          maxWidth: '340px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--color-bg-secondary)] px-4 py-3 border-b border-[var(--color-border)]">
          <div className="text-sm font-bold text-[var(--color-text-primary)]">
            {formatDate(data.date)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Day Activity Summary</div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Questions Answered */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[var(--color-accent)]/10 rounded-lg">
              <Target className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-[var(--color-text-muted)]">Questions Answered</div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {data.questionsAnswered}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {data.correct} correct • {data.incorrect} incorrect
              </div>
            </div>
          </div>

          {/* Accuracy */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[var(--color-success)]/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-[var(--color-text-muted)]">Accuracy</div>
              <div
                className={`text-lg font-bold ${
                  data.accuracy >= 80
                    ? 'text-[var(--color-success)]'
                    : data.accuracy >= 60
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-error)]'
                }`}
              >
                {data.accuracy}%
              </div>
            </div>
          </div>

          {/* Average Time per Question */}
          {data.avgTimeMs !== undefined && data.avgTimeMs > 0 && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[var(--color-accent)]/10 rounded-lg">
                <Clock className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-[var(--color-text-muted)]">Avg Time per Question</div>
                <div className="text-lg font-bold text-[var(--color-text-primary)]">
                  {formatTime(data.avgTimeMs)}
                </div>
              </div>
            </div>
          )}

          {/* Weakest System */}
          {data.weakestSystem && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[var(--color-warning)]/10 rounded-lg">
                <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-[var(--color-text-muted)]">Weakest System</div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {data.weakestSystem}
                </div>
                {data.weakestSystemAccuracy !== undefined && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {data.weakestSystemAccuracy}% accuracy
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Close button (click outside also works) */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </motion.div>

      {/* Backdrop */}
      <motion.div
       
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm z-[59]"
        onClick={onClose}
      />
    </AnimatePresence>
  );
};

export default DayCellPopover;
