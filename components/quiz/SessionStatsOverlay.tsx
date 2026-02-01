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
  normalizeSystemCode,
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

  // Get system bars for distribution chart - calculated directly from performanceData
  // This ensures single source of truth (no sessionStorage sync issues)
  const systemBars: SystemBar[] = useMemo(() => {
    // Initialize counts for all PANCE systems
    const systemCounts: Record<string, number> = {};
    Object.keys(PANCE_SYSTEM_PERCENTAGES).forEach((s) => (systemCounts[s] = 0));

    // Count occurrences per system from performanceData
    performanceData.forEach((p) => {
      const normalized = normalizeSystemCode(p.topic);
      if (normalized && systemCounts[normalized] !== undefined) {
        systemCounts[normalized]++;
      }
    });

    const total = performanceData.length;

    // Build bars with percentage calculations
    return Object.entries(systemCounts)
      .map(([system, count]) => {
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const target = PANCE_SYSTEM_PERCENTAGES[system] || 0;
        return {
          system,
          name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
          count,
          percent,
          target,
          isOver: percent > target + 5,
          isUnder: percent < target - 5 && count > 0,
        };
      })
      .filter((bar) => bar.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [performanceData]);

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
      <div className="bg-[var(--color-bg-primary)]/95 backdrop-blur-sm rounded-xl shadow-lg border border-[var(--color-border)] overflow-hidden">
        {/* Quick Stats Bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* Question Count */}
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="font-semibold text-[var(--color-text-primary)]">
                Q{currentQuestionNumber}
              </span>
            </div>

            {/* Accuracy */}
            <div className="flex items-center gap-1.5">
              <TrendingUp
                className={`w-4 h-4 ${sessionAccuracy >= 70 ? 'text-[var(--color-data-pass)]' : sessionAccuracy >= 50 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}
              />
              <span
                className={`font-semibold ${sessionAccuracy >= 70 ? 'text-[var(--color-data-pass)]' : sessionAccuracy >= 50 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}
              >
                {sessionAccuracy}%
              </span>
            </div>

            {/* Distribution Score */}
            {summary && (
              <div className="flex items-center gap-1.5">
                <PieChart
                  className={`w-4 h-4 ${summary.distributionScore >= 80 ? 'text-[var(--color-data-pass)]' : summary.distributionScore >= 60 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}
                />
                <span className="text-xs text-action-muted">{summary.distributionScore}</span>
              </div>
            )}
          </div>

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-action-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-action-muted" />
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
              className="border-t border-[var(--color-border)]"
            >
              {/* Performance Section */}
              <div className="p-3 space-y-3">
                {/* Time & Pace */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-action-muted">
                    <Clock className="w-4 h-4" />
                    <span>{summary.sessionDuration} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-action-muted">
                    <Zap className="w-4 h-4" />
                    <span>{summary.questionsPerMinute} Q/min</span>
                  </div>
                </div>

                {/* Accuracy Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg p-2 text-center">
                    <div className="text-xs text-action-muted mb-1">Session</div>
                    <div
                      className={`text-lg font-bold ${sessionAccuracy >= 70 ? 'text-[var(--color-data-pass)]' : sessionAccuracy >= 50 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}
                    >
                      {sessionAccuracy}%
                    </div>
                  </div>
                  <div className="bg-[var(--color-bg-secondary)] rounded-lg p-2 text-center">
                    <div className="text-xs text-action-muted mb-1">Last 10</div>
                    <div
                      className={`text-lg font-bold ${recentAccuracy >= 70 ? 'text-[var(--color-data-pass)]' : recentAccuracy >= 50 ? 'text-[var(--color-data-provisional)]' : 'text-[var(--color-data-fail)]'}`}
                    >
                      {recentAccuracy}%
                    </div>
                  </div>
                </div>

                {/* Distribution Alert */}
                {needsCorrection.length > 0 && (
                  <div className="bg-[var(--color-data-provisional)]/10 rounded-lg p-2 text-sm border border-[var(--color-data-provisional)]/30">
                    <div className="font-medium text-[var(--color-data-provisional)] mb-1">
                      Distribution Drift
                    </div>
                    <div className="text-xs text-[var(--color-data-provisional)]">
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
                  <div className="flex items-center justify-between text-xs text-action-muted">
                    <span>System Distribution</span>
                    <span>Score: {summary.distributionScore}/100</span>
                  </div>

                  <div className="space-y-1">
                    {systemBars.slice(0, 6).map((bar) => (
                      <div key={bar.system} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-action-muted w-10">
                          {bar.system}
                        </span>
                        <div className="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              bar.isOver
                                ? 'bg-[var(--color-data-provisional)]'
                                : bar.isUnder
                                  ? 'bg-[var(--color-accent)]'
                                  : 'bg-[var(--color-data-pass)]'
                            }`}
                            style={{ width: `${Math.min(bar.percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-action-muted w-8 text-right">
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
