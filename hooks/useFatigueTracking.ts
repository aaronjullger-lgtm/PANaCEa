/**
 * useFatigueTracking — Real-time composite fatigue detection hook
 *
 * Tier 3 upgrade: Replaces the placeholder hook with real behavioral signal
 * tracking and composite fatigue scoring via compositeFatigueService.
 *
 * Tracks 4 signals per tier3.md research spec:
 *   1. RT drift — response time trend vs baseline
 *   2. RT variability — trial-to-trial inconsistency
 *   3. Accuracy decline — rolling window vs session baseline
 *   4. Duration factor — time-based sigmoid ramp
 *
 * Returns a CompositeFatigueResult that updates after every answer,
 * enabling the UI to show a session stamina indicator and trigger
 * micro-break suggestions at appropriate fatigue levels.
 *
 * @module hooks/useFatigueTracking
 */

import { useRef, useCallback, useMemo, useState } from 'react';
import {
  computeCompositeFatigue,
  MIN_QUESTIONS,
  type CompositeFatigueResult,
  type CompositeFatigueLevel,
  type SessionDataPoint,
} from '../lib/services/compositeFatigueService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FatigueMetrics {
  /** Total time spent in session (ms) */
  totalSessionTime: number;
  /** Number of questions answered */
  questionsAnswered: number;
  /** Average time per question (ms) */
  averageTimePerQuestion: number;
  /** Timestamps of each question start */
  questionStartTimes: number[];
  /** Timestamps of each question end */
  questionEndTimes: number[];
}

export interface FatigueTrackingResult {
  /** Start tracking a new question */
  startQuestion: () => void;
  /** End tracking the current question (with optional correct flag) */
  endQuestion: (wasCorrect?: boolean) => void;
  /** Record a custom fatigue event (e.g., hesitation, long pause) */
  recordEvent: (eventType: string, metadata?: Record<string, unknown>) => void;
  /** Get current basic fatigue metrics (backward compat) */
  getMetrics: () => FatigueMetrics;
  /** Reset all tracking for new session */
  reset: () => void;
  /** Current composite fatigue assessment (Tier 3) */
  fatigue: CompositeFatigueResult;
  /** Full session data points for external analysis */
  dataPoints: SessionDataPoint[];
  /** Whether composite fatigue tracking is active */
  isTracking: boolean;
}

// ─── Default Result ──────────────────────────────────────────────────────────

const DEFAULT_FATIGUE: CompositeFatigueResult = {
  score: 0,
  level: 'none' as CompositeFatigueLevel,
  signals: { rtDrift: 0, rtVariability: 0, accuracyDecline: 0, durationFactor: 0 },
  reliable: false,
  suggestedBreakMinutes: 0,
  message: null,
  fatigueOnsetIndex: null,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for real-time composite fatigue tracking during study sessions.
 *
 * @param enabled - Whether fatigue tracking is active (default: true for all session types)
 */
export function useFatigueTracking(enabled: boolean = true): FatigueTrackingResult {
  const questionStartTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const dataPointsRef = useRef<SessionDataPoint[]>([]);
  const questionStartTimesRef = useRef<number[]>([]);
  const questionEndTimesRef = useRef<number[]>([]);

  // State triggers re-render when fatigue level changes
  const [fatigue, setFatigue] = useState<CompositeFatigueResult>(DEFAULT_FATIGUE);

  const startQuestion = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    questionStartTimeRef.current = now;
    questionStartTimesRef.current.push(now);
  }, [enabled]);

  const endQuestion = useCallback((wasCorrect?: boolean) => {
    if (!enabled || questionStartTimeRef.current === null) return;

    const now = Date.now();
    const responseTimeMs = now - questionStartTimeRef.current;

    questionEndTimesRef.current.push(now);
    questionStartTimeRef.current = null;

    // Record data point
    const dataPoint: SessionDataPoint = {
      responseTimeMs,
      wasCorrect: wasCorrect ?? false,
      timestamp: now,
    };
    dataPointsRef.current.push(dataPoint);

    // Recompute composite fatigue after every answer
    if (dataPointsRef.current.length >= MIN_QUESTIONS) {
      const result = computeCompositeFatigue(dataPointsRef.current);
      setFatigue(result);
    }
  }, [enabled]);

  const recordEvent = useCallback((_eventType: string, _metadata?: Record<string, unknown>) => {
    // Reserved for future signal types (hesitation, idle time, etc.)
  }, []);

  const getMetrics = useCallback((): FatigueMetrics => {
    const totalSessionTime = Date.now() - sessionStartTimeRef.current;
    const questionsAnswered = dataPointsRef.current.length;
    const averageTimePerQuestion = questionsAnswered > 0
      ? dataPointsRef.current.reduce((sum, d) => sum + d.responseTimeMs, 0) / questionsAnswered
      : 0;
    return {
      totalSessionTime,
      questionsAnswered,
      averageTimePerQuestion,
      questionStartTimes: [...questionStartTimesRef.current],
      questionEndTimes: [...questionEndTimesRef.current],
    };
  }, []);

  const reset = useCallback(() => {
    questionStartTimeRef.current = null;
    sessionStartTimeRef.current = Date.now();
    dataPointsRef.current = [];
    questionStartTimesRef.current = [];
    questionEndTimesRef.current = [];
    setFatigue(DEFAULT_FATIGUE);
  }, []);

  return {
    startQuestion,
    endQuestion,
    recordEvent,
    getMetrics,
    reset,
    fatigue,
    dataPoints: dataPointsRef.current,
    isTracking: enabled,
  };
}
