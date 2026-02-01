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

export default function LongitudinalProgressDashboard({
  performanceData,
  userYearInProgram,
  theme = 'light',
}: LongitudinalProgressDashboardProps): React.ReactElement {
  const phases = useMemo(() => calculateTimelinePhases(performanceData), [performanceData]);

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

      {/* Mastery Score Over Time - Sparkline (static data viz, not interactive) */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-4 text-[var(--color-text-secondary)]">
          Mastery Score Over Time
        </h4>
        <div className="rounded-lg p-4 bg-[var(--color-bg-secondary)]">
          <svg
            viewBox="0 0 400 120"
            className="w-full h-24"
            role="img"
            aria-label="Mastery score trend over time"
          >
            <defs>
              <linearGradient id="sparklineGradient" x1="0" x2="0" y1="1" y2="0">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {phases.length >= 1 &&
              (() => {
                const padding = { top: 8, right: 8, bottom: 24, left: 36 };
                const width = 400 - padding.left - padding.right;
                const height = 120 - padding.top - padding.bottom;
                const scores = phases.map((p) => p.masteryScore);
                const minScore = Math.min(...scores, 0);
                const maxScoreVal = Math.max(...scores, 1);
                const range = maxScoreVal - minScore || 1;
                const step = phases.length > 1 ? width / (phases.length - 1) : 0;
                const points = phases.map((phase, i) => {
                  const x = padding.left + (phases.length > 1 ? i * step : width / 2);
                  const y =
                    padding.top +
                    height -
                    ((phase.masteryScore - minScore) / range) * height;
                  return { x, y, phase };
                });
                const linePath =
                  points.length > 0
                    ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
                    : '';
                const areaPath =
                  points.length > 1
                    ? `M ${padding.left},${padding.top + height} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${padding.left + width},${padding.top + height} Z`
                    : '';

                return (
                  <>
                    {areaPath && (
                      <path
                        d={areaPath}
                        fill="url(#sparklineGradient)"
                        aria-hidden
                      />
                    )}
                    {linePath && (
                      <motion.path
                        d={linePath}
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        aria-hidden
                      />
                    )}
                    {points.map(({ x, y, phase: p }, i) => (
                      <motion.circle
                        key={p.phase}
                        cx={x}
                        cy={y}
                        r={4}
                        fill="var(--color-accent)"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                        aria-hidden
                      />
                    ))}
                  </>
                );
              })()}
          </svg>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 mt-2 text-xs text-[var(--color-text-muted)]">
            {phases.map((phase) => (
              <span key={phase.phase}>
                {phase.phase}: {phase.masteryScore}
              </span>
            ))}
          </div>
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
