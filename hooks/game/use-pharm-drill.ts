import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// Import type definitions from the API endpoint
export interface PharmQuestion {
  id: string;
  type: PharmQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  drugName: string;
  drugClass: string | string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export type PharmQuestionType = 
  | 'mechanism'
  | 'side_effect'
  | 'contraindication'
  | 'drug_class'
  | 'antidote'
  | 'interaction'
  | 'clinical_use';

export type PharmDrillStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

export type PharmCategory = 
  | 'mechanism'
  | 'side_effect'
  | 'contraindication'
  | 'drug_class'
  | 'antidote'
  | 'interaction'
  | 'clinical_use'
  | 'random';

export interface UsePharmDrillReturn {
  currentQuestion: PharmQuestion | null;
  score: number;
  streak: number;
  totalAttempts: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: PharmDrillStatus;
  selectedCategory: PharmCategory;
  isLoading: boolean;
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: PharmCategory) => void;
  exitToMenu: () => void;
  showCategoryMenu: () => void;
}

const INITIAL_QUEUE_SIZE = 10; // Fetch multiple questions at once
const REFILL_THRESHOLD = 3; // Refill queue when this many questions remain

export function usePharmDrill(): UsePharmDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<PharmCategory>('random');
  const [queue, setQueue] = useState<PharmQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PharmDrillStatus>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);

  const currentQuestion = queue[currentIndex] ?? null;

  /**
   * Fetch questions from the API
   */
  const fetchQuestions = useCallback(async (category: PharmCategory, count: number = INITIAL_QUEUE_SIZE): Promise<PharmQuestion[]> => {
    if (isFetchingRef.current) return [];
    
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        count: count.toString(),
      });

      // Map category to API question type
      if (category !== 'random') {
        params.append('category', category);
      }

      const response = await fetch(`/api/drills/pharm?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.statusText}`);
      }

      const questions: PharmQuestion[] = await response.json();
      return questions;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load questions';
      setError(errorMessage);
      console.error('Error fetching pharm questions:', err);
      return [];
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  /**
   * Refill the question queue when running low
   */
  const refillQueue = useCallback(async () => {
    const remainingQuestions = queue.length - currentIndex;
    
    if (remainingQuestions <= REFILL_THRESHOLD && !isFetchingRef.current) {
      const newQuestions = await fetchQuestions(selectedCategory, INITIAL_QUEUE_SIZE);
      if (newQuestions.length > 0) {
        setQueue(prev => [...prev, ...newQuestions]);
      }
    }
  }, [queue.length, currentIndex, selectedCategory, fetchQuestions]);

  // Auto-refill queue when needed
  useEffect(() => {
    if (status === 'playing') {
      refillQueue();
    }
  }, [currentIndex, status, refillQueue]);

  const startSession = useCallback(async (category: PharmCategory) => {
    setSelectedCategory(category);
    setIsLoading(true);
    
    const initialQuestions = await fetchQuestions(category, INITIAL_QUEUE_SIZE);
    
    if (initialQuestions.length === 0) {
      setError('Failed to load questions. Please try again.');
      setStatus('landing');
      return;
    }
    
    setQueue(initialQuestions);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [fetchQuestions]);

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

  const submitAnswer = useCallback((answerIndex: number) => {
    if (!currentQuestion || status !== 'playing') return;

    setUserAnswerIndex(answerIndex);
    setTotalAttempts(prev => prev + 1);
    
    const correct = answerIndex === currentQuestion.correctAnswerIndex;
    setIsCorrect(correct);

    if (correct) {
      setScore(prev => prev + 1);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }

    setStatus('feedback');
  }, [currentQuestion, status]);

  const nextQuestion = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, []);

  const reset = useCallback(async () => {
    setIsLoading(true);
    
    const newQuestions = await fetchQuestions(selectedCategory, INITIAL_QUEUE_SIZE);
    
    if (newQuestions.length === 0) {
      setError('Failed to load questions. Please try again.');
      setStatus('landing');
      return;
    }
    
    setQueue(newQuestions);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, fetchQuestions]);

  return {
    isLoading,
    currentQuestion,
    score,
    streak,
    totalAttempts,
    userAnswerIndex,
    isCorrect,
    status,
    selectedCategory,
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
  };
}
