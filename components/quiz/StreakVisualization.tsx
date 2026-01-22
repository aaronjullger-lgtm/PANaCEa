/**
 * Streak Visualization Component
 *
 * Shows a visual timeline of answer streaks during the session.
 * Helps identify patterns of focus and when errors cluster.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Target } from 'lucide-react';
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
    let currentType: 'correct' | 'incorrect' = firstRecord.isCorrect
      ? 'correct'
      : 'incorrect';
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
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-slate-600 dark:text-slate-400">
              Best:{' '}
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {stats.maxStreak}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-slate-600 dark:text-slate-400">
              Avg: <span className="font-semibold">{stats.avgStreak}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-slate-600 dark:text-slate-400">
              Streaks: <span className="font-semibold">{stats.totalStreaks}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="relative">
        {/* Background grid */}
        <div className="flex gap-0.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg overflow-hidden">
          {displayData.map((record, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.02, duration: 0.15 }}
              className={`flex-1 min-w-[4px] max-w-[12px] h-6 rounded-sm ${
                record.isCorrect
                  ? 'bg-emerald-400 dark:bg-emerald-500'
                  : 'bg-red-400 dark:bg-red-500'
              }`}
              title={`Q${performanceData.length - displayData.length + i + 1}: ${record.isCorrect ? 'Correct' : 'Incorrect'} - ${record.topic || 'Unknown'}`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-emerald-400" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-400" />
            <span>Incorrect</span>
          </div>
        </div>
      </div>

      {/* Streak breakdown (if there are interesting patterns) */}
      {stats.maxStreak >= 5 && (
        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
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
  if (streak < 2) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        streak >= 10
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
          : streak >= 5
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
      } ${isActive ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
    >
      <Flame className={`w-3 h-3 ${isActive ? 'animate-pulse' : ''}`} />
      <span>{streak}</span>
    </motion.div>
  );
};

export default StreakVisualization;