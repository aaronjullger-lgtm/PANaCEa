/**
 * useStudyWellness — Detects study patterns and provides wellness signals.
 *
 * Monitors:
 * - Consecutive days studied (reward streaks, detect overwork)
 * - Session length trends (getting shorter = fatigue)
 * - Accuracy decline over time-of-day (already tracked by circadian system)
 * - Break suggestions after continuous study
 *
 * Returns a wellness state object for dashboard and nudge consumption.
 */

import { useMemo } from 'react';

export interface StudySession {
  date: string;          // ISO date
  durationMinutes: number;
  questionsCompleted: number;
  accuracy: number;      // 0-1
  hour: number;          // 0-23, local time
}

export type WellnessLevel = 'thriving' | 'steady' | 'tired' | 'burnout_risk';

export interface WellnessSignal {
  level: WellnessLevel;
  message: string;
  suggestion?: string;
  /** Whether to proactively show this to the user */
  urgent: boolean;
}

export interface WellnessState {
  signal: WellnessSignal;
  consecutiveDays: number;
  averageSessionMinutes: number;
  sessionLengthTrend: 'increasing' | 'stable' | 'decreasing';
  accuracyTrend: 'improving' | 'stable' | 'declining';
  longestSessionToday: number; // minutes
  totalStudyToday: number;    // minutes
}

/**
 * Compute wellness state from recent study sessions.
 *
 * @param recentSessions - Last 14 days of study sessions, newest first
 * @param currentSessionMinutes - Duration of the current active session (if any)
 */
export function useStudyWellness(
  recentSessions: StudySession[],
  currentSessionMinutes: number = 0
): WellnessState {
  return useMemo(() => {
    return computeWellnessState(recentSessions, currentSessionMinutes);
  }, [recentSessions, currentSessionMinutes]);
}

/**
 * Pure function for wellness computation (testable without React).
 */
export function computeWellnessState(
  recentSessions: StudySession[],
  currentSessionMinutes: number = 0
): WellnessState {
  const today = new Date().toISOString().slice(0, 10);

  // Consecutive days studied
  const consecutiveDays = countConsecutiveDays(recentSessions);

  // Session length stats
  const sessionDurations = recentSessions.map(s => s.durationMinutes);
  const averageSessionMinutes = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : 0;

  // Session length trend (compare last 3 days to previous 3 days)
  const sessionLengthTrend = computeTrend(
    recentSessions.filter(s => isWithinDays(s.date, 3)).map(s => s.durationMinutes),
    recentSessions.filter(s => isWithinDays(s.date, 7) && !isWithinDays(s.date, 3)).map(s => s.durationMinutes)
  );

  // Accuracy trend
  const accuracyTrend = computeAccuracyTrend(
    recentSessions.filter(s => isWithinDays(s.date, 3)).map(s => s.accuracy),
    recentSessions.filter(s => isWithinDays(s.date, 7) && !isWithinDays(s.date, 3)).map(s => s.accuracy)
  );

  // Today's study totals
  const todaySessions = recentSessions.filter(s => s.date === today);
  const totalStudyToday = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0) + currentSessionMinutes;
  const longestSessionToday = Math.max(
    currentSessionMinutes,
    ...todaySessions.map(s => s.durationMinutes),
    0
  );

  // Determine wellness level
  const signal = assessWellness({
    consecutiveDays,
    averageSessionMinutes,
    sessionLengthTrend,
    accuracyTrend,
    totalStudyToday,
    longestSessionToday,
    currentSessionMinutes,
  });

  return {
    signal,
    consecutiveDays,
    averageSessionMinutes,
    sessionLengthTrend,
    accuracyTrend,
    longestSessionToday,
    totalStudyToday,
  };
}

function countConsecutiveDays(sessions: StudySession[]): number {
  if (sessions.length === 0) return 0;

  const uniqueDays = [...new Set(sessions.map(s => s.date))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  // Must include today or yesterday to count
  if (uniqueDays[0] !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (uniqueDays[0] !== yesterday) return 0;
  }

  let count = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]!);
    const curr = new Date(uniqueDays[i]!);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.abs(diffDays - 1) < 0.1) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date(Date.now() - days * 86400000);
  return date >= cutoff;
}

function computeTrend(
  recentValues: number[],
  olderValues: number[]
): 'increasing' | 'stable' | 'decreasing' {
  if (recentValues.length === 0 || olderValues.length === 0) return 'stable';

  const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
  const diff = recentAvg - olderAvg;

  if (Math.abs(diff) < olderAvg * 0.1) return 'stable'; // <10% change
  return diff > 0 ? 'increasing' : 'decreasing';
}

function computeAccuracyTrend(
  recentValues: number[],
  olderValues: number[]
): 'improving' | 'stable' | 'declining' {
  if (recentValues.length === 0 || olderValues.length === 0) return 'stable';

  const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
  const diff = recentAvg - olderAvg;

  if (Math.abs(diff) < 0.03) return 'stable'; // <3% accuracy change
  return diff > 0 ? 'improving' : 'declining';
}

interface WellnessInput {
  consecutiveDays: number;
  averageSessionMinutes: number;
  sessionLengthTrend: 'increasing' | 'stable' | 'decreasing';
  accuracyTrend: 'improving' | 'stable' | 'declining';
  totalStudyToday: number;
  longestSessionToday: number;
  currentSessionMinutes: number;
}

function assessWellness(input: WellnessInput): WellnessSignal {
  const {
    consecutiveDays,
    sessionLengthTrend,
    accuracyTrend,
    totalStudyToday,
    longestSessionToday,
    currentSessionMinutes,
  } = input;

  // Burnout risk: high study volume + declining metrics
  if (
    consecutiveDays >= 14 &&
    sessionLengthTrend === 'decreasing' &&
    accuracyTrend === 'declining'
  ) {
    return {
      level: 'burnout_risk',
      message: `${consecutiveDays}-day streak — your sessions are getting shorter and accuracy is slipping.`,
      suggestion: 'Consider a rest day. Research shows spaced breaks improve long-term retention.',
      urgent: true,
    };
  }

  // Tired: long current session or lots of study today
  if (currentSessionMinutes >= 90 || totalStudyToday >= 240) {
    return {
      level: 'tired',
      message: totalStudyToday >= 240
        ? `${Math.round(totalStudyToday / 60)}+ hours today — that's a serious study day.`
        : `${currentSessionMinutes} minutes in this session — time for a break.`,
      suggestion: 'Take a 10-15 minute break. Walk around, hydrate, rest your eyes.',
      urgent: currentSessionMinutes >= 120,
    };
  }

  // Tired: sessions getting shorter (fatigue signal)
  if (sessionLengthTrend === 'decreasing' && accuracyTrend === 'declining') {
    return {
      level: 'tired',
      message: 'Your sessions are getting shorter and accuracy is dipping.',
      suggestion: 'Try shorter, more focused sessions. Quality over quantity.',
      urgent: false,
    };
  }

  // Thriving: good streak with stable or improving metrics
  if (consecutiveDays >= 7 && accuracyTrend !== 'declining') {
    return {
      level: 'thriving',
      message: `${consecutiveDays}-day streak! Consistency is the best predictor of PANCE success.`,
      urgent: false,
    };
  }

  // Default: steady
  return {
    level: 'steady',
    message: consecutiveDays > 0
      ? `Day ${consecutiveDays} — keep it going!`
      : 'Ready to study? Even 10 minutes of active recall helps.',
    urgent: false,
  };
}

export default useStudyWellness;
