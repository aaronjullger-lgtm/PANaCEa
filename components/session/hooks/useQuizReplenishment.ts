import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/simple-logger';
import { getQuestionClient } from '@/services/client/questionApi';
import { fetchSessionQuestions } from '@/services/core';
import type { Question, SessionSettings } from '@/types';

const LOG_SCOPE = 'QuizView:replenish';
const replenishLogger = logger.scope(LOG_SCOPE);

const BATCH_SIZE = 25;
const LOW_QUEUE_THRESHOLD = 20;
const MAX_REPLENISH_ATTEMPTS = 3;

export interface UseQuizReplenishmentParams {
  queue: Question[];
  setQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  setError: (error: string | null) => void;
  sessionSettings: SessionSettings;
  growthAreas: string[];
  getToken: () => Promise<string | null>;
}

export interface UseQuizReplenishmentReturn {
  isGeneratingQuestion: boolean;
  replenishAttempts: number;
  replenishmentError: string | null;
  shouldEndlesslyReplenish: boolean;
  replenishQueue: () => Promise<void>;
  retryReplenishment: () => Promise<void>;
}

/**
 * Background queue replenishment for the quiz session.
 *
 * Monitors queue length and proactively fetches new questions when the
 * buffer drops below LOW_QUEUE_THRESHOLD. Uses a two-tier fetch strategy:
 * batch via fetchSessionQuestions, then individual fallback via getQuestionClient.
 *
 * Skipped for review/reviewFlagged focus modes (finite question sets).
 */
export function useQuizReplenishment({
  queue,
  setQueue,
  setParentQueue,
  setError,
  sessionSettings,
  growthAreas,
  getToken,
}: UseQuizReplenishmentParams): UseQuizReplenishmentReturn {
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [replenishAttempts, setReplenishAttempts] = useState(0);
  const [replenishmentError, setReplenishmentError] = useState<string | null>(null);
  const replenishAttemptsRef = useRef(0);

  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

  useEffect(() => {
    replenishAttemptsRef.current = replenishAttempts;
  }, [replenishAttempts]);

  const replenishQueue = useCallback(async () => {
    if (!shouldEndlesslyReplenish) return;
    if (isGeneratingQuestion) return;

    setIsGeneratingQuestion(true);
    setReplenishmentError(null);

    if (replenishAttemptsRef.current >= MAX_REPLENISH_ATTEMPTS) {
      setReplenishmentError('Unable to load questions after several attempts. Please try again later.');
      setIsGeneratingQuestion(false);
      return;
    }

    const nextAttemptCount = replenishAttemptsRef.current + 1;
    replenishAttemptsRef.current = nextAttemptCount;
    setReplenishAttempts(nextAttemptCount);

    try {
      let newQuestions: Question[] = [];
      const token = await getToken();

      try {
        if (token) {
          const result = await fetchSessionQuestions(sessionSettings, token, BATCH_SIZE);
          newQuestions = result.questions ?? [];
        }
      } catch (apiErr) {
        replenishLogger.warn('Session API replenish failed, using fallback', {
          error: apiErr,
        });
      }

      if (newQuestions.length === 0) {
        const fetchPromises = Array.from({ length: BATCH_SIZE }, () =>
          getQuestionClient(sessionSettings, growthAreas, getToken).catch((err) => {
            replenishLogger.warn('Single question fetch failed', { error: err });
            return null;
          })
        );
        const results = await Promise.all(fetchPromises);
        newQuestions = results.filter((q): q is Question => q !== null);
      }

      if (newQuestions.length > 0) {
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        replenishAttemptsRef.current = 0;
        setReplenishAttempts(0);
      } else {
        replenishLogger.warn('No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      replenishLogger.error('Failed to replenish queue', { error: err });
      setError('Unable to load more questions right now. You can continue with your current questions.');
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [
    shouldEndlesslyReplenish,
    sessionSettings,
    growthAreas,
    setParentQueue,
    setError,
    getToken,
    isGeneratingQuestion,
    setQueue,
  ]);

  const retryReplenishment = useCallback(async () => {
    replenishAttemptsRef.current = 0;
    setReplenishAttempts(0);
    setReplenishmentError(null);
    setError(null);
    await replenishQueue();
  }, [replenishQueue, setError]);

  // Proactive replenishment — trigger when queue drops below threshold
  useEffect(() => {
    if (shouldEndlesslyReplenish && queue.length < LOW_QUEUE_THRESHOLD && !isGeneratingQuestion) {
      void replenishQueue();
    }
  }, [queue.length, shouldEndlesslyReplenish, isGeneratingQuestion, replenishQueue]);

  return {
    isGeneratingQuestion,
    replenishAttempts,
    replenishmentError,
    shouldEndlesslyReplenish,
    replenishQueue,
    retryReplenishment,
  };
}
