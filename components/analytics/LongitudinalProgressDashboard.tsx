/**
 * Longitudinal Progress Dashboard
 *
 * Tracks mastery scores over the entire educational career
 * (Didactic Year → Clinical Year → PANCE preparation)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Award, Target, Info } from 'lucide-react';
import type { PerformanceRecord, YearInProgram } from '@/types';

interface LongitudinalProgressDashboardProps {
  performanceData: PerformanceRecord[];
  userYearInProgram?: YearInProgram;
  theme?: 'light' | 'dark';
}

interface TimelinePhase {
  phase: string;
  startDate: Date;
  endDate: Date;
  questions: number;
  correct: number;
  accuracy: number;
  masteryScore: number; // Weighted score considering accuracy and volume
}

/**
 * Group performance data into phases based on time periods
 */
function calculateTimelinePhases(performanceData: PerformanceRecord[]): TimelinePhase[] {
  if (performanceData.length === 0) return [];

  // Sort by timestamp
  const sorted = [...performanceData].sort((a, b) => a.timestamp - b.timestamp);

  const firstDate = new Date(sorted[0].timestamp);
  const lastDate = new Date(sorted[sorted.length - 1].timestamp);

  // Calculate the time span in months
  const monthsDiff =
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    (lastDate.getMonth() - firstDate.getMonth());

  // Determine phase division strategy
  let phases: TimelinePhase[] = [];

  if (monthsDiff < 3) {
    // Less than 3 months - weekly phases
    phases = calculateWeeklyPhases(sorted);
  } else if (monthsDiff < 12) {
    // 3-12 months - monthly phases
    phases = calculateMonthlyPhases(sorted);
  } else {
    // Over a year - quarterly phases
    phases = calculateQuarterlyPhases(sorted);
  }

  return phases;
}

/**
 * Calculate weekly phases for short time periods
 */
