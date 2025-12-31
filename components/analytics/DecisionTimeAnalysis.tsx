/**
 * Decision Time Analysis Component
 * 
 * Tracks and visualizes time spent on each question category.
 * Provides AI-powered insights on knowledge gaps based on decision time patterns.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, AlertCircle, Brain } from 'lucide-react';
import type { PerformanceRecord, SystemCode } from '@/types';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';

interface DecisionTimeAnalysisProps {
  performanceData: PerformanceRecord[];
  theme?: 'light' | 'dark';
}

interface CategoryTimeStats {
  system: SystemCode;
  systemName: string;
  avgTimeSeconds: number;
  totalQuestions: number;
  accuracy: number;
  insight: string;
}

/**
 * Calculate average time and accuracy per system/category
 */
function calculateCategoryTimeStats(
  performanceData: PerformanceRecord[]
): CategoryTimeStats[] {
  // Filter records with time data
  const recordsWithTime = performanceData.filter(
    (r) => r.timeSpentMs !== undefined && r.system && r.system !== 'OTHER'
  );

  if (recordsWithTime.length === 0) return [];

  // Group by system
  const systemMap = new Map<
    SystemCode,
    { totalTime: number; count: number; correct: number }
  >();

  for (const record of recordsWithTime) {
    const system = record.system!;
    const existing = systemMap.get(system) || {
      totalTime: 0,
      count: 0,
      correct: 0,
    };
    systemMap.set(system, {
      totalTime: existing.totalTime + (record.timeSpentMs || 0),
      count: existing.count + 1,
      correct: existing.correct + (record.isCorrect ? 1 : 0),
    });
  }

  // Calculate stats and generate insights
  const stats: CategoryTimeStats[] = [];
  const avgTimesArray: number[] = [];

  systemMap.forEach((data, system) => {
    const avgTimeMs = data.totalTime / data.count;
    avgTimesArray.push(avgTimeMs);
  });

  // Calculate median time for comparison
  const sortedTimes = [...avgTimesArray].sort((a, b) => a - b);
  const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)] || 0;

  systemMap.forEach((data, system) => {
    const avgTimeMs = data.totalTime / data.count;
    const avgTimeSeconds = Math.round(avgTimeMs / 1000);
    const accuracy = Math.round((data.correct / data.count) * 100);
    
    // Generate AI insight
    let insight = '';
    const timeRatio = avgTimeMs / medianTime;
    
    if (timeRatio > 1.5 && accuracy >= 70) {
      insight = `You spend ${avgTimeSeconds}s on average, well above median. This suggests a knowledge gap in ${ABBREVIATION_TO_TOPIC_MAP[system]}, even though your accuracy is ${accuracy}%.`;
    } else if (timeRatio > 1.5 && accuracy < 70) {
      insight = `High decision time (${avgTimeSeconds}s) with ${accuracy}% accuracy. Consider focused review of ${ABBREVIATION_TO_TOPIC_MAP[system]} fundamentals.`;
    } else if (timeRatio < 0.7 && accuracy >= 80) {
      insight = `Excellent! Quick decisions (${avgTimeSeconds}s) with ${accuracy}% accuracy shows strong mastery of ${ABBREVIATION_TO_TOPIC_MAP[system]}.`;
    } else if (timeRatio < 0.7 && accuracy < 70) {
      insight = `Fast but inaccurate (${avgTimeSeconds}s, ${accuracy}%). You may be rushing through ${ABBREVIATION_TO_TOPIC_MAP[system]} questions.`;
    } else {
      insight = `Balanced performance: ${avgTimeSeconds}s average with ${accuracy}% accuracy in ${ABBREVIATION_TO_TOPIC_MAP[system]}.`;
    }

    stats.push({
      system,
      systemName: ABBREVIATION_TO_TOPIC_MAP[system] || system,
      avgTimeSeconds,
      totalQuestions: data.count,
      accuracy,
      insight,
    });
  });

  // Sort by average time (descending)
  return stats.sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds);
}

