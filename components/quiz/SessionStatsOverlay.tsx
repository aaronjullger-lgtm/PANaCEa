/**
 * Session Stats Overlay
 *
 * Real-time statistics overlay for the main study session.
 * Shows PANCE distribution adherence, progress, and performance metrics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  Award,
  PieChart,
} from 'lucide-react';
import {
  getSessionSummary,
  calculateDistributionDrift,
  PANCE_SYSTEM_PERCENTAGES,
} from '@/services/domain';
import { ABBREVIATION_TO_TOPIC_MAP } from '../../src/constants';

interface SessionStatsOverlayProps {
  performanceData: Array<{ topic: string; correct: boolean }>;
  currentQuestionNumber: number;
  isVisible?: boolean;
  onToggle?: () => void;
}

interface SystemBar {
  system: string;
  name: string;
  count: number;
  percent: number;
  target: number;
  isOver: boolean;
  isUnder: boolean;
}

export const SessionStatsOverlay: React.FC<SessionStatsOverlayProps> = ({
  performanceData,
  currentQuestionNumber,
  isVisible = false,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [summary, setSummary] = useState<ReturnType<typeof getSessionSummary> | null>(null);

  // Refresh stats every time question changes
  useEffect(() => {
    const updateSummary = () => {
      setSummary(getSessionSummary());
    };

    updateSummary();

    // Update every 10 seconds as well
    const interval = setInterval(updateSummary, 10000);
    return () => clearInterval(interval);
  }, [currentQuestionNumber]);

  // Calculate session accuracy
  const sessionAccuracy = useMemo(() => {
    if (performanceData.length === 0) return 0;
    const correct = performanceData.filter((p) => p.correct).length;
    return Math.round((correct / performanceData.length) * 100);
  }, [performanceData]);

  // Calculate recent accuracy (last 10 questions)
  const recentAccuracy = useMemo(() => {
    const recent = performanceData.slice(-10);
    if (recent.length === 0) return 0;
    const correct = recent.filter((p) => p.correct).length;
    return Math.round((correct / recent.length) * 100);
  }, [performanceData]);

  // Get system bars for distribution chart
  const systemBars: SystemBar[] = useMemo(() => {
    if (!summary) return [];

    return summary.systemBreakdown.map((s) => ({
      ...s,
      isOver: s.percent > s.target + 5,
      isUnder: s.percent < s.target - 5,
    }));
  }, [summary]);

  if (!isVisible) return null;

  const drifts = calculateDistributionDrift();
  const needsCorrection = drifts.filter((d) => d.needsCorrection);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 right-4 z-50 w-80"
    >
      {/* Compact Header */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Quick Stats Bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* Question Count */}
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Q{currentQuestionNumber}
              </span>
            </div>

            {/* Accuracy */}
            <div className="flex items-center gap-1.5">
              <TrendingUp
                className={`w-4 h-4 ${sessionAccuracy >= 70 ? 'text-emerald-500' : sessionAccuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}
              />
              <span
                className={`font-semibold ${sessionAccuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' : sessionAccuracy >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {sessionAccuracy}%
              </span>
            </div>

            {/* Distribution Score */}
            {summary && (
              <div className="flex items-center gap-1.5">
                <PieChart
                  className={`w-4 h-4 ${summary.distributionScore >= 80 ? 'text-emerald-500' : summary.distributionScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {summary.distributionScore}
                </span>
              </div>
            )}
          </div>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && summary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-200 dark:border-slate-700"
            >
              {/* Performance Section */}
              <div className="p-3 space-y-3">
                {/* Time & Pace */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>{summary.sessionDuration} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Zap className="w-4 h-4" />
                    <span>{summary.questionsPerMinute} Q/min</span>
                  </div>
                </div>

                {/* Accuracy Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Session</div>
                    <div
                      className={`text-lg font-bold ${sessionAccuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' : sessionAccuracy >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {sessionAccuracy}%
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last 10</div>
                    <div
                      className={`text-lg font-bold ${recentAccuracy >= 70 ? 'text-emerald-600 dark:text-emerald-400' : recentAccuracy >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {recentAccuracy}%
                    </div>
                  </div>
                </div>

                {/* Distribution Alert */}
                {needsCorrection.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-sm">
                    <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                      Distribution Drift
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-500">
                      {needsCorrection.slice(0, 2).map((d) => (
                        <span key={d.system} className="mr-2">
                          {d.system}: {d.driftPercent > 0 ? '+' : ''}
                          {d.driftPercent}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mini Distribution Chart */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>System Distribution</span>
                    <span>Score: {summary.distributionScore}/100</span>
                  </div>

                  <div className="space-y-1">
                    {systemBars.slice(0, 6).map((bar) => (
                      <div key={bar.system} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-10">
                          {bar.system}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              bar.isOver
                                ? 'bg-amber-400'
                                : bar.isUnder
                                  ? 'bg-blue-400'
                                  : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(bar.percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">
                          {bar.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SessionStatsOverlay;
