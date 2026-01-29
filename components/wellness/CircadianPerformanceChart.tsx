/**
 * Circadian Performance Chart
 * Visualizes user performance by time of day
 * Phase 13: Requirement 55
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Sun, Moon, Sunrise, Sunset, BarChart2 } from 'lucide-react';
import type { PerformanceRecord } from '../../types';
import {
  analyzeCircadianPerformance,
  getCircadianInsights,
  formatHour,
} from '@/services/analytics';

interface CircadianPerformanceChartProps {
  performanceRecords: PerformanceRecord[];
}

export const CircadianPerformanceChart: React.FC<CircadianPerformanceChartProps> = ({
  performanceRecords,
}) => {
  const hourlyStats = useMemo(
    () => analyzeCircadianPerformance(performanceRecords),
    [performanceRecords]
  );

  const insights = useMemo(() => getCircadianInsights(performanceRecords), [performanceRecords]);

  if (!insights) {
    return (
      <div className="p-8 text-center text-[var(--color-text-muted)]">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Complete at least 20 questions to see your circadian performance analytics.</p>
      </div>
    );
  }

  const getTimeOfDayIcon = (hour: number) => {
    if (hour >= 6 && hour < 12) return <Sunrise className="w-4 h-4" />;
    if (hour >= 12 && hour < 17) return <Sun className="w-4 h-4" />;
    if (hour >= 17 && hour < 21) return <Sunset className="w-4 h-4" />;
    return <Moon className="w-4 h-4" />;
  };

  const getBarColor = (accuracy: number): string => {
    if (accuracy >= 0.85) return 'bg-[var(--color-data-pass)]';
    if (accuracy >= 0.7) return 'bg-[var(--color-data-provisional)]';
    if (accuracy >= 0.5) return 'bg-[var(--color-accent)]';
    return 'bg-[var(--color-data-fail)]';
  };

  // Filter hours with data
  const hoursWithData = hourlyStats.filter((stat) => stat.totalQuestions > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-8 h-8 text-[var(--color-accent)]" />
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Circadian Performance Analytics
            </h3>
            <p className="text-[var(--color-text-secondary)]">Discover your peak study hours</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Best Time</div>
            <div className="text-lg font-bold text-[var(--color-data-pass)]">
              {insights.bestTimeRange}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              {insights.bestAccuracy.toFixed(0)}% accuracy
            </div>
          </div>
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Average</div>
            <div className="text-lg font-bold text-[var(--color-data-provisional)]">
              {insights.averageAccuracy.toFixed(0)}%
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Overall performance</div>
          </div>
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-4">
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Lowest Time</div>
            <div className="text-lg font-bold text-[var(--color-data-fail)]">
              {insights.worstTimeRange}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              {insights.worstAccuracy.toFixed(0)}% accuracy
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Performance Chart */}
      <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-bold text-[var(--color-text-primary)] mb-6">
          Performance by Hour of Day
        </h4>

        <div className="space-y-3">
          {hoursWithData.map((stat) => (
            <motion.div
              key={stat.hour}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: stat.hour * 0.02 }}
              className="flex items-center gap-3"
            >
              {/* Hour Label */}
              <div className="flex items-center gap-2 w-24">
                {getTimeOfDayIcon(stat.hour)}
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  {formatHour(stat.hour)}
                </span>
              </div>

              {/* Performance Bar */}
              <div className="flex-1 relative">
                <div className="h-8 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.accuracy * 100}%` }}
                    transition={{ duration: 0.8, delay: stat.hour * 0.02 }}
                    className={`h-full ${getBarColor(stat.accuracy)} rounded-full flex items-center justify-end pr-3`}
                  >
                    {stat.accuracy > 0.15 && (
                      <span className="text-xs font-bold text-[var(--color-text-inverse)]">
                        {(stat.accuracy * 100).toFixed(0)}%
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Question Count */}
              <div className="w-16 text-right">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {stat.totalQuestions}Q
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[var(--color-data-pass)] rounded" />
              <span className="text-[var(--color-text-secondary)]">Excellent (85%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[var(--color-data-provisional)] rounded" />
              <span className="text-[var(--color-text-secondary)]">Good (70-84%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[var(--color-accent)] rounded" />
              <span className="text-[var(--color-text-secondary)]">Fair (50-69%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[var(--color-data-fail)] rounded" />
              <span className="text-[var(--color-text-secondary)]">Needs Work (&lt;50%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] rounded-xl p-6 text-[var(--color-text-inverse)]"
      >
        <div className="flex items-start gap-4">
          <TrendingUp className="w-8 h-8 flex-shrink-0" />
          <div>
            <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" /> Personalized Recommendation
            </h4>
            <p className="text-[var(--color-text-inverse)]/90 leading-relaxed">
              {insights.recommendation}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Time Distribution */}
      <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
          Study Session Distribution
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Morning', 'Afternoon', 'Evening', 'Night'].map((period, idx) => {
            const ranges = [
              { start: 6, end: 12 },
              { start: 12, end: 17 },
              { start: 17, end: 21 },
              { start: 21, end: 6 },
            ];
            // Guard: ranges[idx] may be undefined in TypeScript strict mode
            const range = ranges[idx];
            if (!range) return null;

            const periodStats = hourlyStats.filter((s) =>
              range.start < range.end
                ? s.hour >= range.start && s.hour < range.end
                : s.hour >= range.start || s.hour < range.end
            );
            const totalQ = periodStats.reduce((sum, s) => sum + s.totalQuestions, 0);
            const avgAcc =
              totalQ > 0
                ? periodStats.reduce((sum, s) => sum + s.accuracy * s.totalQuestions, 0) / totalQ
                : 0;

            return (
              <div key={period} className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                  {period}
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                  {totalQ}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {avgAcc > 0 ? `${(avgAcc * 100).toFixed(0)}% avg` : 'No data'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CircadianPerformanceChart;
