/**
 * Streak Visualization Component
 *
 * Shows a visual timeline of answer streaks during the session.
 * Helps identify patterns of focus and when errors cluster.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Target } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PerformanceRecord } from '../../types';

interface StreakVisualizationProps {
  performanceData: PerformanceRecord[];
  maxDisplay?: number;
}

interface StreakSegment {
  type: 'correct' | 'incorrect';
  count: number;
  startIndex: number;
}

export const StreakVisualization: React.FC<StreakVisualizationProps> = ({
  performanceData,
  maxDisplay = 50,
}) => {
  const prefersReducedMotion = useReducedMotion();
  // Calculate streak segments
  const { segments, stats } = useMemo(() => {
    if (performanceData.length === 0) {
      return { segments: [], stats: { maxStreak: 0, avgStreak: 0, totalStreaks: 0 } };
    }

    const segs: StreakSegment[] = [];
    const firstRecord = performanceData[0];
    if (!firstRecord) {
      return { segments: [], stats: { maxStreak: 0, avgStreak: 0, totalStreaks: 0 } };
    }
    let currentType: 'correct' | 'incorrect' = firstRecord.isCorrect ? 'correct' : 'incorrect';
    let currentCount = 1;
    let startIndex = 0;

    for (let i = 1; i < performanceData.length; i++) {
      const record = performanceData[i];
      if (!record) continue;
      const isCorrect = record.isCorrect;
      const type = isCorrect ? 'correct' : 'incorrect';

      if (type === currentType) {
        currentCount++;
      } else {
        segs.push({ type: currentType, count: currentCount, startIndex });
        currentType = type;
        currentCount = 1;
        startIndex = i;
      }
    }
    // Don't forget the last segment
    segs.push({ type: currentType, count: currentCount, startIndex });

    // Calculate stats
    const correctStreaks = segs.filter((s) => s.type === 'correct');
    const maxStreak =
      correctStreaks.length > 0 ? Math.max(...correctStreaks.map((s) => s.count)) : 0;
    const avgStreak =
      correctStreaks.length > 0
        ? Math.round(
            (correctStreaks.reduce((s, seg) => s + seg.count, 0) / correctStreaks.length) * 10
          ) / 10
        : 0;

    return {
      segments: segs,
      stats: { maxStreak, avgStreak, totalStreaks: correctStreaks.length },
    };
  }, [performanceData]);

  if (performanceData.length === 0) {
    return null;
  }

  // Take only the last N questions for display
  const displayData = performanceData.slice(-maxDisplay);

  return (
    <div className="space-y-3">
      {/* Stats Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[var(--color-data-provisional)]" />
            <span className="text-[var(--color-text-muted)]">
              Best:{' '}
              <span className="font-semibold text-[var(--color-data-provisional)]">
                {stats.maxStreak}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[var(--color-data-provisional)]" />
            <span className="text-[var(--color-text-muted)]">
              Avg: <span className="font-semibold">{stats.avgStreak}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-[var(--color-text-muted)]">
              Streaks: <span className="font-semibold">{stats.totalStreaks}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Background grid */}
        <div className="flex gap-0.5 p-2 bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden">
          {displayData.map((record, i) => (
            <motion.div
              key={i}
              initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { delay: i * 0.02, duration: 0.15 }
              }
              className={`flex-1 min-w-[4px] max-w-[12px] h-6 rounded-sm ${
                record.isCorrect ? 'bg-[var(--color-data-pass)]' : 'bg-[var(--color-data-fail)]'
              }`}
              title={`Q${performanceData.length - displayData.length + i + 1}: ${record.isCorrect ? 'Correct' : 'Incorrect'} - ${record.topic || 'Unknown'}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[var(--color-data-pass)]" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-[var(--color-data-fail)]" />
            <span>Incorrect</span>
          </div>
        </div>
      </div>

      {/* Streak breakdown (if there are interesting patterns) */}
      {stats.maxStreak >= 5 && (
        <div className="p-2 bg-[var(--color-data-provisional)]/10 rounded-lg border border-[var(--color-data-provisional)]/30">
          <div className="flex items-center gap-2 text-sm text-[var(--color-data-provisional)]">
            <Flame className="w-4 h-4" />
            <span>
              {stats.maxStreak >= 10
                ? `Amazing! ${stats.maxStreak}-question streak shows excellent focus!`
                : `Great ${stats.maxStreak}-question streak! Keep building momentum.`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact streak indicator for inline use
 */
export const StreakBadge: React.FC<{
  streak: number;
  isActive?: boolean;
}> = ({ streak, isActive = false }) => {
  const prefersReducedMotion = useReducedMotion();
  if (streak < 2) return null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        streak >= 10
          ? 'bg-[var(--color-data-provisional)]/20 text-[var(--color-data-provisional)]'
          : streak >= 5
            ? 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)]'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
      } ${isActive ? 'ring-2 ring-offset-1 ring-[var(--color-data-provisional)]' : ''}`}
    >
      <Flame className={`w-3 h-3 ${isActive ? 'animate-pulse' : ''}`} />
      <span>{streak}</span>
    </motion.div>
  );
};

export default StreakVisualization;
