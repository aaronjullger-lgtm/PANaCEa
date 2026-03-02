/**
 * useImplicitMetrics - Hook for tracking behavioral metrics during drills
 *
 * Tracks:
 * - Time to first answer selection
 * - Number of answer switches (changing selected answer)
 * - Total dwell time on question
 * - Browser timezone for circadian context
 *
 * Used to derive FSRS rating without explicit user buttons (Phase 2: Zero-Friction)
 *
 * Sprint C Integration: Automatically POSTs metrics to /api/user/behavior-metrics
 * after submitAnswer is called, enabling backend persistence for personalization.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getBrowserTimezone } from '../lib/circadian';

/**
 * Metrics collected during a single question attempt
 */
export interface QuestionImplicitMetrics {
  /** Time to first answer selection (ms) */
  timeToFirstClick: number | null;
  /** Number of times user changed their selected answer */
  answerSwitches: number;
  /** Total time spent on question (ms) */
  totalDwellTime: number;
  /** Browser timezone (IANA format) */
  timezone: string;
  /** When question was shown (ISO timestamp) */
  questionStartTime: string;
  /** When answer was submitted (ISO timestamp) */
  submitTime: string | null;
  /** Selected answer value */
  selectedAnswer: string | number | null;
  /** Previous selected answer (for switch tracking) */
  previousAnswer: string | number | null;
}

/**
 * Hook return type
 */
export interface UseImplicitMetricsReturn {
  /** Current metrics state */
  metrics: QuestionImplicitMetrics;
  /** Call when question is shown */
  startQuestion: () => void;
  /** Call when user selects/changes answer */
  recordAnswerSelection: (answer: string | number) => void;
  /** Call when answer is submitted - returns final metrics and POSTs to API */
  submitAnswer: (
    questionId: string,
    wasCorrect: boolean,
    questionType?: string
  ) => Promise<QuestionImplicitMetrics>;
  /** Reset for next question */
  reset: () => void;
  /** Get metrics formatted for API submission */
  getApiPayload: () => {
    timeToFirstClick: number | undefined;
    answerSwitches: number;
    totalDwellTime: number;
    timezone: string;
  };
  /** Whether API submission is in progress */
  isSubmitting: boolean;
  /** Last API submission error, if any */
  submissionError: Error | null;
}

/**
 * Create initial metrics state
 */
function createInitialMetrics(): QuestionImplicitMetrics {
  return {
    timeToFirstClick: null,
    answerSwitches: 0,
    totalDwellTime: 0,
    timezone: getBrowserTimezone(),
    questionStartTime: new Date().toISOString(),
    submitTime: null,
    selectedAnswer: null,
    previousAnswer: null,
  };
}

/**
 * Hook for tracking implicit behavioral metrics during drill questions
 *
 * @example
 * ```tsx
 * const { metrics, startQuestion, recordAnswerSelection, submitAnswer, reset, getApiPayload } = useImplicitMetrics();
 *
 * // When question loads
 * useEffect(() => {
 *   startQuestion();
 *   return () => reset();
 * }, [questionId]);
 *
 * // When user selects answer
 * const handleSelect = (answer: string) => {
 *   recordAnswerSelection(answer);
 *   setSelectedAnswer(answer);
 * };
 *
 * // When submitting
 * const handleSubmit = async () => {
 *   const finalMetrics = await submitAnswer(questionId, wasCorrect, 'multiple_choice');
 *   // Metrics are automatically POSTed to /api/user/behavior-metrics
 * };
 * ```
 */
