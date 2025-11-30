import { useState, useCallback, useMemo } from 'react';
import { generatePharmQuestion, type PharmQuestion, type PharmQuestionType } from '@/data/pharmQuizData';

export type PharmDrillStatus = 'menu' | 'playing' | 'feedback' | 'summary';

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
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: PharmCategory) => void;
  exitToMenu: () => void;
}

const INITIAL_QUEUE_SIZE = 3;

export function usePharmDrill(): UsePharmDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<PharmCategory>('random');
  const [queue, setQueue] = useState<PharmQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PharmDrillStatus>('menu');

  const currentQuestion = queue[currentIndex] ?? null;

  const getQuestionType = useCallback((category: PharmCategory): PharmQuestionType | undefined => {
    if (category === 'random') return undefined;
    return category as PharmQuestionType;
  }, []);

  const generateNewQuestion = useCallback((category: PharmCategory): PharmQuestion => {
    const type = getQuestionType(category);
    return generatePharmQuestion(type);
  }, [getQuestionType]);

  const startSession = useCallback((category: PharmCategory) => {
    setSelectedCategory(category);
    
    const initialQueue: PharmQuestion[] = [];
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
  }, [generateNewQuestion]);

  const exitToMenu = useCallback(() => {
    setStatus('menu');
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
    const newQuestion = generateNewQuestion(selectedCategory);
    setQueue(prev => [...prev, newQuestion]);
    setCurrentIndex(prev => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewQuestion]);

  const reset = useCallback(() => {
    const newQueue: PharmQuestion[] = [];
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
    submitAnswer,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
  };
}
