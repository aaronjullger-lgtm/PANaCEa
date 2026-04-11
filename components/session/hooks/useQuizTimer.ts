import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseQuizTimerParams {
  /** Session time limit in ms. Undefined = untimed. */
  timeLimit?: number;
  /** Hide timer display in commuter mode */
  isCommuterMode?: boolean;
  /** Called when the timer reaches zero */
  onTimeUp?: () => void;
}

export interface UseQuizTimerReturn {
  /** Remaining time in ms, or null if untimed */
  timeRemaining: number | null;
  /** Whether the countdown is actively running */
  isRunning: boolean;
  /** Elapsed session time in ms (excludes tab-hidden intervals) */
  elapsed: number;
  /** Whether the timer should be visible (respects commuter mode + user toggle) */
  showTimerVisible: boolean;
  /** The (shifted) session start timestamp — use for summary displays */
  sessionStartTime: number;
  /** Toggle timer visibility */
  toggleTimerVisibility: () => void;
  /** Start the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Reset to full duration */
  reset: () => void;
}

/**
 * Self-contained quiz session timer with tab-hidden pausing.
 *
 * Owns the `sessionStartTime` ref internally (shifted forward each time the tab
 * becomes visible again) so callers never need to manage it.
 */
export function useQuizTimer({
  timeLimit,
  isCommuterMode = false,
  onTimeUp,
}: UseQuizTimerParams): UseQuizTimerReturn {
  const sessionStartTimeRef = useRef(Date.now());
  const [showTimer, setShowTimer] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    timeLimit != null ? timeLimit : null,
  );
  const [isRunning, setIsRunning] = useState(timeLimit != null);

  // Stable ref for onTimeUp so the interval doesn't tear down on identity changes
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Main countdown interval
  useEffect(() => {
    if (!timeLimit || !isRunning) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTimeRef.current;
      const remaining = timeLimit - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeRemaining(0);
        setIsRunning(false);
        onTimeUpRef.current?.();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimit, isRunning]);

  // Pause timer when tab is hidden (shift sessionStartTime to exclude hidden time)
  useEffect(() => {
    if (!timeLimit) return;
    let hiddenAt: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        sessionStartTimeRef.current += Date.now() - hiddenAt;
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [timeLimit]);

  const start = useCallback(() => {
    if (timeLimit != null) setIsRunning(true);
  }, [timeLimit]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    sessionStartTimeRef.current = Date.now();
    if (timeLimit != null) {
      setTimeRemaining(timeLimit);
      setIsRunning(true);
    } else {
      setTimeRemaining(null);
      setIsRunning(false);
    }
  }, [timeLimit]);

  const toggleTimerVisibility = useCallback(() => {
    setShowTimer((prev) => !prev);
  }, []);

  // Reactive elapsed for timed sessions (derived from state, triggers re-renders)
  // For untimed sessions, computed at render time from the ref
  const elapsed =
    timeLimit != null
      ? timeLimit - (timeRemaining ?? timeLimit)
      : Date.now() - sessionStartTimeRef.current;

  return {
    timeRemaining,
    isRunning,
    elapsed,
    showTimerVisible: showTimer && !isCommuterMode,
    sessionStartTime: sessionStartTimeRef.current,
    toggleTimerVisibility,
    start,
    pause,
    reset,
  };
}