function calculateWeeklyPhases(sorted: PerformanceRecord[]): TimelinePhase[] {
  const phases: TimelinePhase[] = [];
  const weekMap = new Map<string, PerformanceRecord[]>();

  sorted.forEach((record) => {
    const date = new Date(record.timestamp);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week
    weekStart.setHours(0, 0, 0, 0);

    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(record);
  });

  weekMap.forEach((records, weekKey) => {
    const weekStart = new Date(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const correct = records.filter((r) => r.isCorrect).length;
    const total = records.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    phases.push({
      phase: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      startDate: weekStart,
      endDate: weekEnd,
      questions: total,
      correct,
      accuracy: Math.round(accuracy),
      masteryScore: calculateMasteryScore(correct, total, accuracy),
    });
  });

  return phases.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Calculate monthly phases
 */
function calculateMonthlyPhases(sorted: PerformanceRecord[]): TimelinePhase[] {
  const phases: TimelinePhase[] = [];
  const monthMap = new Map<string, PerformanceRecord[]>();

  sorted.forEach((record) => {
    const date = new Date(record.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(record);
  });

  monthMap.forEach((records, monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // Last day of month

    const correct = records.filter((r) => r.isCorrect).length;
    const total = records.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    phases.push({
      phase: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      startDate: monthStart,
      endDate: monthEnd,
      questions: total,
      correct,
      accuracy: Math.round(accuracy),
      masteryScore: calculateMasteryScore(correct, total, accuracy),
    });
  });

  return phases.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Calculate quarterly phases for long time periods
 */
function calculateQuarterlyPhases(sorted: PerformanceRecord[]): TimelinePhase[] {
  const phases: TimelinePhase[] = [];
  const quarterMap = new Map<string, PerformanceRecord[]>();

  sorted.forEach((record) => {
    const date = new Date(record.timestamp);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const quarterKey = `${date.getFullYear()}-Q${quarter}`;

    if (!quarterMap.has(quarterKey)) {
      quarterMap.set(quarterKey, []);
    }
    quarterMap.get(quarterKey)!.push(record);
  });

  quarterMap.forEach((records, quarterKey) => {
    const [year, q] = quarterKey.split('-');
    const quarter = parseInt(q.substring(1));
    const quarterStart = new Date(parseInt(year), (quarter - 1) * 3, 1);
    const quarterEnd = new Date(parseInt(year), quarter * 3, 0); // Last day of quarter

    const correct = records.filter((r) => r.isCorrect).length;
    const total = records.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    phases.push({
      phase: quarterKey,
      startDate: quarterStart,
      endDate: quarterEnd,
      questions: total,
      correct,
      accuracy: Math.round(accuracy),
      masteryScore: calculateMasteryScore(correct, total, accuracy),
    });
  });

  return phases.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

// Mastery score calculation constants
const MAX_VOLUME_BONUS = 10;
const VOLUME_BONUS_THRESHOLD = 100; // Questions needed for max volume bonus
const CONSISTENCY_BONUS = 5;
const CONSISTENCY_THRESHOLD = 80; // Accuracy percentage for consistency bonus
const MAX_MASTERY_SCORE = 100;

/**
 * Calculate mastery score (weighted by volume and accuracy)
 * Score ranges from 0-100
 */
function calculateMasteryScore(correct: number, total: number, accuracy: number): number {
  if (total === 0) return 0;

  // Base score is accuracy
  let score = accuracy;

  // Volume bonus: diminishing returns after VOLUME_BONUS_THRESHOLD questions
  const volumeBonus = Math.min(
    MAX_VOLUME_BONUS,
    (total / VOLUME_BONUS_THRESHOLD) * MAX_VOLUME_BONUS
  );
  score += volumeBonus;

  // Consistency bonus: if accuracy is consistently high
  if (accuracy >= CONSISTENCY_THRESHOLD) {
    score += CONSISTENCY_BONUS;
  }

  return Math.min(MAX_MASTERY_SCORE, Math.round(score));
}

/**
 * Get the maximum mastery score for scaling
 */
function getMaxMasteryScore(phases: TimelinePhase[]): number {
  if (phases.length === 0) return 100;
  return Math.max(...phases.map((p) => p.masteryScore), 100);
}

export default function LongitudinalProgressDashboard({
  performanceData,
  userYearInProgram,
  theme = 'light',
}: LongitudinalProgressDashboardProps): React.ReactElement {
  const phases = useMemo(() => calculateTimelinePhases(performanceData), [performanceData]);

  const maxScore = useMemo(() => getMaxMasteryScore(phases), [phases]);

  const currentMastery = phases.length > 0 ? phases[phases.length - 1].masteryScore : 0;
  const startingMastery = phases.length > 0 ? phases[0].masteryScore : 0;
  const improvement = currentMastery - startingMastery;

  const totalQuestions = phases.reduce((sum, p) => sum + p.questions, 0);

  if (phases.length === 0) {
    return (
      <div
        className={`rounded-lg p-6 text-center ${
          theme === 'light' ? 'bg-gray-50 text-gray-500' : 'bg-gray-800 text-gray-400'
        }`}
      >
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          Start your journey! Your longitudinal progress will appear here as you study.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-6 ${theme === 'light' ? 'bg-white' : 'bg-gray-900'}`}>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp
          className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}
        />
        <h3 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
          Longitudinal Progress
        </h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-lg p-4 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Target
              className={`w-4 h-4 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}
            />
            <span
              className={`text-xs font-medium ${
                theme === 'light' ? 'text-blue-900' : 'text-blue-100'
              }`}
            >
              Current Mastery
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`}
          >
            {currentMastery}
          </p>
        </div>

        <div className={`rounded-lg p-4 ${theme === 'light' ? 'bg-green-50' : 'bg-green-900/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp
              className={`w-4 h-4 ${
                improvement >= 0
                  ? theme === 'light'
                    ? 'text-green-600'
                    : 'text-green-400'
                  : 'text-red-500'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                theme === 'light' ? 'text-green-900' : 'text-green-100'
              }`}
            >
              Improvement
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              improvement >= 0
                ? theme === 'light'
                  ? 'text-green-600'
                  : 'text-green-400'
                : 'text-red-500'
            }`}
          >
            {improvement >= 0 ? '+' : ''}
            {improvement}
          </p>
        </div>

        <div
          className={`rounded-lg p-4 ${theme === 'light' ? 'bg-purple-50' : 'bg-purple-900/20'}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Award
              className={`w-4 h-4 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}
            />
            <span
              className={`text-xs font-medium ${
                theme === 'light' ? 'text-purple-900' : 'text-purple-100'
              }`}
            >
              Total Questions
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              theme === 'light' ? 'text-purple-600' : 'text-purple-400'
            }`}
          >
            {totalQuestions}
          </p>
        </div>
      </div>

      {/* Progress Timeline Chart */}
      <div className="mb-6">
        <h4
          className={`text-sm font-semibold mb-4 ${
            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
          }`}
        >
          Mastery Score Over Time
        </h4>
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-lg p-3 ${
                theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-800 hover:bg-gray-700'
              } transition-colors`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-medium ${
                    theme === 'light' ? 'text-gray-900' : 'text-white'
                  }`}
                >
                  {phase.phase}
                </span>
                <span
                  className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}
                >
                  {phase.questions} questions • {phase.accuracy}% accuracy
                </span>
              </div>
              <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(phase.masteryScore / maxScore) * 100}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-end pr-2"
                >
                  <span className="text-xs font-bold text-white">{phase.masteryScore}</span>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Motivational Message */}
      <div
        className={`p-4 rounded-lg ${
          theme === 'light'
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
            : 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800'
        }`}
      >
        <div className="flex items-start gap-2">
          <Info
            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`}
          />
          <div>
            <h4
              className={`font-semibold mb-1 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}
            >
              Keep Building Your Foundation
            </h4>
            <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
              The effort you put in months ago is still contributing to your overall PANCE
              readiness.
              {userYearInProgram === 'Clinical Year' &&
                ' Your didactic foundation continues to strengthen your clinical performance.'}
              {userYearInProgram === 'Preparing for PANCE' &&
                " Every session builds on the comprehensive knowledge base you've developed throughout your journey."}
              {!userYearInProgram && ' Each study session adds to your growing mastery.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
