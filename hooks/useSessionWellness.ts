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

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  detectDiminishingReturns,
  type SessionAttempt,
  type SessionWellnessCheck,
  type SessionStats,
} from '@/lib/services/wellnessEngine';

export interface UseSessionWellnessReturn {
  /** Record an attempt — call after each answer */
  recordAttempt: (wasCorrect: boolean, responseTimeMs: number) => void;
  /** Current wellness check result */
  check: SessionWellnessCheck;
  /** Whether the user has dismissed the stop suggestion */
  dismissed: boolean;
  /** Dismiss the stop suggestion (user chose to continue) */
  dismiss: () => void;
  /** Number of attempts since last wellness nudge */
  attemptsSinceNudge: number;
  /** Reset the session (e.g., when starting a new one) */
  reset: () => void;
}

const RECHECK_INTERVAL = 5; // Re-evaluate every N questions after a dismissal

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

export function useSessionWellness(): UseSessionWellnessReturn {
  const attemptsRef = useRef<SessionAttempt[]>([]);
  const [check, setCheck] = useState<SessionWellnessCheck>(EMPTY_CHECK);
  const [dismissed, setDismissed] = useState(false);
  const [attemptsSinceNudge, setAttemptsSinceNudge] = useState(0);

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

      // If user previously dismissed, count attempts since then
      if (dismissed) {
        setAttemptsSinceNudge((prev) => {
          const next = prev + 1;
          // After RECHECK_INTERVAL more questions, re-surface if still declining
          if (next >= RECHECK_INTERVAL && newCheck.shouldStop) {
            setDismissed(false);
            return 0;
          }
          return next;
        });
      }
    },
    [dismissed]
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
    setAttemptsSinceNudge(0);
  }, []);

  const reset = useCallback(() => {
    attemptsRef.current = [];
    setCheck(EMPTY_CHECK);
    setDismissed(false);
    setAttemptsSinceNudge(0);
  }, []);

  return {
    recordAttempt,
    check,
    dismissed,
    dismiss,
    attemptsSinceNudge,
    reset,
  };
}
