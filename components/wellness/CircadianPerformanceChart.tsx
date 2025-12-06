/**
 * Circadian Performance Chart
 * Visualizes user performance by time of day
 * Phase 13: Requirement 55
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import type { PerformanceRecord } from '../../types';
import {
  analyzeCircadianPerformance,
  getCircadianInsights,
  formatHour
} from '../../services/circadianAnalyticsService';

interface CircadianPerformanceChartProps {
  performanceRecords: PerformanceRecord[];
}

export const CircadianPerformanceChart: React.FC<CircadianPerformanceChartProps> = ({
  performanceRecords
}) => {
  const hourlyStats = useMemo(
    () => analyzeCircadianPerformance(performanceRecords),
    [performanceRecords]
  );

  const insights = useMemo(
    () => getCircadianInsights(performanceRecords),
    [performanceRecords]
  );

  if (!insights) {
    return (
      <div className="p-8 text-center text-gray-500">
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
    if (accuracy >= 0.85) return 'bg-green-500';
    if (accuracy >= 0.7) return 'bg-blue-500';
    if (accuracy >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Filter hours with data
  const hoursWithData = hourlyStats.filter(stat => stat.totalQuestions > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Circadian Performance Analytics
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Discover your peak study hours
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Time</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {insights.bestTimeRange}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {insights.bestAccuracy.toFixed(0)}% accuracy
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {insights.averageAccuracy.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Overall performance
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Lowest Time</div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {insights.worstTimeRange}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {insights.worstAccuracy.toFixed(0)}% accuracy
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
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
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatHour(stat.hour)}
                </span>
              </div>

              {/* Performance Bar */}
              <div className="flex-1 relative">
                <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.accuracy * 100}%` }}
                    transition={{ duration: 0.8, delay: stat.hour * 0.02 }}
                    className={`h-full ${getBarColor(stat.accuracy)} rounded-full flex items-center justify-end pr-3`}
                  >
                    {stat.accuracy > 0.15 && (
                      <span className="text-xs font-bold text-white">
                        {(stat.accuracy * 100).toFixed(0)}%
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Question Count */}
              <div className="w-16 text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.totalQuestions}Q
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Excellent (85%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Good (70-84%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Fair (50-69%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Needs Work (&lt;50%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white"
      >
        <div className="flex items-start gap-4">
          <TrendingUp className="w-8 h-8 flex-shrink-0" />
          <div>
            <h4 className="text-lg font-bold mb-2">📊 Personalized Recommendation</h4>
            <p className="text-white/90 leading-relaxed">{insights.recommendation}</p>
          </div>
        </div>
      </motion.div>

      {/* Time Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Study Session Distribution
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Morning', 'Afternoon', 'Evening', 'Night'].map((period, idx) => {
            const ranges = [
              { start: 6, end: 12 },
              { start: 12, end: 17 },
              { start: 17, end: 21 },
              { start: 21, end: 6 }
            ];
            const range = ranges[idx];
            const periodStats = hourlyStats.filter(
              s => (range.start < range.end 
                ? s.hour >= range.start && s.hour < range.end
                : s.hour >= range.start || s.hour < range.end)
            );
            const totalQ = periodStats.reduce((sum, s) => sum + s.totalQuestions, 0);
            const avgAcc = totalQ > 0 
              ? periodStats.reduce((sum, s) => sum + (s.accuracy * s.totalQuestions), 0) / totalQ
              : 0;

            return (
              <div key={period} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {period}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {totalQ}
                </div>
                <div className="text-xs text-gray-500">
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
