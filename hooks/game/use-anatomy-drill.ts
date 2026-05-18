/**
 * useAnatomyDrill - Hook for Anatomy Review drill mode
 *
 * Fetches anatomy questions from the database and manages drill state.
 * Practice regional anatomy, landmarks, and clinical correlates.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { recordDrillSession } from '@/services/analytics';
import { useDrillFSRS } from '@/hooks/useDrillFSRS';
import { logger } from '@/lib/logger';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

const LOG_SCOPE = 'AnatomyDrill';

export type AnatomyDrillStatus = 'landing' | 'loading' | 'playing' | 'feedback' | 'error';

export interface AnatomyQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
  region?: string; // Anatomical region category
}

export interface UseAnatomyDrillReturn {
  currentQuestion: AnatomyQuestion | null;
  score: number;
  totalAttempts: number;
  streak: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: AnatomyDrillStatus;
  error: string | null;
  submitAnswer: (index: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: () => void;
  exitToMenu: () => void;
  fsrsNextReview: import('@/hooks/useDrillFSRS').FSRSNextReview | null;
}

export function useAnatomyDrill(): UseAnatomyDrillReturn {
  const [questions, setQuestions] = useState<AnatomyQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AnatomyDrillStatus>('landing');
  const [error, setError] = useState<string | null>(null);

  const sessionStartRef = useRef<number>(Date.now());
  const sessionDataRef = useRef({
    questionsAttempted: 0,
    correctAnswers: 0,
    bestStreak: 0,
  });
  const questionStartTimeRef = useRef<number>(Date.now());

  // Initialize unified FSRS submission hook
  const { startQuestion: startQuestionFSRS, recordAnswerChange, submitAnswer: submitAnswerFSRS, fsrsNextReview } = useDrillFSRS({
    drillType: 'anatomy',
  });

  const currentQuestion = questions[currentQuestionIndex] || null;

  // Fetch questions from API
  const fetchQuestions = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/questions?category=anatomy&limit=20');
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiEnvelopeError(responseJson, `Failed to fetch questions: ${response.statusText}`)
        );
      }

      const data = unwrapApiEnvelope<{ questions?: Array<Record<string, unknown>> }>(responseJson);

      if (!data.questions || data.questions.length === 0) {
        throw new Error('No anatomy questions available. Please check back later or contact support.');
      }

      // Transform database questions
      const transformedQuestions: AnatomyQuestion[] = data.questions.map((q: any) => {
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        const tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags || [];

        // Find index of correct answer in options array
        const correctIndex = options.findIndex((opt: string) => opt === q.correctAnswer);

        return {
          id: q.id,
          question: q.question,
          options,
          correctIndex,
          explanation: q.explanation,
          tags,
        };
      });

      // Shuffle questions
      const shuffled = transformedQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentQuestionIndex(0);
      setStatus('playing');

      // Start FSRS tracking for the first question
      questionStartTimeRef.current = Date.now();
      startQuestionFSRS();
    } catch (err) {
      logger.error(`[${LOG_SCOPE}] Failed to fetch questions`, { error: err });
      setError(err instanceof Error ? err.message : 'Failed to load questions');
      setStatus('error');
    }
  }, []);

  const submitAnswer = useCallback(
    (index: number) => {
      if (!currentQuestion || status !== 'playing') return;

      setUserAnswerIndex(index);
      const correct = index === currentQuestion.correctIndex;
      setIsCorrect(correct);

      setTotalAttempts((prev) => prev + 1);
      sessionDataRef.current.questionsAttempted += 1;

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => {
          const newStreak = prev + 1;
          sessionDataRef.current.bestStreak = Math.max(
            sessionDataRef.current.bestStreak,
            newStreak
          );
          return newStreak;
        });
        sessionDataRef.current.correctAnswers += 1;
      } else {
        setStreak(0);
      }

      // Submit to FSRS pipeline
      const timeSpentMs = Date.now() - questionStartTimeRef.current;
      const selectedAnswer = currentQuestion.options[index];

      // Fire-and-forget FSRS submission (don't block UI)
      submitAnswerFSRS({
        questionId: currentQuestion.id,
        selectedAnswer,
        timeSpentMs,
      }).catch((err) => {
        logger.error(`[${LOG_SCOPE}] FSRS submission failed`, { error: err });
      });

      setStatus('feedback');
    },
    [currentQuestion, status, submitAnswerFSRS]
  );

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setStatus('playing');

      // Start FSRS tracking for the new question
      questionStartTimeRef.current = Date.now();
      startQuestionFSRS();
    } else {
      // End of questions - fetch more
      fetchQuestions();
    }
  }, [currentQuestionIndex, questions.length, fetchQuestions, startQuestionFSRS]);

  const reset = useCallback(() => {
    // Record session before reset
    if (sessionDataRef.current.questionsAttempted > 0) {
      const endTime = Date.now();
      recordDrillSession({
        drillType: 'anatomy_review',
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: new Date(endTime).toISOString(),
        questionsAttempted: sessionDataRef.current.questionsAttempted,
        correctAnswers: sessionDataRef.current.correctAnswers,
        accuracy:
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) * 100,
        timeSpent: Math.round((endTime - sessionStartRef.current) / 1000),
        bestStreak: sessionDataRef.current.bestStreak,
      });
    }

    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setTotalAttempts(0);
    setStreak(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('landing');
    setError(null);

    sessionStartRef.current = Date.now();
    sessionDataRef.current = {
      questionsAttempted: 0,
      correctAnswers: 0,
      bestStreak: 0,
    };
  }, []);

  const startSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    sessionDataRef.current = {
      questionsAttempted: 0,
      correctAnswers: 0,
      bestStreak: 0,
    };
    questionStartTimeRef.current = Date.now();
    fetchQuestions();
  }, [fetchQuestions, startQuestionFSRS]);

  const exitToMenu = useCallback(() => {
    if (sessionDataRef.current.questionsAttempted > 0) {
      const endTime = Date.now();
      recordDrillSession({
        drillType: 'anatomy_review',
        startTime: new Date(sessionStartRef.current).toISOString(),
        endTime: new Date(endTime).toISOString(),
        questionsAttempted: sessionDataRef.current.questionsAttempted,
        correctAnswers: sessionDataRef.current.correctAnswers,
        accuracy:
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) * 100,
        timeSpent: Math.round((endTime - sessionStartRef.current) / 1000),
        bestStreak: sessionDataRef.current.bestStreak,
      });
    }

    setStatus('landing');
  }, []);

  return {
    currentQuestion,
    score,
    totalAttempts,
    streak,
    userAnswerIndex,
    isCorrect,
    status,
    error,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    fsrsNextReview,
  };
}
