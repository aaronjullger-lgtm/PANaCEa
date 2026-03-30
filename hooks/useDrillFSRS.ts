/**
 * useDrillFSRS - Shared hook for telemetry + FSRS submission across all drills
 *
 * Provides a unified interface for drill components to:
 * - Track implicit behavioral metrics (time-to-first-click, answer switches, dwell time)
 * - Submit answers to the FSRS pipeline with sessionType='drill'
 * - Receive FSRS scheduling feedback (nextReview, stability, difficulty)
 *
 * This hook should be used by ALL drill types to ensure consistent FSRS data collection.
 * Before Day 1, only QuizView and SmartReviewMode submitted to FSRS.
 * After Day 1, all drills can use this hook for unified behavior.
 *
 * @example
 * ```tsx
 * const { startQuestion, recordAnswerChange, submitAnswer, reset } = useDrillFSRS({
 *   drillType: 'condition',
 * });
 *
 * // When question loads
 * useEffect(() => {
 *   startQuestion();
 * }, [questionId]);
 *
 * // When user changes answer
 * const handleSelectAnswer = (answer) => {
 *   recordAnswerChange();
 *   setSelectedAnswer(answer);
 * };
 *
 * // When submitting
 * const handleSubmit = async () => {
 *   const result = await submitAnswer({
 *     questionId: currentQuestion.id,
 *     selectedAnswer: userAnswer,
 *     timeSpentMs: Date.now() - questionStartTime,
 *   });
 *   console.log('FSRS feedback:', result.nextReview);
 * };
 * ```
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getBrowserTimezone } from '@/lib/circadian';

/**
 * Options for the useDrillFSRS hook
 */
export interface UseDrillFSRSOptions {
  /** Drill type for logging/analytics (e.g., 'condition', 'pharm', 'ddx') */
  drillType: string;
}

/**
 * Parameters for submitAnswer method
 */
export interface SubmitAnswerParams {
  /** The question's unique ID */
  questionId: string;
  /** The user's selected answer (string or index) */
  selectedAnswer: string | number;
  /** Total time spent on question in milliseconds */
  timeSpentMs: number;
}

/**
 * FSRS response from the server
 */
export interface DrillFSRSResponse {
  success: boolean;
  isCorrect: boolean;
  quality: number;
  parTimeMs: number;
  timeSpentMs: number;
  implicitMetrics: {
    rating: number;
    gradeContinuous: number;
    confidence: number;
    latencyRatio: number;
    answerSwitches: number;
  };
  circadian: {
    phase: string;
    stabilityModifier: number;
    localHour: number;
  };
  fsrsSchedule?: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  };
  isRapidGuess?: boolean;
  nextReview?: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  } | null;
}

/**
 * Hook return type
 */
export interface UseDrillFSRSReturn {
  /** Call when a new question is displayed */
  startQuestion: () => void;
  /** Call when user changes their answer selection */
  recordAnswerChange: () => void;
  /** Submit answer to FSRS pipeline — returns scheduling feedback */
  submitAnswer: (params: SubmitAnswerParams) => Promise<DrillFSRSResponse | null>;
  /** Reset state for the next question */
  reset: () => void;
  /** Whether API submission is in progress */
  isSubmitting: boolean;
  /** Last submission error, if any */
  error: Error | null;
}

/**
 * Hook for unified telemetry + FSRS submission across all drill types
 *
 * Internally tracks:
 * - Time to first answer selection (timeToFirstClick)
 * - Number of answer switches (answerSwitches)
 * - Total dwell time on question (totalDwellTime)
 * - Browser timezone for circadian context
 *
 * When submitAnswer is called, sends telemetry to /api/drills/submit-review with sessionType='drill'.
 */
export function useDrillFSRS(options: UseDrillFSRSOptions): UseDrillFSRSReturn {
  const { drillType } = options;
  const { getToken } = useAuth();

  // Timing and telemetry tracking
  const questionStartTimeRef = useRef<number>(Date.now());
  const dwellIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousAnswerRef = useRef<string | number | null>(null);
  const timeToFirstClickRef = useRef<number | null>(null);
  const answerSwitchesRef = useRef<number>(0);
  const totalDwellTimeRef = useRef<number>(0);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Start tracking for a new question
   */
  const startQuestion = useCallback(() => {
    const now = Date.now();
    questionStartTimeRef.current = now;
    previousAnswerRef.current = null;
    timeToFirstClickRef.current = null;
    answerSwitchesRef.current = 0;
    totalDwellTimeRef.current = 0;

    // Update dwell time every second (silent - no re-render)
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
    }
    dwellIntervalRef.current = setInterval(() => {
      totalDwellTimeRef.current = Date.now() - questionStartTimeRef.current;
    }, 1000);
  }, []);

  /**
   * Record when user changes their answer
   */
  const recordAnswerChange = useCallback((newAnswer?: string | number) => {
    const now = Date.now();

    // Record time to first click on first selection
    if (timeToFirstClickRef.current === null) {
      timeToFirstClickRef.current = now - questionStartTimeRef.current;
    }

    // Record answer switch if they're changing from a previous selection
    if (newAnswer !== undefined) {
      if (previousAnswerRef.current !== null && previousAnswerRef.current !== newAnswer) {
        answerSwitchesRef.current += 1;
      }
      previousAnswerRef.current = newAnswer;
    }

    // Update dwell time
    totalDwellTimeRef.current = now - questionStartTimeRef.current;
  }, []);

  /**
   * Submit answer to FSRS pipeline
   */
  const submitAnswer = useCallback(
    async (params: SubmitAnswerParams): Promise<DrillFSRSResponse | null> => {
      const { questionId, selectedAnswer, timeSpentMs } = params;

      // Stop dwell tracking
      if (dwellIntervalRef.current) {
        clearInterval(dwellIntervalRef.current);
        dwellIntervalRef.current = null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const token = await getToken();
        const timezone = getBrowserTimezone();

        const response = await fetch('/api/drills/submit-review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId,
            selectedAnswer,
            timeSpentMs,
            timeToFirstClick: timeToFirstClickRef.current,
            answerSwitches: answerSwitchesRef.current,
            totalDwellTime: totalDwellTimeRef.current,
            timezone,
            sessionType: 'drill', // Mark as drill submission
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
            details?: string;
          };
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        const result = (await response.json()) as DrillFSRSResponse;

        if (import.meta.env.DEV) {
          console.debug(`[useDrillFSRS:${drillType}] Submitted answer:`, {
            questionId,
            isCorrect: result.isCorrect,
            timeToFirstClick: timeToFirstClickRef.current,
            answerSwitches: answerSwitchesRef.current,
            totalDwellTime: totalDwellTimeRef.current,
            nextReview: result.nextReview,
          });
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to submit answer');
        setError(error);
        console.error(`[useDrillFSRS:${drillType}] Error:`, error);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getToken, drillType]
  );

  /**
   * Reset for next question
   */
  const reset = useCallback(() => {
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
      dwellIntervalRef.current = null;
    }
    previousAnswerRef.current = null;
    timeToFirstClickRef.current = null;
    answerSwitchesRef.current = 0;
    totalDwellTimeRef.current = 0;
    questionStartTimeRef.current = Date.now();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dwellIntervalRef.current) {
        clearInterval(dwellIntervalRef.current);
      }
    };
  }, []);

  return {
    startQuestion,
    recordAnswerChange,
    submitAnswer,
    reset,
    isSubmitting,
    error,
  };
}

export default useDrillFSRS;
