/**
 * useICDDrill — ICD-10 Coding Drill hook
 *
 * Presents clinical vignettes and asks students to identify the correct ICD-10 code.
 * Uses pre-curated high-yield codes with same-system distractors.
 * Integrates with FSRS via useDrillFSRS.
 *
 * @see lib/constants/high-yield-icd10.ts
 * @see components/drill/ICDCodingDrill.tsx
 */

import { useState, useCallback, useRef } from 'react';
import { useDrillFSRS } from '@/hooks/useDrillFSRS';
import { logger } from '@/lib/logger';
import {
  HIGH_YIELD_ICD10,
  pickDistractors,
  getICD10Systems,
  type ICD10Entry,
} from '@/lib/constants/high-yield-icd10';

const LOG_SCOPE = 'ICDDrill';

export interface ICDQuestion {
  id: string;
  vignette: string;
  correctCode: string;
  correctDescription: string;
  system: string;
  options: Array<{ code: string; description: string }>;
  correctAnswerIndex: number;
}

export type ICDDrillStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

export interface UseICDDrillReturn {
  currentQuestion: ICDQuestion | null;
  score: number;
  streak: number;
  totalAttempts: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: ICDDrillStatus;
  selectedSystem: string;
  availableSystems: string[];
  isLoading: boolean;
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (system: string) => void;
  exitToMenu: () => void;
  showCategoryMenu: () => void;
  fsrsNextReview: import('@/hooks/useDrillFSRS').FSRSNextReview | null;
}

const QUEUE_SIZE = 10;

/**
 * Generate a question locally from the curated ICD-10 list.
 * Vignette is a simplified clinical scenario; Gemini-generated vignettes
 * can be added later via an API endpoint.
 */
function generateLocalQuestion(entry: ICD10Entry): ICDQuestion {
  const distractors = pickDistractors(entry.code, entry.system, 4);

  // Build options: correct + distractors, shuffled
  const allOptions = [
    { code: entry.code, description: entry.description },
    ...distractors.map((d) => ({ code: d.code, description: d.description })),
  ];

  // Fisher-Yates shuffle
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }

  const correctAnswerIndex = allOptions.findIndex((o) => o.code === entry.code);

  return {
    id: `icd10-${entry.code}-${Date.now()}`,
    vignette: `A patient presents with a condition consistent with: ${entry.description}. Select the most appropriate ICD-10-CM code.`,
    correctCode: entry.code,
    correctDescription: entry.description,
    system: entry.system,
    options: allOptions,
    correctAnswerIndex,
  };
}

export function useICDDrill(): UseICDDrillReturn {
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [queue, setQueue] = useState<ICDQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ICDDrillStatus>('landing');
  const [isLoading, setIsLoading] = useState(false);

  const questionStartTimeRef = useRef<number>(Date.now());

  const {
    startQuestion: startQuestionFSRS,
    recordAnswerChange,
    submitAnswer: submitAnswerFSRS,
    fsrsNextReview,
  } = useDrillFSRS({ drillType: 'icd10' });

  const availableSystems = ['all', ...getICD10Systems()];

  const currentQuestion = queue[currentIndex] ?? null;

  /**
   * Generate a batch of questions from the curated list
   */
  const generateBatch = useCallback((system: string, count: number = QUEUE_SIZE): ICDQuestion[] => {
    const pool = system === 'all'
      ? [...HIGH_YIELD_ICD10]
      : HIGH_YIELD_ICD10.filter((e) => e.system === system);

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, count).map(generateLocalQuestion);
  }, []);

  const startSession = useCallback(
    (system: string) => {
      setSelectedSystem(system);
      setIsLoading(true);

      const questions = generateBatch(system);
      setQueue(questions);
      setCurrentIndex(0);
      setScore(0);
      setStreak(0);
      setTotalAttempts(0);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setStatus('playing');
      setIsLoading(false);

      if (questions[0]) {
        startQuestionFSRS(questions[0].id);
        questionStartTimeRef.current = Date.now();
      }

      logger.info(`[${LOG_SCOPE}] Session started`, { system, questionCount: questions.length });
    },
    [generateBatch, startQuestionFSRS]
  );

  const submitAnswer = useCallback(
    (answerIndex: number) => {
      if (!currentQuestion || userAnswerIndex !== null) return;

      const correct = answerIndex === currentQuestion.correctAnswerIndex;
      setUserAnswerIndex(answerIndex);
      setIsCorrect(correct);
      setTotalAttempts((prev) => prev + 1);
      setStatus('feedback');

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      // Submit to FSRS
      const selectedOption = currentQuestion.options[answerIndex];
      submitAnswerFSRS({
        questionId: currentQuestion.id,
        selectedAnswer: selectedOption?.code ?? '',
        correctAnswer: currentQuestion.correctCode,
        isCorrect: correct,
        timeSpentMs: Date.now() - questionStartTimeRef.current,
      });
    },
    [currentQuestion, userAnswerIndex, submitAnswerFSRS]
  );

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIndex + 1;

    // Refill if running low
    if (nextIdx >= queue.length - 2) {
      const moreQuestions = generateBatch(selectedSystem);
      setQueue((prev) => [...prev, ...moreQuestions]);
    }

    setCurrentIndex(nextIdx);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');

    const nextQ = queue[nextIdx];
    if (nextQ) {
      startQuestionFSRS(nextQ.id);
      questionStartTimeRef.current = Date.now();
    }
  }, [currentIndex, queue, selectedSystem, generateBatch, startQuestionFSRS]);

  const reset = useCallback(() => {
    setQueue([]);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('landing');
  }, []);

  const exitToMenu = useCallback(() => {
    setStatus('summary');
  }, []);

  const showCategoryMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  return {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    selectedSystem,
    availableSystems,
    isLoading,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
    fsrsNextReview,
  };
}
