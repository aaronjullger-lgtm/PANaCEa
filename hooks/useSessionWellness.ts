/**
 * useSessionWellness Hook
 *
 * Mid-session wellness monitoring that detects diminishing returns
 * without lecturing the student about self-care. Wraps the pure
 * wellnessEngine functions for React component consumption.
 *
 * Usage: Call `recordAttempt()` after each answer. The hook maintains
 * a rolling window and returns `shouldStop`, `message`, and `stats`.
 *
 * @module hooks/useSessionWellness
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  detectDiminishingReturns,
  detectProactiveFatigue,
  type SessionAttempt,
  type SessionWellnessCheck,
  type SessionStats,
  type ProactiveFatigueCheck,
} from '@/lib/services/wellnessEngine';

export interface UseSessionWellnessReturn {
  /** Record an attempt — call after each answer */
  recordAttempt: (wasCorrect: boolean, responseTimeMs: number) => void;
  /** Current wellness check result */
  check: SessionWellnessCheck;
  /** Proactive fatigue check — early warning before shouldStop fires */
  fatigue: ProactiveFatigueCheck;
  /** Whether the user has dismissed the stop suggestion */
  dismissed: boolean;
  /** Whether the user has dismissed the proactive break nudge */
  breakDismissed: boolean;
  /** Dismiss the stop suggestion (user chose to continue) */
  dismiss: () => void;
  /** Dismiss the proactive break suggestion */
  dismissBreak: () => void;
  /** Number of attempts since last wellness nudge */
  attemptsSinceNudge: number;
  /** Whether the user is currently on a timed break */
  onBreak: boolean;
  /** Start a timed break (minutes) */
  startBreak: (minutes: number) => void;
  /** End the break early (user returned) */
  endBreak: () => void;
  /** Remaining break seconds (0 when not on break) */
  breakSecondsLeft: number;
  /** Reset the session (e.g., when starting a new one) */
  reset: () => void;
}

const RECHECK_INTERVAL = 5; // Re-evaluate every N questions after a dismissal
const BREAK_RECHECK_INTERVAL = 8; // Re-evaluate proactive break after more questions

const EMPTY_CHECK: SessionWellnessCheck = {
  shouldStop: false,
  reason: null,
  stats: {
    questionsAnswered: 0,
    accuracy: 0,
    accuracyDrop: 0,
    avgResponseTimeMs: 0,
    timeIncreaseRatio: 0,
    sessionDurationMinutes: 0,
  },
  message: 'Starting session...',
};

const EMPTY_FATIGUE: ProactiveFatigueCheck = {
  fatigueLevel: 'fresh',
  recentAccuracy: NaN,
  recentRtSlope: 0,
  nudgeMessage: null,
  suggestedBreakMinutes: 0,
};

export function useSessionWellness(): UseSessionWellnessReturn {
  const attemptsRef = useRef<SessionAttempt[]>([]);
  const [check, setCheck] = useState<SessionWellnessCheck>(EMPTY_CHECK);
  const [fatigue, setFatigue] = useState<ProactiveFatigueCheck>(EMPTY_FATIGUE);
  const [dismissed, setDismissed] = useState(false);
  const [breakDismissed, setBreakDismissed] = useState(false);
  const [attemptsSinceNudge, setAttemptsSinceNudge] = useState(0);
  const [attemptsSinceBreakNudge, setAttemptsSinceBreakNudge] = useState(0);

  // Break timer state
  const [onBreak, setOnBreak] = useState(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
    };
  }, []);

  const recordAttempt = useCallback(
    (wasCorrect: boolean, responseTimeMs: number) => {
      const attempt: SessionAttempt = {
        wasCorrect,
        responseTimeMs,
        timestamp: new Date(),
      };
      attemptsRef.current.push(attempt);

      const newCheck = detectDiminishingReturns(attemptsRef.current);
      setCheck(newCheck);

      const newFatigue = detectProactiveFatigue(attemptsRef.current);
      setFatigue(newFatigue);

      // If user previously dismissed hard stop, count attempts since then
      if (dismissed) {
        setAttemptsSinceNudge((prev) => {
          const next = prev + 1;
          if (next >= RECHECK_INTERVAL && newCheck.shouldStop) {
            setDismissed(false);
            return 0;
          }
          return next;
        });
      }

      // If user previously dismissed proactive break, count attempts since then
      if (breakDismissed) {
        setAttemptsSinceBreakNudge((prev) => {
          const next = prev + 1;
          if (next >= BREAK_RECHECK_INTERVAL && newFatigue.fatigueLevel === 'break_suggested') {
            setBreakDismissed(false);
            return 0;
          }
          return next;
        });
      }
    },
    [dismissed, breakDismissed]
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
    setAttemptsSinceNudge(0);
  }, []);

  const dismissBreak = useCallback(() => {
    setBreakDismissed(true);
    setAttemptsSinceBreakNudge(0);
  }, []);

  const startBreak = useCallback((minutes: number) => {
    setOnBreak(true);
    setBreakSecondsLeft(minutes * 60);

    // Clear any existing timer
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);

    breakTimerRef.current = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev <= 1) {
          if (breakTimerRef.current) clearInterval(breakTimerRef.current);
          breakTimerRef.current = null;
          setOnBreak(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const endBreak = useCallback(() => {
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    setOnBreak(false);
    setBreakSecondsLeft(0);
    setBreakDismissed(true); // Don't immediately re-prompt after returning
    setAttemptsSinceBreakNudge(0);
  }, []);

  const reset = useCallback(() => {
    attemptsRef.current = [];
    setCheck(EMPTY_CHECK);
    setFatigue(EMPTY_FATIGUE);
    setDismissed(false);
    setBreakDismissed(false);
    setAttemptsSinceNudge(0);
    setAttemptsSinceBreakNudge(0);
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
    setOnBreak(false);
    setBreakSecondsLeft(0);
  }, []);

  return {
    recordAttempt,
    check,
    fatigue,
    dismissed,
    breakDismissed,
    dismiss,
    dismissBreak,
    attemptsSinceNudge,
    onBreak,
    startBreak,
    endBreak,
    breakSecondsLeft,
    reset,
  };
}
