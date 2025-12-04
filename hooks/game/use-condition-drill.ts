import { useState, useCallback, useRef } from 'react';
import { generateConditionQuestion, type ConditionQuestion, type ConditionQuestionType } from '@/data/conditionDrillData';

export type ConditionDrillStatus = 'landing' | 'menu' | 'playing' | 'feedback' | 'summary';

export type ConditionCategory = 
  | 'presentation'
  | 'diagnosis'
  | 'etiology'
  | 'complication'
  | 'random';

export interface UseConditionDrillReturn {
  currentQuestion: ConditionQuestion | null;
  score: number;
  streak: number;
  totalAttempts: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: ConditionDrillStatus;
  selectedCategory: ConditionCategory;
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: ConditionCategory) => void;
  exitToMenu: () => void;
}

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_CONDITIONS = 20; // Track last 20 conditions to avoid repetition

export function useConditionDrill(): UseConditionDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<ConditionCategory>('random');
  const [queue, setQueue] = useState<ConditionQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ConditionDrillStatus>('landing');
  
  // Track recently used conditions to avoid repetition
  const recentConditionsRef = useRef<Set<string>>(new Set());

  const currentQuestion = queue[currentIndex] ?? null;

  const getQuestionType = useCallback((category: ConditionCategory): ConditionQuestionType | undefined => {
    if (category === 'random') return undefined;
    return category as ConditionQuestionType;
  }, []);

  const generateNewQuestion = useCallback((category: ConditionCategory): ConditionQuestion => {
    const type = getQuestionType(category);
    let attempts = 0;
    let question: ConditionQuestion;
    
    // Try to generate a question with a condition we haven't seen recently
    do {
      question = generateConditionQuestion(type);
      attempts++;
    } while (recentConditionsRef.current.has(question.conditionName) && attempts < 10);
    
    // Add to recent conditions and maintain max size
    recentConditionsRef.current.add(question.conditionName);
    if (recentConditionsRef.current.size > MAX_RECENT_CONDITIONS) {
      const firstItem = recentConditionsRef.current.values().next().value;
      if (firstItem) recentConditionsRef.current.delete(firstItem);
    }
    
    return question;
  }, [getQuestionType]);

  const startSession = useCallback((category: ConditionCategory) => {
    setSelectedCategory(category);
    recentConditionsRef.current.clear(); // Clear history on new session
    
    const initialQueue: ConditionQuestion[] = [];
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
    recentConditionsRef.current.clear(); // Clear history on reset
    const newQueue: ConditionQuestion[] = [];
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
