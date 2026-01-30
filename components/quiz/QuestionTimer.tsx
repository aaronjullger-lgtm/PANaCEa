/**
 * Question Timer Bar
 *
 * A professional, unobtrusive timer that shows time spent on current question.
 * Changes color based on par time for question complexity.
 * Helps develop proper pacing for the real PANCE.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertCircle } from 'lucide-react';

interface QuestionTimerProps {
  /** When the current question started (timestamp) */
  startTime: number;
  /** Expected time for this question in ms (based on complexity) */
  parTimeMs?: number;
  /** Whether the question has been answered */
  isAnswered: boolean;
  /** Whether to show the timer (user preference) */
  isVisible?: boolean;
  /** Compact mode - just shows time, no bar */
  compact?: boolean;
}

// Default par time: 72 seconds (PANCE average)
const DEFAULT_PAR_TIME_MS = 72000;

// Time thresholds as percentages of par time
const THRESHOLDS = {
  good: 0.75, // Under 75% of par = good pace
  warning: 1.0, // At par = warning
  overtime: 1.5, // Over 150% = overtime
};

export const QuestionTimer: React.FC<QuestionTimerProps> = ({
  startTime,
  parTimeMs = DEFAULT_PAR_TIME_MS,
  isAnswered,
  isVisible = true,
  compact = false,
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isAnswered) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isAnswered]);

  // Final elapsed time when answered
  const finalElapsed = isAnswered ? elapsed : Date.now() - startTime;

  const { formattedTime, progressPercent, status, statusColor } = useMemo(() => {
    const seconds = Math.floor(finalElapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formatted =
      minutes > 0 ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}` : `${seconds}s`;

    const progress = Math.min((finalElapsed / parTimeMs) * 100, 100);
    const ratio = finalElapsed / parTimeMs;

    let timerStatus: 'good' | 'warning' | 'overtime' = 'good';
    let color = 'text-[var(--color-data-pass)] bg-[var(--color-data-pass)]';

    if (ratio >= THRESHOLDS.overtime) {
      timerStatus = 'overtime';
      color = 'text-[var(--color-data-fail)] bg-[var(--color-data-fail)]';
    } else if (ratio >= THRESHOLDS.warning) {
      timerStatus = 'warning';
      color = 'text-[var(--color-data-provisional)] bg-[var(--color-data-provisional)]';
    }

    return {
      formattedTime: formatted,
      progressPercent: progress,
      status: timerStatus,
      statusColor: color,
    };
  }, [finalElapsed, parTimeMs]);

  if (!isVisible) return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-sm font-medium ${statusColor.split(' ')[0]}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs">
      {/* Timer display */}
      <div className="flex items-center justify-between mb-1">
        <div
          className={`flex items-center gap-1.5 text-sm font-medium ${statusColor.split(' ')[0]}`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedTime}</span>
        </div>

        {status === 'overtime' && !isAnswered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-xs text-[var(--color-data-fail)]"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Over time</span>
          </motion.div>
        )}

        {isAnswered && (
          <span className="text-xs text-action-muted">Par: {Math.round(parTimeMs / 1000)}s</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.1 }}
          className={`h-full rounded-full ${statusColor.split(' ')[1]}`}
        />
      </div>
    </div>
  );
};

export default QuestionTimer;
