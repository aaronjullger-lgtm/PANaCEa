/**
 * Behavioral Telemetry Tracker for Implicit FSRS
 *
 * Tracks time_to_first_interaction (hesitation), answer_change_count (uncertainty),
 * and mouse_hover_duration over distractors (confusion pairs) for the "Ghost Grader".
 * Payload is sent to the backend on submission.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { TelemetryData } from '@/types/telemetry';
import { getMVRTThreshold, type QuestionType } from '@/types/telemetry';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BehavioralPayload {
  time_to_first_interaction_ms: number | null;
  answer_change_count: number;
  mouse_hover_duration_ms: Record<string, number>; // option label A,B,C,D -> ms
  duration_ms: number;
  question_displayed_at: string;
  answer_submitted_at: string;
  question_type: QuestionType;
  mvrt_threshold_ms: number;
  rapid_guess: boolean;
}

export interface BehavioralTrackerApi {
  start: (questionType?: QuestionType) => void;
  recordFirstInteraction: () => void;
  recordAnswerChange: () => void;
  recordHover: (optionIndex: number, optionLabel: string, deltaMs: number) => void;
  finalize: (sessionId?: string) => BehavioralPayload | null;
  getElapsedMs: () => number;
}

const LETTERS = ['A', 'B', 'C', 'D'] as const;

const defaultApi: BehavioralTrackerApi = {
  start: () => {},
  recordFirstInteraction: () => {},
  recordAnswerChange: () => {},
  recordHover: () => {},
  finalize: () => null,
  getElapsedMs: () => 0,
};

const BehavioralTrackerContext = createContext<BehavioralTrackerApi>(defaultApi);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface BehavioralTrackerProviderProps {
  children: ReactNode;
}

export function BehavioralTrackerProvider({ children }: BehavioralTrackerProviderProps) {
  const startTimeRef = useRef<number>(0);
  const startIsoRef = useRef<string>('');
  const firstInteractionMsRef = useRef<number | null>(null);
  const answerChangeCountRef = useRef<number>(0);
  const hoverMsRef = useRef<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  const hoverEnterTimeRef = useRef<Record<string, number>>({});
  const questionTypeRef = useRef<QuestionType>('unknown');
  const activeRef = useRef<boolean>(false);

  const start = useCallback((questionType: QuestionType = 'unknown') => {
    activeRef.current = true;
    startTimeRef.current = Date.now();
    startIsoRef.current = new Date().toISOString();
    firstInteractionMsRef.current = null;
    answerChangeCountRef.current = 0;
    hoverMsRef.current = { A: 0, B: 0, C: 0, D: 0 };
    hoverEnterTimeRef.current = {};
    questionTypeRef.current = questionType;
  }, []);

  const recordFirstInteraction = useCallback(() => {
    if (!activeRef.current || firstInteractionMsRef.current !== null) return;
    firstInteractionMsRef.current = Date.now() - startTimeRef.current;
  }, []);

  const recordAnswerChange = useCallback(() => {
    if (!activeRef.current) return;
    answerChangeCountRef.current += 1;
  }, []);

  const recordHover = useCallback((optionIndex: number, optionLabel: string, deltaMs: number) => {
    if (!activeRef.current) return;
    const key = optionLabel in hoverMsRef.current ? optionLabel : (LETTERS[optionIndex] ?? 'A');
    hoverMsRef.current[key] = (hoverMsRef.current[key] ?? 0) + deltaMs;
  }, []);

  const finalize = useCallback((sessionId?: string): BehavioralPayload | null => {
    if (!activeRef.current) return null;
    activeRef.current = false;
    const now = Date.now();
    const duration_ms = now - startTimeRef.current;
    const threshold = getMVRTThreshold(questionTypeRef.current);
    return {
      time_to_first_interaction_ms: firstInteractionMsRef.current,
      answer_change_count: answerChangeCountRef.current,
      mouse_hover_duration_ms: { ...hoverMsRef.current },
      duration_ms,
      question_displayed_at: startIsoRef.current,
      answer_submitted_at: new Date(now).toISOString(),
      question_type: questionTypeRef.current,
      mvrt_threshold_ms: threshold,
      rapid_guess: duration_ms < threshold,
    };
  }, []);

  const getElapsedMs = useCallback(() => {
    if (!activeRef.current) return 0;
    return Date.now() - startTimeRef.current;
  }, []);

  const api = useMemo<BehavioralTrackerApi>(
    () => ({
      start,
      recordFirstInteraction,
      recordAnswerChange,
      recordHover,
      finalize,
      getElapsedMs,
    }),
    [start, recordFirstInteraction, recordAnswerChange, recordHover, finalize, getElapsedMs]
  );

  return (
    <BehavioralTrackerContext.Provider value={api}>{children}</BehavioralTrackerContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useBehavioralTracker(): BehavioralTrackerApi {
  const ctx = useContext(BehavioralTrackerContext);
  return ctx ?? defaultApi;
}

// -----------------------------------------------------------------------------
// Option hover wrapper (wrap each AnswerChoice to record hover duration)
// -----------------------------------------------------------------------------

interface OptionHoverTrackerProps {
  optionIndex: number;
  optionLabel: string; // 'A' | 'B' | 'C' | 'D'
  children: ReactNode;
  className?: string;
  /** Optional: report hover enter for micro-kinetics (Ghost Grader oscillation) */
  onHoverEnter?: (optionLabel: string) => void;
}

