import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useCommuter } from '@/contexts/CommuterContext';
import { useQuizSessionRecovery } from '@/hooks/useQuizSessionRecovery';
import { debounce } from '@/lib/utils/debounce';
import { logger } from '@/lib/logger';
import { getQuestionClient } from '@/services/client/questionApi';
import { fetchSessionQuestions } from '@/services/core';
import type { Question, SessionSettings, PerformanceRecord } from '@/types';

const LOG_SCOPE = 'QuizView:useQuizSession';

const BATCH_SIZE = 25;
const LOW_QUEUE_THRESHOLD = 20;
const MAX_REPLENISH_ATTEMPTS = 3;

export interface UseQuizSessionParams {
  initialQueue: Question[];
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  setError: (error: string | null) => void;
  sessionSettings: SessionSettings;
  growthAreas: string[];
  performanceData: PerformanceRecord[];
  getToken: () => Promise<string | null>;
}

/**
 * Queue management, replenishment, session recovery, and session lifecycle.
 */
export function useQuizSession({
  initialQueue,
  setParentQueue,
  setError,
  sessionSettings,
  growthAreas,
  performanceData,
  getToken,
}: UseQuizSessionParams) {
  const { user } = useUser();
  const commuter = useCommuter();

  // ---- QUEUE STATE ----
  const [queue, setQueue] = useState<Question[]>(initialQueue);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQueue[0] || null);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [replenishAttempts, setReplenishAttempts] = useState(0);
  const [replenishmentError, setReplenishmentError] = useState<string | null>(null);

  // Session overlay state
  const [showSessionEndSummary, setShowSessionEndSummary] = useState(false);
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);

  // Refs shared with other hooks
  const answerChangeCountRef = useRef<number>(0);
  const firstSelectedAnswerRef = useRef<number | null>(null);
  const recoveredSessionScoreRef = useRef<{ correct: number; total: number } | null>(null);
  const sessionStartTime = useRef(Date.now());

  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

  // ---- SESSION RECOVERY ----
  const { saveState, clearSavedState } = useQuizSessionRecovery({
    userId: user?.id,
    sessionSettings,
    initialQueue,
    onRestore: (restored) => {
      if (restored.queue && restored.queue.length > 0) {
        setQueue(restored.queue);
        setParentQueue(restored.queue);
      }
      if (restored.currentQuestionIndex !== undefined && restored.queue) {
        const idx = restored.currentQuestionIndex;
        if (idx >= 0 && idx < restored.queue.length) {
          setCurrentQuestion(restored.queue[idx]);
        }
      }
      if (restored.questionNumber !== undefined) setQuestionNumber(restored.questionNumber);
      if (restored.answerChangeCount !== undefined) answerChangeCountRef.current = restored.answerChangeCount;
      if (restored.firstSelectedAnswer !== undefined) firstSelectedAnswerRef.current = restored.firstSelectedAnswer;
      if (restored.sessionScore) recoveredSessionScoreRef.current = restored.sessionScore;
    },
  });

  const debouncedSave = useRef(
    debounce((state: Parameters<typeof saveState>[0]) => saveState(state), 1000)
  ).current;

  // ---- REPLENISH ----
  const replenishQueue = useCallback(async () => {
    if (!shouldEndlesslyReplenish || isGeneratingQuestion) return;

    setIsGeneratingQuestion(true);
    setReplenishmentError(null);
    if (replenishAttempts >= MAX_REPLENISH_ATTEMPTS) {
      setReplenishmentError('Unable to load questions after several attempts. Please try again later.');
      setIsGeneratingQuestion(false);
      return;
    }
    setReplenishAttempts(prev => prev + 1);

    try {
      let newQuestions: Question[] = [];
      const token = await getToken();

      try {
        if (token) {
          const result = await fetchSessionQuestions(sessionSettings, token, BATCH_SIZE);
          newQuestions = result.questions ?? [];
        }
      } catch (apiErr) {
        logger.warn(LOG_SCOPE, 'Session API replenish failed, using fallback', apiErr);
      }

      if (newQuestions.length === 0) {
        const fetchPromises = Array.from({ length: BATCH_SIZE }, () =>
          getQuestionClient(sessionSettings, growthAreas, getToken).catch((err) => {
            logger.warn(LOG_SCOPE, 'Single question fetch failed', err);
            return null;
          })
        );
        const results = await Promise.all(fetchPromises);
        newQuestions = results.filter((q): q is Question => q !== null);
      }

      if (newQuestions.length > 0) {
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        setReplenishAttempts(0);
      } else {
        logger.warn(LOG_SCOPE, 'No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      logger.error(LOG_SCOPE, 'Failed to replenish queue', err);
      setError('Unable to load more questions right now. You can continue with your current questions.');
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [shouldEndlesslyReplenish, isGeneratingQuestion, replenishAttempts, sessionSettings, growthAreas, setParentQueue, setError, getToken]);

  // Proactive replenishment when queue drops below threshold
  useEffect(() => {
    if (shouldEndlesslyReplenish && queue.length < LOW_QUEUE_THRESHOLD && !isGeneratingQuestion) {
      void replenishQueue();
    }
  }, [queue.length, shouldEndlesslyReplenish, isGeneratingQuestion, replenishQueue]);

  // Keep current question synced with queue[0]
  useEffect(() => {
    setCurrentQuestion(queue[0] || null);
  }, [queue]);

  // Initialize from incoming queue once
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueue, currentQuestion]);

  // Clear saved state when session ends
  useEffect(() => {
    if (showSessionEndSummary) clearSavedState();
  }, [showSessionEndSummary, clearSavedState]);

  // Auto-read question aloud when commuter mode is active
  useEffect(() => {
    if (!commuter?.isCommuterMode || !commuter.settings.autoReadQuestions || !currentQuestion) return;
    const vignette = currentQuestion.vignette ? currentQuestion.vignette + ' ' : '';
    const stem = currentQuestion.stem || '';
    const text = vignette + stem;
    if (text.trim()) {
      commuter.speak(text);
      const timer = setTimeout(() => {
        if (commuter.settings.voiceEnabled) commuter.startListening();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [commuter, currentQuestion]);

  return {
    queue, setQueue, currentQuestion, setCurrentQuestion, questionNumber, setQuestionNumber,
    isGeneratingQuestion, replenishAttempts, setReplenishAttempts, replenishmentError,
    shouldEndlesslyReplenish,
    showSessionEndSummary, setShowSessionEndSummary,
    showStatsOverlay, setShowStatsOverlay,
    sessionStartTime, commuter,
    debouncedSave, saveState, clearSavedState, recoveredSessionScoreRef,
    answerChangeCountRef, firstSelectedAnswerRef,
    replenishQueue,
  };
}
