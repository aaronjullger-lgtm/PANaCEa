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
import { createApiClient, createDrillsClient, ApiError } from '@/lib/sdk';
import { syncManager } from '@/lib/services/sync/syncManager';
import { toast } from '@/lib/toast';
import { useStudyStore } from '@/lib/stores/useStudyStore';

// Types are now imported from the shared library.
// Interfaces defined here previously are re-exported for backward compatibility
// so existing drill components that import from this file continue to work.
import type {
  UseDrillFSRSOptions,
  SubmitAnswerParams,
  DrillFSRSResponse,
  FSRSNextReview,
} from '@/lib/api/types/drills';

export type { UseDrillFSRSOptions, SubmitAnswerParams, DrillFSRSResponse, FSRSNextReview };

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
  /** Last FSRS response received, or null if not yet submitted */
  lastFSRSResponse: DrillFSRSResponse | null;
  /** Normalized FSRS next review data for EnhancedFeedbackPanel */
  fsrsNextReview: FSRSNextReview | null;
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
  const recordStudyAttempt = useStudyStore((state) => state.recordAttempt);

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
  const [lastFSRSResponse, setLastFSRSResponse] = useState<DrillFSRSResponse | null>(null);

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

      // Compute timezone before try so it's available in catch for offline fallback
      const timezone = getBrowserTimezone();

      try {
        const api = createApiClient(getToken, {
          retryablePosts: ['/api/drills/submit-review'],
        });
        const drills = createDrillsClient(api);

        const submitted = await drills.submitReview({
          questionId,
          selectedAnswer,
          timeSpentMs,
          timeToFirstClick: timeToFirstClickRef.current ?? undefined,
          answerSwitches: answerSwitchesRef.current,
          totalDwellTime: totalDwellTimeRef.current,
          timezone,
          sessionType: 'drill', // Mark as drill submission
        });

        const result = submitted as DrillFSRSResponse;

        // Store the response for access by session components
        setLastFSRSResponse(result);
        recordStudyAttempt({
          sessionId: null,
          questionId,
          canonicalQuestionId: questionId,
          source: 'drill',
          result: result.isCorrect ? 'correct' : 'incorrect',
          selectedAnswer: String(selectedAnswer),
          timeSpentMs,
          syncState: 'synced',
        });

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

        // Surface a user-friendly message via toast.
        // ApiError.userMessage is categorized (network/timeout/auth/server) to avoid
        // scaring users with raw error text while still being honest.
        const isApiError = err instanceof ApiError;
        if (isApiError && err.isAuthError) {
          toast.error(err.userMessage);
        } else {
          // For transient errors: reassure user their answer is queued offline
          const queuedOffline = (() => {
            try {
              syncManager.queueReview({
                questionId,
                selectedAnswer: String(selectedAnswer),
                timeSpentMs,
                timeToFirstClick: timeToFirstClickRef.current ?? undefined,
                answerSwitches: answerSwitchesRef.current,
                totalDwellTime: totalDwellTimeRef.current,
                timezone,
                sessionType: 'drill',
              });
              return true;
            } catch (queueErr) {
              console.error(`[useDrillFSRS:${drillType}] Failed to queue offline review:`, queueErr);
              return false;
            }
          })();

          if (queuedOffline) {
            toast.warning('Answer saved offline — it will sync when your connection returns.', {
              duration: 4000,
            });
          } else {
            toast.error(
              isApiError ? err.userMessage : 'Failed to save your answer. Please try again.',
              { duration: 5000 }
            );
          }
        }

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
    setLastFSRSResponse(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dwellIntervalRef.current) {
        clearInterval(dwellIntervalRef.current);
      }
    };
  }, []);

  // Compute normalized nextReview for EnhancedFeedbackPanel
  const fsrsNextReview: FSRSNextReview | null = lastFSRSResponse?.nextReview
    ? {
        intervalDays: lastFSRSResponse.nextReview.intervalDays ?? 0,
        nextDueDate: lastFSRSResponse.nextReview.nextDueDate ?? new Date().toISOString(),
        stability: lastFSRSResponse.nextReview.stability ?? 0,
        difficulty: lastFSRSResponse.nextReview.difficulty ?? 0,
      }
    : null;

  return {
    startQuestion,
    recordAnswerChange,
    submitAnswer,
    reset,
    isSubmitting,
    error,
    lastFSRSResponse,
    fsrsNextReview,
  };
}

export default useDrillFSRS;
