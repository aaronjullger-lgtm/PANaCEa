import { useState, useCallback } from 'react';
import { FIRST_LINE_TREATMENTS, type FirstLineTreatment } from '@/data/firstLineTreatmentData';

export type FirstLineDrillStatus = 'menu' | 'playing' | 'feedback' | 'summary';

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
  pearl?: string;
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
  submitAnswer: (answerIndex: number) => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: FirstLineCategory) => void;
  exitToMenu: () => void;
}

function getRandomTreatments(count: number, exclude: string): FirstLineTreatment[] {
  return FIRST_LINE_TREATMENTS
    .filter(t => t.firstLine !== exclude)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function generateQuestion(treatment: FirstLineTreatment): FirstLineQuestion {
  const distractors = getRandomTreatments(3, treatment.firstLine);
  const options = [
    treatment.firstLine,
    ...distractors.map(d => d.firstLine)
  ];
  
  const shuffledOptions = options.sort(() => Math.random() - 0.5);
  const correctIndex = shuffledOptions.indexOf(treatment.firstLine);
  
  return {
    id: `fl-${treatment.id}-${Date.now()}`,
    condition: treatment.condition,
    category: treatment.category,
    options: shuffledOptions,
    correctAnswerIndex: correctIndex,
    explanation: treatment.explanation,
    pearl: treatment.pearl,
  };
}

function getRandomTreatmentByCategory(category: FirstLineCategory): FirstLineTreatment {
  let pool = FIRST_LINE_TREATMENTS;
  
  if (category !== 'random') {
    pool = FIRST_LINE_TREATMENTS.filter(t => t.category === category);
    if (pool.length === 0) {
      pool = FIRST_LINE_TREATMENTS;
    }
  }
  
  return pool[Math.floor(Math.random() * pool.length)];
}

const INITIAL_QUEUE_SIZE = 3;

export function useFirstLineDrill(): UseFirstLineDrillReturn {
  const [selectedCategory, setSelectedCategory] = useState<FirstLineCategory>('random');
  const [queue, setQueue] = useState<FirstLineQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [userAnswerIndex, setUserAnswerIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [status, setStatus] = useState<FirstLineDrillStatus>('menu');

  const currentQuestion = queue[currentIndex] ?? null;

  const startSession = useCallback((category: FirstLineCategory) => {
    setSelectedCategory(category);
    
    const initialQueue: FirstLineQuestion[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      const treatment = getRandomTreatmentByCategory(category);
      initialQueue.push(generateQuestion(treatment));
    }
    
    setQueue(initialQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, []);

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
    const treatment = getRandomTreatmentByCategory(selectedCategory);
    const newQuestion = generateQuestion(treatment);
    setQueue(prev => [...prev, newQuestion]);
    setCurrentIndex(prev => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory]);

  const reset = useCallback(() => {
    const newQueue: FirstLineQuestion[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      const treatment = getRandomTreatmentByCategory(selectedCategory);
      newQueue.push(generateQuestion(treatment));
    }
    
    setQueue(newQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory]);

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
