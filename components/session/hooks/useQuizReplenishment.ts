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
  // S4 — Synchronous in-flight guard. The useState-backed `isGeneratingQuestion`
  // only flips after React commits, so two rapid triggers in the same tick
  // (React 19 strict-mode dev double-fire, rapid queue-length changes, effect +
  // stale-closure races) can both read `false` and launch parallel fetches.
  // This ref flips synchronously inside replenishQueue so overlapping calls
  // short-circuit before hitting setState or the network.
  const isReplenishingRef = useRef(false);
  // S5 — AbortController plumbing. On unmount (or when a fresh replenishment
  // starts) we abort any in-flight fetches so (a) up to 25 parallel question
  // fetches don't keep hitting the network after the user leaves the session,
  // and (b) no setState fires after the component is gone. The controller is
  // re-created per replenishment attempt so one abort doesn't poison the next.
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUnmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

  useEffect(() => {
    replenishAttemptsRef.current = replenishAttempts;
  }, [replenishAttempts]);

  const replenishQueue = useCallback(async () => {
    if (!shouldEndlesslyReplenish) return;
    if (isUnmountedRef.current) return;
    // Synchronous guard first — wins any race with the state-based guard below.
    if (isReplenishingRef.current) return;
    if (isGeneratingQuestion) return;

    // S5 — Fresh controller per attempt, so previous aborts don't leak into
    // this one. The previous controller (if any) is replaced; any remaining
    // in-flight fetch from a prior attempt is abandoned (the outer ref guard
    // already prevents overlap).
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    const isAborted = () => signal.aborted || isUnmountedRef.current;

    isReplenishingRef.current = true;
    setIsGeneratingQuestion(true);
    setReplenishmentError(null);

    if (replenishAttemptsRef.current >= MAX_REPLENISH_ATTEMPTS) {
      setReplenishmentError('Unable to load questions after several attempts. Please try again later.');
      setIsGeneratingQuestion(false);
      isReplenishingRef.current = false;
      return;
    }

    const nextAttemptCount = replenishAttemptsRef.current + 1;
    replenishAttemptsRef.current = nextAttemptCount;
    setReplenishAttempts(nextAttemptCount);

    try {
      let newQuestions: Question[] = [];
      const token = await getToken();
      if (isAborted()) return;

      try {
        if (token) {
          const result = await fetchSessionQuestions(sessionSettings, token, BATCH_SIZE, signal);
          newQuestions = result.questions ?? [];
        }
      } catch (apiErr) {
        // Don't fall through to fallback if we were cancelled — the component
        // is unmounting or a new replenishment is starting.
        if (isAborted() || (apiErr as { name?: string })?.name === 'AbortError') {
          return;
        }
        replenishLogger.warn('Session API replenish failed, using fallback', {
          error: apiErr,
        });
      }

      if (isAborted()) return;

      if (newQuestions.length === 0) {
        const fetchPromises = Array.from({ length: BATCH_SIZE }, () =>
          getQuestionClient(sessionSettings, growthAreas, getToken, signal).catch((err) => {
            if ((err as { name?: string })?.name === 'AbortError') {
              // Propagate as null; outer isAborted() check handles it.
              return null;
            }
            replenishLogger.warn('Single question fetch failed', { error: err });
            return null;
          })
        );
        const results = await Promise.all(fetchPromises);
        if (isAborted()) return;
        newQuestions = results.filter((q): q is Question => q !== null);
      }

      if (isAborted()) return;

      if (newQuestions.length > 0) {
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        replenishAttemptsRef.current = 0;
        setReplenishAttempts(0);
      } else {
        replenishLogger.warn('No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      // S5 — AbortError is a silent cancellation. Never surface it to the user
      // and never count it as a failed attempt.
      if (isAborted() || (err as { name?: string })?.name === 'AbortError') {
        return;
      }
      replenishLogger.error('Failed to replenish queue', { error: err });
      setError('Unable to load more questions right now. You can continue with your current questions.');
    } finally {
      // Only touch React state if the component is still mounted and this
      // fetch wasn't aborted — otherwise we'd setState on an unmounted
      // component or clobber a newer in-flight attempt.
      if (!isAborted()) {
        setIsGeneratingQuestion(false);
      }
      // Ref is always safe to release — no React warning, and releasing it
      // lets the next legitimate trigger (e.g., a fresh session remount) fire.
      isReplenishingRef.current = false;
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
