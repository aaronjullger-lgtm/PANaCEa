import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generatePharmQuestion, type PharmQuestion, type PharmQuestionType, type Drug } from '@/data/pharmQuizData';
import { drugService } from '@/services/drugService';

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

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_DRUGS = 20; // Track last 20 drugs to avoid repetition

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
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track recently used drugs to avoid repetition
  const recentDrugsRef = useRef<Set<string>>(new Set());

  // Fetch drugs on mount
  useEffect(() => {
    const loadDrugs = async () => {
      try {
        // Fetch all drugs to have a good pool for distractors
        const fetchedDrugs = await drugService.getAll();
        setDrugs(fetchedDrugs);
      } catch (error) {
        console.error('Failed to load drugs:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDrugs();
  }, []);

  const currentQuestion = queue[currentIndex] ?? null;

  const getQuestionType = useCallback((category: PharmCategory): PharmQuestionType | undefined => {
    if (category === 'random') return undefined;
    return category as PharmQuestionType;
  }, []);

  const generateNewQuestion = useCallback((category: PharmCategory): PharmQuestion | null => {
    if (drugs.length === 0) return null;

    const type = getQuestionType(category);
    let attempts = 0;
    let drug: Drug;
    
    // Try to generate a question with a drug we haven't seen recently
    do {
      drug = drugs[Math.floor(Math.random() * drugs.length)];
      attempts++;
    } while (recentDrugsRef.current.has(drug.genericName) && attempts < 10);
    
    const question = generatePharmQuestion(drug, drugs, type);

    // Add to recent drugs and maintain max size
    recentDrugsRef.current.add(question.drugName);
    if (recentDrugsRef.current.size > MAX_RECENT_DRUGS) {
      const firstItem = recentDrugsRef.current.values().next().value;
      if (firstItem) recentDrugsRef.current.delete(firstItem);
    }
    
    return question;
  }, [drugs, getQuestionType]);

  const startSession = useCallback((category: PharmCategory) => {
    if (drugs.length === 0) return;

    setSelectedCategory(category);
    recentDrugsRef.current.clear(); // Clear history on new session
    
    const initialQueue: PharmQuestion[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      const q = generateNewQuestion(category);
      if (q) initialQueue.push(q);
    }
    
    setQueue(initialQueue);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [generateNewQuestion, drugs]);

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
    const newQuestion = generateNewQuestion(selectedCategory);
    if (newQuestion) {
      setQueue(prev => [...prev, newQuestion]);
    }
    setCurrentIndex(prev => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setStatus('playing');
  }, [selectedCategory, generateNewQuestion]);

  const reset = useCallback(() => {
    if (drugs.length === 0) return;
    recentDrugsRef.current.clear(); // Clear history on reset
    const newQueue: PharmQuestion[] = [];
    for (let i = 0; i < INITIAL_QUEUE_SIZE; i++) {
      const q = generateNewQuestion(selectedCategory);
      if (q) newQueue.push(q);
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
    showCategoryMenu,
  };
}
