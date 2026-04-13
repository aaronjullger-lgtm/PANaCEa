/**
 * useStudyTimer — Pomodoro-style study timer hook
 *
 * Manages work/break phases, fatigue detection, and session state persistence.
 * Survives navigation within the app by storing state in module-level refs.
 *
 * @example
 * ```tsx
 * const {
 *   phase, remainingMs, progress, session,
 *   start, pause, skip, recordAnswer, reset,
 *   fatigueAlert, summary
 * } = useStudyTimer({
 *   workDurationMs: 35 * 60 * 1000,
 *   breakDurationMs: 10 * 60 * 1000,
 *   onWorkComplete: () => toast('Work block done!'),
 *   onBreakComplete: () => toast('Break over!'),
 *   onFatigueDetected: (alert) => toast.warning(alert.message),
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createSession,
  transitionPhase,
  completeSession,
  recordAnswer as recordAnswerInService,
  getPhaseRemainingMs,
  getPhaseProgress,
  DEFAULT_WORK_MS,
  DEFAULT_BREAK_MS,
  type StudyTimerConfig,
  type StudySession,
  type SessionDataPoint,
  type FatigueAlert,
  type SessionSummary,
  type TimerPhase,
} from '@/lib/services/studyTimerService';

export type { SessionSummary, FatigueAlert, SessionDataPoint, TimerPhase };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseStudyTimerOptions {
  /** Work block duration in ms (default: 35 min) */
  workDurationMs?: number;
  /** Break duration in ms (default: 10 min) */
  breakDurationMs?: number;
  /** Called when a work block completes */
  onWorkComplete?: () => void;
  /** Called when a break completes */
  onBreakComplete?: () => void;
  /** Called when fatigue is detected */
  onFatigueDetected?: (alert: FatigueAlert) => void;
  /** Called when the entire session is completed */
  onSessionComplete?: (summary: SessionSummary) => void;
}

export interface UseStudyTimerReturn {
  /** Current timer phase */
  phase: TimerPhase;
  /** Remaining time in the current phase (ms) */
  remainingMs: number;
  /** Progress through current phase (0-1) */
  progress: number;
  /** Whether the timer is actively running */
  isRunning: boolean;
  /** Whether the timer is paused */
  isPaused: boolean;
  /** Full session object */
  session: StudySession;
  /** Latest fatigue alert */
  fatigueAlert: FatigueAlert | null;
  /** Session summary (available after completion) */
  summary: SessionSummary | null;
  /** Start or resume the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Skip to the next phase */
  skip: () => void;
  /** Record a question answer for fatigue tracking */
  recordAnswer: (dataPoint: SessionDataPoint) => void;
  /** Reset the session entirely */
  reset: () => void;
  /** Manually complete the session */
  complete: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStudyTimer(options: UseStudyTimerOptions = {}): UseStudyTimerReturn {
  const {
    workDurationMs = DEFAULT_WORK_MS,
    breakDurationMs = DEFAULT_BREAK_MS,
    onWorkComplete,
    onBreakComplete,
    onFatigueDetected,
    onSessionComplete,
  } = options;

  // Persist session in a ref so it survives re-renders but doesn't trigger them
  const sessionRef = useRef<StudySession>(
    createSession({ workDurationMs, breakDurationMs }),
  );

  // Render-driving state
  const [remainingMs, setRemainingMs] = useState(getPhaseRemainingMs(sessionRef.current));
  const [isRunning, setIsRunning] = useState(true);
  const [phase, setPhase] = useState(sessionRef.current.phase);
  const [fatigueAlert, setFatigueAlert] = useState<FatigueAlert | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [sessionSnapshot, setSessionSnapshot] = useState<StudySession>(sessionRef.current);

  // Stabilize callbacks via refs
  const onWorkCompleteRef = useRef(onWorkComplete);
  onWorkCompleteRef.current = onWorkComplete;
  const onBreakCompleteRef = useRef(onBreakComplete);
  onBreakCompleteRef.current = onBreakComplete;
  const onFatigueDetectedRef = useRef(onFatigueDetected);
  onFatigueDetectedRef.current = onFatigueDetected;
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;

  // Main countdown interval
  useEffect(() => {
    if (!isRunning || phase === 'complete') return;

    const interval = setInterval(() => {
      const remaining = getPhaseRemainingMs(sessionRef.current);

      if (remaining <= 0) {
        // Phase completed
        const prevPhase = sessionRef.current.phase;
        sessionRef.current = transitionPhase(sessionRef.current);
        const newPhase = sessionRef.current.phase;

        setPhase(newPhase);
        setRemainingMs(getPhaseRemainingMs(sessionRef.current));
        setSessionSnapshot({ ...sessionRef.current });

        if (prevPhase === 'work') {
          onWorkCompleteRef.current?.();
        } else if (prevPhase === 'break') {
          onBreakCompleteRef.current?.();
        }
      } else {
        setRemainingMs(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phase]);

  // Pause timer when tab is hidden
  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        setIsRunning(false);
      } else if (hiddenAt !== null) {
        // Shift phase start forward by the hidden duration
        const hiddenDuration = Date.now() - hiddenAt;
        sessionRef.current = {
          ...sessionRef.current,
          phaseStartedAt: sessionRef.current.phaseStartedAt + hiddenDuration,
        };
        hiddenAt = null;
        setIsRunning(true);
        setRemainingMs(getPhaseRemainingMs(sessionRef.current));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
    setRemainingMs(getPhaseRemainingMs(sessionRef.current));
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const skip = useCallback(() => {
    const prevPhase = sessionRef.current.phase;
    sessionRef.current = transitionPhase(sessionRef.current);
    const newPhase = sessionRef.current.phase;

    setPhase(newPhase);
    setRemainingMs(getPhaseRemainingMs(sessionRef.current));
    setSessionSnapshot({ ...sessionRef.current });

    if (prevPhase === 'work') {
      onWorkCompleteRef.current?.();
    } else if (prevPhase === 'break') {
      onBreakCompleteRef.current?.();
    }
  }, []);

  const recordAnswer = useCallback((dataPoint: SessionDataPoint) => {
    const result = recordAnswerInService(sessionRef.current, dataPoint);
    sessionRef.current = result.session;
    setSessionSnapshot({ ...result.session });

    if (result.fatigueAlert.detected) {
      setFatigueAlert(result.fatigueAlert);
      onFatigueDetectedRef.current?.(result.fatigueAlert);
    }
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = createSession({ workDurationMs, breakDurationMs });
    setIsRunning(true);
    setPhase('work');
    setRemainingMs(getPhaseRemainingMs(sessionRef.current));
    setFatigueAlert(null);
    setSummary(null);
    setSessionSnapshot({ ...sessionRef.current });
  }, [workDurationMs, breakDurationMs]);

  const handleComplete = useCallback(() => {
    const result = completeSession(sessionRef.current);
    sessionRef.current = result.session;
    setIsRunning(false);
    setPhase('complete');
    setSessionSnapshot({ ...result.session });
    setSummary(result.summary);
    onSessionCompleteRef.current?.(result.summary);
  }, []);

  const progress = getPhaseProgress(sessionRef.current);

  return {
    phase,
    remainingMs,
    progress,
    isRunning,
    isPaused: !isRunning && phase !== 'complete',
    session: sessionSnapshot,
    fatigueAlert,
    summary,
    start,
    pause,
    skip,
    recordAnswer,
    reset,
    complete: handleComplete,
  };
}
