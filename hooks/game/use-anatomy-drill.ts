/**
 * useAnatomyDrill - Hook for Anatomy Review drill mode
 * 
 * Fetches anatomy questions from the database and manages drill state.
 * Practice regional anatomy, landmarks, and clinical correlates.
 */

import { useState, useCallback, useRef } from 'react';
import { recordDrillSession } from '@/services/drillStatsService';

export type AnatomyDrillStatus = 'landing' | 'loading' | 'playing' | 'feedback' | 'error';

export interface AnatomyQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
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

  const currentQuestion = questions[currentQuestionIndex] || null;

  // Fetch questions from API
  const fetchQuestions = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/questions?category=anatomy&limit=20');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No anatomy questions available. Please run seed script.');
      }

      // Transform database questions
      const transformedQuestions: AnatomyQuestion[] = data.questions.map((q: any) => {
        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        const tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : (q.tags || []);
        
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
    } catch (err) {
      console.error('Error fetching anatomy questions:', err);
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

      setStatus('feedback');
    },
    [currentQuestion, status]
  );

  const nextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setStatus('playing');
    } else {
      // End of questions - fetch more
      fetchQuestions();
    }
  }, [currentQuestionIndex, questions.length, fetchQuestions]);

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
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) *
          100,
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
    fetchQuestions();
  }, [fetchQuestions]);

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
          (sessionDataRef.current.correctAnswers / sessionDataRef.current.questionsAttempted) *
          100,
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
  };
}
