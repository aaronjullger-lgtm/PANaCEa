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

  // Extract first and last elements with guards
  const firstRecord = sorted[0];
  const lastRecord = sorted[sorted.length - 1];
  if (!firstRecord || !lastRecord) return [];

  const firstDate = new Date(firstRecord.timestamp);
  const lastDate = new Date(lastRecord.timestamp);

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

    const weekKey = weekStart.toISOString().split('T')[0] ?? '';
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    const weekRecords = weekMap.get(weekKey);
    if (weekRecords) {
      weekRecords.push(record);
    }
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
    const monthRecords = monthMap.get(monthKey);
    if (monthRecords) {
      monthRecords.push(record);
    }
  });

  monthMap.forEach((records, monthKey) => {
    const parts = monthKey.split('-');
    const year = Number(parts[0] ?? 0);
    const month = Number(parts[1] ?? 1);
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
    const quarterRecords = quarterMap.get(quarterKey);
    if (quarterRecords) {
      quarterRecords.push(record);
    }
  });

  quarterMap.forEach((records, quarterKey) => {
    const parts = quarterKey.split('-');
    const yearStr = parts[0] ?? '0';
    const qStr = parts[1] ?? 'Q1';
    const quarter = parseInt(qStr.substring(1), 10) || 1;
    const quarterStart = new Date(parseInt(yearStr, 10), (quarter - 1) * 3, 1);
    const quarterEnd = new Date(parseInt(yearStr, 10), quarter * 3, 0); // Last day of quarter

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

  // Extract phase elements with guards for TypeScript
  const lastPhase = phases[phases.length - 1];
  const firstPhase = phases[0];
  const currentMastery = lastPhase?.masteryScore ?? 0;
  const startingMastery = firstPhase?.masteryScore ?? 0;
  const improvement = currentMastery - startingMastery;

  const totalQuestions = phases.reduce((sum, p) => sum + p.questions, 0);

  if (phases.length === 0) {
    return (
      <div className="rounded-lg p-6 text-center bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          Start your journey! Your longitudinal progress will appear here as you study.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-6 bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-[var(--color-accent)]" />
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          Longitudinal Progress
        </h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg p-4 bg-[var(--color-accent)] bg-opacity-10">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[var(--color-accent)]" />
            <span
              className="text-xs font-medium text-[var(--color-text-primary)]"
            >
              Current Mastery
            </span>
          </div>
          <p
            className="text-2xl font-bold text-[var(--color-accent)]"
          >
            {currentMastery}
          </p>
        </div>

        <div className="rounded-lg p-4 bg-[var(--color-data-pass)] bg-opacity-10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp
              className={`w-4 h-4 ${
                improvement >= 0
                  ? 'text-[var(--color-data-pass)]'
                  : 'text-[var(--color-data-fail)]'
              }`}
            />
            <span
              className="text-xs font-medium text-[var(--color-text-primary)]"
            >
              Improvement
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              improvement >= 0
                ? 'text-[var(--color-data-pass)]'
                : 'text-[var(--color-data-fail)]'
            }`}
          >
            {improvement >= 0 ? '+' : ''}
            {improvement}
          </p>
        </div>

        <div className="rounded-lg p-4 bg-[var(--color-accent)] bg-opacity-10">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-[var(--color-accent)]" />
            <span
              className="text-xs font-medium text-[var(--color-text-primary)]"
            >
              Total Questions
            </span>
          </div>
          <p
            className="text-2xl font-bold text-[var(--color-accent)]"
          >
            {totalQuestions}
          </p>
        </div>
      </div>

      {/* Progress Timeline Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)]">
          Mastery Score Over Time
        </h4>
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg p-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {phase.phase}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {phase.questions} questions • {phase.accuracy}% accuracy
                </span>
              </div>
              <div className="relative h-8 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(phase.masteryScore / maxScore) * 100}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] rounded-full flex items-center justify-end pr-2"
                >
                  <span className="text-xs font-bold text-[var(--color-text-inverse)]">
                    {phase.masteryScore}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Motivational Message */}
      <div className="p-4 rounded-lg bg-[var(--color-accent)] bg-opacity-10 border border-[var(--color-border)]">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
          <div>
            <h4 className="font-semibold mb-1 text-[var(--color-text-primary)]">
              Keep Building Your Foundation
            </h4>
            <p className="text-sm text-[var(--color-text-muted)]">
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
