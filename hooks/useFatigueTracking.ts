/**
 * useFatigueTracking - Placeholder hook for tracking cognitive fatigue during exam simulation.
 *
 * This is a placeholder for future implementation that will:
 * - Track time spent on each question
 * - Detect patterns of slowing response times
 * - Suggest breaks when fatigue is detected
 * - Integrate with session analytics
 *
 * For now, it logs to console and provides a simple API.
 */

import { useRef, useCallback, useEffect } from 'react';

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
  /** Get current fatigue metrics */
  getMetrics: () => FatigueMetrics;
  /** Reset all tracking for new session */
  reset: () => void;
}

/**
 * Hook for tracking fatigue during exam simulation.
 * @param isExamSimulator - Whether the current mode is an exam simulator (enables tracking)
 */
export function useFatigueTracking(isExamSimulator: boolean = false): FatigueTrackingResult {
  const questionStartTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const questionsAnsweredRef = useRef<number>(0);
  const questionStartTimesRef = useRef<number[]>([]);
  const questionEndTimesRef = useRef<number[]>([]);

  const startQuestion = useCallback(() => {
    if (!isExamSimulator) return;
    const now = Date.now();
    questionStartTimeRef.current = now;
    questionStartTimesRef.current.push(now);
    console.log('[FatigueTracking] Question started at', now);
  }, [isExamSimulator]);

  const endQuestion = useCallback((wasCorrect?: boolean) => {
    if (!isExamSimulator || questionStartTimeRef.current === null) return;
    const now = Date.now();
    const duration = now - questionStartTimeRef.current;
    questionEndTimesRef.current.push(now);
    questionsAnsweredRef.current += 1;
    console.log('[FatigueTracking] Question ended, duration', duration, 'ms, correct?', wasCorrect);
    questionStartTimeRef.current = null;
  }, [isExamSimulator]);

  const recordEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    if (!isExamSimulator) return;
    console.log('[FatigueTracking] Event:', eventType, metadata);
  }, [isExamSimulator]);

  const getMetrics = useCallback((): FatigueMetrics => {
    const totalSessionTime = Date.now() - sessionStartTimeRef.current;
    const questionsAnswered = questionsAnsweredRef.current;
    const averageTimePerQuestion = questionsAnswered > 0
      ? totalSessionTime / questionsAnswered
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
    questionsAnsweredRef.current = 0;
    questionStartTimesRef.current = [];
    questionEndTimesRef.current = [];
    console.log('[FatigueTracking] Reset');
  }, []);

  // Auto-reset when isExamSimulator changes
  useEffect(() => {
    if (isExamSimulator) {
      reset();
    }
  }, [isExamSimulator, reset]);

  return {
    startQuestion,
    endQuestion,
    recordEvent,
    getMetrics,
    reset,
  };
}