export function OptionHoverTracker({
  optionIndex,
  optionLabel,
  children,
  className,
  onHoverEnter,
}: OptionHoverTrackerProps) {
  const tracker = useBehavioralTracker();
  const enterTimeRef = useRef<number | null>(null);

  const handleMouseEnter = useCallback(() => {
    enterTimeRef.current = Date.now();
    tracker.recordFirstInteraction();
    onHoverEnter?.(optionLabel);
  }, [tracker, optionLabel, onHoverEnter]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimeRef.current !== null) {
      const deltaMs = Date.now() - enterTimeRef.current;
      tracker.recordHover(optionIndex, optionLabel, deltaMs);
      enterTimeRef.current = null;
    }
  }, [tracker, optionIndex, optionLabel]);

  return (
    <div
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Convert BehavioralPayload to TelemetryData for API (attempt + analyze-behavior)
// -----------------------------------------------------------------------------

export function behavioralPayloadToTelemetryData(
  payload: BehavioralPayload,
  answer_changes?: number,
  hint_viewed = false,
  microKinetics?: {
    oscillations: number;
    vignetteRegressions: number;
    selectionDriftMs: number | null;
    tremorScore: number;
    cursorEntropy?: number;
    inputMethod?: 'mouse' | 'touch';
  },
  /** Eliminations per second (strategy speed). */
  eliminationVelocity?: number
): TelemetryData {
  return {
    duration_ms: payload.duration_ms,
    time_to_first_interaction_ms: payload.time_to_first_interaction_ms,
    rapid_guess: payload.rapid_guess,
    question_type: payload.question_type,
    mvrt_threshold_ms: payload.mvrt_threshold_ms,
    question_displayed_at: payload.question_displayed_at,
    answer_submitted_at: payload.answer_submitted_at,
    answer_changes: answer_changes ?? payload.answer_change_count,
    hint_viewed,
    hint_view_duration_ms: null,
    trajectory_metrics: {
      distractorHovers: payload.mouse_hover_duration_ms,
      hoverEntropy: 0,
      confidenceScore: 0,
      hesitationIndex: 0,
      mad: 0,
      auc: 0,
      jitterScore: 0,
      efficiency: 0,
      movementTime: 0,
      peakDistractorHover: null,
      distractorHoverRatio: 0,
    },
    ...(microKinetics && {
      hover_oscillations: microKinetics.oscillations,
      vignette_regressions: microKinetics.vignetteRegressions,
      selection_drift_ms: microKinetics.selectionDriftMs ?? undefined,
      tremor_score: microKinetics.tremorScore,
      cursor_entropy: microKinetics.cursorEntropy,
      input_method: microKinetics.inputMethod,
    }),
    ...(eliminationVelocity !== undefined && { elimination_velocity: eliminationVelocity }),
  };
}

/**
 * Enrich telemetry with session position data for server-side fatigue detection.
 * Call this after behavioralPayloadToTelemetryData to add question_number.
 */
export function enrichTelemetryWithSessionPosition(
  telemetry: TelemetryData,
  questionNumber: number
): TelemetryData {
  return {
    ...telemetry,
    question_number: questionNumber,
  };
}
