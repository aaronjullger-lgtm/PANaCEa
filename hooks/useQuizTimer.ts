// hooks/useQuizTimer.ts
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseQuizTimerOptions {
  /** Session time limit in ms, or null/undefined for no limit */
  timeLimitMs: number | null | undefined;
  /** Called when time expires — stabilised internally via ref */
  onTimeUp: () => void;
}

interface UseQuizTimerReturn {
  /** Remaining time in ms, or null if no time limit */
  timeRemainingMs: number | null;
  /** Ref to the session start epoch (ms since epoch) */
  sessionStartTime: React.MutableRefObject<number>;
}

/**
 * Manages the exam-mode countdown timer for quiz sessions.
 * - Pauses when the browser tab is hidden (visibility API)
 * - Auto-fires onTimeUp when the timer hits zero
 * - Returns null when no timeLimitMs is set
 * - Uses a ref for onTimeUp to avoid re-triggering the interval effect
 */
export function useQuizTimer({ timeLimitMs, onTimeUp }: UseQuizTimerOptions): UseQuizTimerReturn {
  const sessionStartTime = useRef(Date.now());
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);

  // Stabilise callback via ref — avoids restarting the interval on every render
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Countdown interval
  useEffect(() => {
    if (!timeLimitMs) {
      setTimeRemainingMs(null);
      return;
    }

    const fire = () => onTimeUpRef.current();

    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime.current;
      const remaining = timeLimitMs - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeRemainingMs(0);
        fire();
      } else {
        setTimeRemainingMs(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimitMs]);

  // Pause timer when tab is hidden
  useEffect(() => {
    if (!timeLimitMs) return;
    let hiddenAt: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        sessionStartTime.current += Date.now() - hiddenAt;
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [timeLimitMs]);

  return { timeRemainingMs, sessionStartTime };
}
