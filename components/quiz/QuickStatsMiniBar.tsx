/**
 * Quick Stats Mini-bar
 *
 * A compact, always-visible stats bar showing key session metrics.
 * Unobtrusive but informative - helps maintain awareness of performance.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Clock, Zap } from 'lucide-react';
import type { PerformanceRecord } from '../../types';

interface QuickStatsMiniBarProps {
  performanceData: PerformanceRecord[];
  currentQuestionNumber: number;
  sessionStartTime: number;
  isVisible?: boolean;
}

export const QuickStatsMiniBar: React.FC<QuickStatsMiniBarProps> = ({
  performanceData,
  currentQuestionNumber,
  sessionStartTime,
  isVisible = true,
}) => {
  const stats = useMemo(() => {
    const total = performanceData.length;
    const correct = performanceData.filter((p) => p.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Recent streak
    let streak = 0;
    for (let i = performanceData.length - 1; i >= 0; i--) {
      if (performanceData[i].isCorrect) streak++;
      else break;
    }

    // Session time
    const sessionMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);

    // Questions per minute
    const qpm = sessionMinutes > 0 ? Math.round((total / sessionMinutes) * 10) / 10 : 0;

    return { total, correct, accuracy, streak, sessionMinutes, qpm };
  }, [performanceData, sessionStartTime]);

  if (!isVisible || stats.total < 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-4 py-2 px-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-xs"
    >
      {/* Accuracy */}
      <div className="flex items-center gap-1.5">
        <Target
          className={`w-3.5 h-3.5 ${
            stats.accuracy >= 80
              ? 'text-emerald-500'
              : stats.accuracy >= 60
                ? 'text-amber-500'
                : 'text-red-500'
          }`}
        />
        <span className="font-medium text-slate-600 dark:text-slate-400">{stats.accuracy}%</span>
        <span className="text-slate-400 dark:text-slate-500">
          ({stats.correct}/{stats.total})
        </span>
      </div>

      {/* Streak */}
      {stats.streak >= 2 && (
        <div className="flex items-center gap-1.5 text-emerald-600">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-medium">{stats.streak} streak</span>
        </div>
      )}

      {/* Pace */}
      {stats.qpm > 0 && (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Zap className="w-3.5 h-3.5" />
          <span>{stats.qpm} Q/min</span>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        <span>{stats.sessionMinutes}m</span>
      </div>
    </motion.div>
  );
};

export default QuickStatsMiniBar;
