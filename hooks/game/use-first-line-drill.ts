import { useState, useCallback, useRef, useEffect } from 'react';
import { firstLineService } from '@/services/domain';
import type { FirstLineTreatmentDTO } from '@/types/question-bank';

// Use client-safe DTO type instead of Prisma type
type FirstLineTreatment = FirstLineTreatmentDTO;

export type FirstLineDrillStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

export type FirstLineCategory =
  | 'Cardiology'
  | 'Pulmonology'
  | 'Infectious Disease'
  | 'Endocrinology'
  | 'Gastroenterology'
  | 'Psychiatry'
  | 'Neurology'
  | 'Rheumatology'
  | 'random';

export interface FirstLineQuestion {
  id: string;
  condition: string;
  category: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  pearl?: string | null;
}

export interface UseFirstLineDrillReturn {
  currentQuestion: FirstLineQuestion | null;
  score: number;
  streak: number;
  totalAttempts: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: FirstLineDrillStatus;
  selectedCategory: FirstLineCategory;
  isLoading: boolean;
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: FirstLineCategory) => void;
  exitToMenu: () => void;
  showCategoryMenu: () => void;
}

function getRandomTreatments(
  treatments: FirstLineTreatment[],
  count: number,
  exclude: string
): FirstLineTreatment[] {
  return treatments
    .filter((t) => t.treatment !== exclude)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function generateQuestion(
  treatment: FirstLineTreatment,
  allTreatments: FirstLineTreatment[]
): FirstLineQuestion {
  const distractors = getRandomTreatments(allTreatments, 3, treatment.treatment);
  const options = [treatment.treatment, ...distractors.map((d) => d.treatment)];

  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(treatment.treatment);

  return {
    id: `fl-${treatment.id}-${Date.now()}`,
    condition: treatment.condition,
    category: treatment.category,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: `The first-line treatment for ${treatment.condition} is ${treatment.treatment}.`,
    pearl: null,
  };
}

function getRandomTreatmentByCategory(
  treatments: FirstLineTreatment[],
  category: FirstLineCategory,
  exclude?: Set<string>
): FirstLineTreatment {
  let pool = treatments;

  if (category !== 'random') {
    pool = treatments.filter((t) => t.category === category);
    if (pool.length === 0) {
      pool = treatments;
    }
  }

  // Filter out recently seen conditions
  if (exclude && exclude.size > 0) {
    const filtered = pool.filter((t) => !exclude.has(t.condition));
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_CONDITIONS = 15; // Track last 15 conditions to avoid repetition

export function useFirstLineDrill(): UseFirstLineDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<FirstLineCategory>('random');
  const [allTreatments, setAllTreatments] = useState<FirstLineTreatment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [queue, setQueue] = useState<FirstLineQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<FirstLineDrillStatus>('landing');

  // Track recently used conditions to avoid repetition
  const recentConditionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadTreatments = async () => {
      try {
        const data = await firstLineService.getAll();
        setAllTreatments(data);
      } catch (error) {
        console.error('Failed to load first line treatments', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTreatments();
  }, []);

  const currentQuestion = queue[currentIndex] ?? null;

  const generateNewQuestion = useCallback(
    (category: FirstLineCategory): FirstLineQuestion => {
      if (allTreatments.length === 0) return {} as FirstLineQuestion; // Should be guarded by isLoading

      const treatment = getRandomTreatmentByCategory(
        allTreatments,
        category,
        recentConditionsRef.current
      );

      // Add to recent conditions and maintain max size
      recentConditionsRef.current.add(treatment.condition);
      if (recentConditionsRef.current.size > MAX_RECENT_CONDITIONS) {
        const firstItem = recentConditionsRef.current.values().next().value;
        if (firstItem) recentConditionsRef.current.delete(firstItem);
      }

      return generateQuestion(treatment, allTreatments);
    },
    [allTreatments]
  );

  const startSession = useCallback(
    (category: FirstLineCategory) => {
      if (allTreatments.length === 0) return;

      setSelectedCategory(category);
      recentConditionsRef.current.clear(); // Clear history on new session

      const initialQueue: FirstLineQuestion[] = [];
      for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
        initialQueue.push(generateNewQuestion(category));
      }

      setQueue(initialQueue);
      setCurrentIndex(0);
      setScore(0);
      setStreak(0);
      setTotalAttempts(0);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setStatus('playing');
    },
    [generateNewQuestion, allTreatments]
  );

  const showCategoryMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  const exitToMenu = useCallback(() => {
    setStatus('landing');
    setQueue([]);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
  }, []);

  const submitAnswer = useCallback(
    (answerIndex: number) => {
      if (!currentQuestion || status !== 'playing') return;

      setUserAnswerIndex(answerIndex);
      setTotalAttempts((prev) => prev + 1);

      const correct = answerIndex === currentQuestion.correctAnswerIndex;
      setIsCorrect(correct);

      if (correct) {
        setScore((prev) => prev + 1);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      setStatus('feedback');
    },
    [currentQuestion, status]
  );

  const nextQuestion = useCallback(() => {
    const newQuestion = generateNewQuestion(selectedCategory);
    setQueue((prev) => [...prev, newQuestion]);
    setCurrentIndex((prev) => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewQuestion]);

  const reset = useCallback(() => {
    recentConditionsRef.current.clear(); // Clear history on reset
    const newQueue: FirstLineQuestion[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      newQueue.push(generateNewQuestion(selectedCategory));
    }

    setQueue(newQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewQuestion]);

  return {
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    selectedCategory,
    isLoading,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
  };
}