/**
 * Format seconds to readable time string
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

/**
 * Get color based on time performance
 */
function getTimeColor(
  seconds: number,
  median: number,
  theme: 'light' | 'dark' = 'light'
): string {
  const ratio = seconds / median;
  if (ratio > 1.5) return theme === 'light' ? '#ef4444' : '#f87171'; // Red
  if (ratio < 0.7) return theme === 'light' ? '#10b981' : '#34d399'; // Green
  return theme === 'light' ? '#f59e0b' : '#fbbf24'; // Amber
}

export default function DecisionTimeAnalysis({
  performanceData,
  theme = 'light',
}: DecisionTimeAnalysisProps): React.ReactElement {
  const stats = useMemo(
    () => calculateCategoryTimeStats(performanceData),
    [performanceData]
  );

  const medianTime = useMemo(() => {
    if (stats.length === 0) return 0;
    const sortedTimes = [...stats]
      .map((s) => s.avgTimeSeconds)
      .sort((a, b) => a - b);
    
    // Correct median calculation for even-length arrays
    const mid = Math.floor(sortedTimes.length / 2);
    if (sortedTimes.length % 2 === 0) {
      return (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;
    }
    return sortedTimes[mid];
  }, [stats]);

  if (stats.length === 0) {
    return (
      <div
        className={`rounded-lg p-6 text-center ${
          theme === 'light'
            ? 'bg-gray-50 text-gray-500'
            : 'bg-gray-800 text-gray-400'
        }`}
      >
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          No timing data available yet. Time tracking will begin with your next
          study session.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-6 ${
        theme === 'light' ? 'bg-white' : 'bg-gray-900'
      }`}
    >
      <div className="flex items-center gap-2 mb-6">
        <Clock
          className={`w-6 h-6 ${
            theme === 'light' ? 'text-blue-600' : 'text-blue-400'
          }`}
        />
        <h3
          className={`text-xl font-bold ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}
        >
          Decision Time Analysis
        </h3>
      </div>

      <div className="space-y-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.system}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-lg p-4 ${
              theme === 'light'
                ? 'bg-gray-50 hover:bg-gray-100'
                : 'bg-gray-800 hover:bg-gray-700'
            } transition-colors`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    className={`font-semibold ${
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}
                  >
                    {stat.systemName}
                  </h4>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      theme === 'light'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-900 text-blue-300'
                    }`}
                  >
                    {stat.totalQuestions} questions
                  </span>
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" style={{ 
                      color: getTimeColor(stat.avgTimeSeconds, medianTime, theme) 
                    }} />
                    <span
                      className="font-mono text-lg font-bold"
                      style={{
                        color: getTimeColor(stat.avgTimeSeconds, medianTime, theme),
                      }}
                    >
                      {formatTime(stat.avgTimeSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp
                      className={`w-4 h-4 ${
                        stat.accuracy >= 70
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        stat.accuracy >= 70
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {stat.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insight */}
            <div
              className={`flex items-start gap-2 p-3 rounded-md ${
                theme === 'light'
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-blue-900/20 border border-blue-800'
              }`}
            >
              <Brain
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`}
              />
              <p
                className={`text-sm ${
                  theme === 'light' ? 'text-blue-900' : 'text-blue-100'
                }`}
              >
                <span className="font-semibold">AI Insight: </span>
                {stat.insight}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary Statistics */}
      <div
        className={`mt-6 p-4 rounded-lg ${
          theme === 'light'
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
            : 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle
            className={`w-5 h-5 ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`}
          />
          <h4
            className={`font-semibold ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}
          >
            Key Takeaway
          </h4>
        </div>
        <p
          className={`text-sm ${
            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
          }`}
        >
          Median decision time: <span className="font-bold">{formatTime(medianTime)}</span>
          . Categories where you spend significantly more time may indicate knowledge gaps
          requiring focused review, even if your accuracy appears acceptable.
        </p>
      </div>
    </div>
  );
}