export function useImplicitMetrics(): UseImplicitMetricsReturn {
  const metricsRef = useRef<QuestionImplicitMetrics>(createInitialMetrics());
  const isSubmittingRef = useRef(false);
  const submissionErrorRef = useRef<Error | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const dwellIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { getToken } = useAuth();

  /**
   * Start tracking for a new question
   */
  const startQuestion = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;

    metricsRef.current = {
      ...createInitialMetrics(),
      questionStartTime: new Date(now).toISOString(),
    };

    // Update dwell time every second (silent - no re-render)
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
    }
    dwellIntervalRef.current = setInterval(() => {
      metricsRef.current.totalDwellTime = Date.now() - startTimeRef.current;
    }, 1000);
  }, []);

  /**
   * Record when user selects or changes their answer
   */
  const recordAnswerSelection = useCallback((answer: string | number) => {
    const now = Date.now();
    const prev = metricsRef.current;
    const isFirstSelection = prev.timeToFirstClick === null;
    const isSwitch = prev.selectedAnswer !== null && prev.selectedAnswer !== answer;

    metricsRef.current = {
      ...prev,
      timeToFirstClick: isFirstSelection ? now - startTimeRef.current : prev.timeToFirstClick,
      answerSwitches: isSwitch ? prev.answerSwitches + 1 : prev.answerSwitches,
      previousAnswer: prev.selectedAnswer,
      selectedAnswer: answer,
      totalDwellTime: now - startTimeRef.current,
    };
  }, []);

  /**
   * Finalize and return metrics when answer is submitted
   * Also POSTs metrics to /api/user/behavior-metrics for backend persistence
   */
  const submitAnswer = useCallback(
    async (
      questionId: string,
      wasCorrect: boolean,
      questionType?: string
    ): Promise<QuestionImplicitMetrics> => {
      const now = Date.now();

      // Stop dwell tracking
      if (dwellIntervalRef.current) {
        clearInterval(dwellIntervalRef.current);
        dwellIntervalRef.current = null;
      }

      const finalMetrics: QuestionImplicitMetrics = {
        ...metricsRef.current,
        totalDwellTime: now - startTimeRef.current,
        submitTime: new Date(now).toISOString(),
      };

      metricsRef.current = finalMetrics;

      // POST metrics to API asynchronously (don't block UI)
      isSubmittingRef.current = true;
      submissionErrorRef.current = null;

      try {
        const token = await getToken();

        const payload = {
          questionId,
          questionType,
          timeToFirstClick: finalMetrics.timeToFirstClick ?? 0,
          dwellTime: finalMetrics.totalDwellTime,
          totalResponseTime: finalMetrics.totalDwellTime,
          answerChanges: finalMetrics.answerSwitches,
          wasCorrect,
          // Additional optional fields can be added here
          // optionHovers, scrollDepth, hesitationEvents, etc.
        };

        const response = await fetch('/api/user/behavior-metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        console.debug('[useImplicitMetrics] Metrics posted successfully:', {
          questionId,
          timeToFirstClick: finalMetrics.timeToFirstClick,
          dwellTime: finalMetrics.totalDwellTime,
          answerSwitches: finalMetrics.answerSwitches,
        });
      } catch (error) {
        // Log error but don't block the user experience
        console.error('[useImplicitMetrics] Failed to post metrics:', error);
        submissionErrorRef.current = error instanceof Error ? error : new Error('Failed to submit metrics');
      } finally {
        isSubmittingRef.current = false;
      }

      return finalMetrics;
    },
    [getToken]
  );

  /**
   * Reset for next question
   */
  const reset = useCallback(() => {
    if (dwellIntervalRef.current) {
      clearInterval(dwellIntervalRef.current);
      dwellIntervalRef.current = null;
    }
    metricsRef.current = createInitialMetrics();
    startTimeRef.current = Date.now();
  }, []);

  /**
   * Get metrics formatted for API submission
   */
  const getApiPayload = useCallback(() => {
    return {
      timeToFirstClick: metricsRef.current.timeToFirstClick ?? undefined,
      answerSwitches: metricsRef.current.answerSwitches,
      totalDwellTime: metricsRef.current.totalDwellTime,
      timezone: metricsRef.current.timezone,
    };
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
    metrics: metricsRef.current,
    startQuestion,
    recordAnswerSelection,
    submitAnswer,
    reset,
    getApiPayload,
    isSubmitting: isSubmittingRef.current,
    submissionError: submissionErrorRef.current,
  };
}

/**
 * Helper to format metrics for display (debugging)
 */
export function formatMetricsForDisplay(metrics: QuestionImplicitMetrics): string {
  return [
    `First Click: ${metrics.timeToFirstClick ? `${(metrics.timeToFirstClick / 1000).toFixed(1)}s` : 'N/A'}`,
    `Switches: ${metrics.answerSwitches}`,
    `Dwell: ${(metrics.totalDwellTime / 1000).toFixed(1)}s`,
    `TZ: ${metrics.timezone}`,
  ].join(' | ');
}

export default useImplicitMetrics;
