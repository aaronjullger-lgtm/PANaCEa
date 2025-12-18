import { useState, useCallback, useRef, useEffect } from 'react';
import { type ConditionQuestionType } from '@/data/conditionDrillData';
import type { QuestionDTO } from '@/lib/services/questionBankService';

export type ConditionDrillStatus = 'landing' | 'menu' | 'playing' | 'coaching' | 'feedback' | 'summary';

export type ConditionCategory = 
  | 'presentation'
  | 'diagnosis'
  | 'etiology'
  | 'complication'
  | 'random';

export interface ConditionQuestion {
  id: string;
  type: ConditionQuestionType;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  conditionName: string;
  system: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface UseConditionDrillReturn {
  currentQuestion: ConditionQuestion | null;
  score: number;
  streak: number;
  totalAttempts: number;
  userAnswerIndex: number | null;
  isCorrect: boolean | null;
  status: ConditionDrillStatus;
  selectedCategory: ConditionCategory;
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  socraticHint: string | null;
  isLoadingHint: boolean;
  attemptNumber: number;
  submitAnswer: (answerIndex: number) => void;
  retryAfterHint: () => void;
  nextQuestion: () => void;
  reset: () => void;
  startSession: (category: ConditionCategory) => void;
  exitToMenu: () => void;
  showCategoryMenu: () => void;
}

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_CONDITIONS = 20; // Track last 20 conditions to avoid repetition

function mapDtoToConditionQuestion(dto: QuestionDTO): ConditionQuestion {
  const correctIndex = dto.options.indexOf(dto.correctAnswer);
  return {
    id: dto.id,
    type: 'diagnosis', // Default type since API doesn't specify
    question: dto.vignette || dto.question,
    options: dto.options,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: dto.explanation,
    conditionName: dto.system,
    system: dto.system,
    difficulty: (dto.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
  };
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socraticHint, setSocraticHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [firstAttemptAnswer, setFirstAttemptAnswer] = useState<number | null>(null);
  
  // Track recently used conditions to avoid repetition
  const recentConditionsRef = useRef<Set<string>>(new Set());

  const currentQuestion = queue[currentIndex] ?? null;

  const fetchQuestionsFromAPI = useCallback(async (count: number = INITIAL_QUEUE_SIZE): Promise<ConditionQuestion[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/questions?limit=${count}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.questions) {
        throw new Error('Invalid response from server');
      }
      
      const mappedQuestions = data.questions.map(mapDtoToConditionQuestion);
      return mappedQuestions;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load questions';
      setError(errorMsg);
      console.error('Error fetching questions:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getQuestionType = useCallback((category: ConditionCategory): ConditionQuestionType | undefined => {
    if (category === 'random') return undefined;
    return category as ConditionQuestionType;
  }, []);

  const startSession = useCallback(async (category: ConditionCategory) => {
    setSelectedCategory(category);
    recentConditionsRef.current.clear(); // Clear history on new session
    
    const questions = await fetchQuestionsFromAPI(INITIAL_QUEUE_SIZE);
    
    if (questions.length === 0) {
      setError('No questions available. Please try again.');
      return;
    }
    
    setQueue(questions);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setSocraticHint(null);
    setAttemptNumber(1);
    setFirstAttemptAnswer(null);
    setStatus('playing');
  }, [fetchQuestionsFromAPI]);

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
    setSocraticHint(null);
    setAttemptNumber(1);
    setFirstAttemptAnswer(null);
  }, []);

  const submitAnswer = useCallback(async (answerIndex: number) => {
    if (!currentQuestion || (status !== 'playing' && status !== 'coaching') || isSubmitting) return;

    setIsSubmitting(true);
    setUserAnswerIndex(answerIndex);
    setTotalAttempts(prev => prev + 1);
    
    const selectedAnswer = currentQuestion.options[answerIndex];
    const isCorrectAnswer = answerIndex === currentQuestion.correctAnswerIndex;
    
    // Store first attempt for coaching flow
    if (attemptNumber === 1) {
      setFirstAttemptAnswer(answerIndex);
    }
    
    try {
      const response = await fetch('/api/drill/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedAnswer,
          timeSpent: 0, // TODO: Track actual time spent
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }
      
      const result = await response.json();
      setIsCorrect(result.isCorrect);
      
      // Coaching interception: First attempt and incorrect
      if (attemptNumber === 1 && !result.isCorrect) {
        setStreak(0);
        setStatus('coaching');
        setIsLoadingHint(true);
        
        // Generate Socratic hint
        const { getSocraticHint } = await import('@/services/CoachingService');
        const hint = await getSocraticHint(
          currentQuestion.question,
          currentQuestion.options[currentQuestion.correctAnswerIndex],
          selectedAnswer
        );
        setSocraticHint(hint);
        setIsLoadingHint(false);
      } else if (result.isCorrect) {
        // Correct answer: award full or partial points
        if (attemptNumber === 1) {
          setScore(prev => prev + 1); // Full point
        } else {
          setScore(prev => prev + 0.5); // 50% for assisted correct
        }
        setStreak(result.newStreak || 0);
        setStatus('feedback');
      } else {
        // Second attempt still wrong: show explanation
        setStreak(0);
        setStatus('feedback');
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      // Fallback to client-side grading if API fails
      setIsCorrect(isCorrectAnswer);
      
      if (attemptNumber === 1 && !isCorrectAnswer) {
        setStreak(0);
        setStatus('coaching');
        setIsLoadingHint(true);
        
        // Generate Socratic hint with fallback
        import('@/services/CoachingService').then(module => {
          module.getSocraticHint(
            currentQuestion.question,
            currentQuestion.options[currentQuestion.correctAnswerIndex],
            selectedAnswer
          ).then(hint => {
            setSocraticHint(hint);
            setIsLoadingHint(false);
          });
        });
      } else if (isCorrectAnswer) {
        if (attemptNumber === 1) {
          setScore(prev => prev + 1);
        } else {
          setScore(prev => prev + 0.5);
        }
        setStreak(prev => prev + 1);
        setStatus('feedback');
      } else {
        setStreak(0);
        setStatus('feedback');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, status, isSubmitting, attemptNumber]);

  const retryAfterHint = useCallback(() => {
    // Allow user to try again after seeing the hint
    setAttemptNumber(2);
    setUserAnswerIndex(null);
    setStatus('playing');
  }, []);

  const nextQuestion = useCallback(async () => {
    // Fetch next question from API
    const newQuestions = await fetchQuestionsFromAPI(1);
    
    if (newQuestions.length > 0) {
      setQueue(prev => [...prev, newQuestions[0]]);
    }
    
    setCurrentIndex(prev => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setSocraticHint(null);
    setAttemptNumber(1);
    setFirstAttemptAnswer(null);
    setStatus('playing');
  }, [fetchQuestionsFromAPI]);

  const reset = useCallback(async () => {
    recentConditionsRef.current.clear(); // Clear history on reset
    
    const newQuestions = await fetchQuestionsFromAPI(INITIAL_QUEUE_SIZE);
    
    if (newQuestions.length === 0) {
      setError('No questions available. Please try again.');
      return;
    }
    
    setQueue(newQuestions);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setTotalAttempts(0);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setSocraticHint(null);
    setAttemptNumber(1);
    setFirstAttemptAnswer(null);
    setStatus('playing');
  }, [fetchQuestionsFromAPI]);

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
    error,
    isSubmitting,
    socraticHint,
    isLoadingHint,
    attemptNumber,
    submitAnswer,
    retryAfterHint,
    nextQuestion,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
  };
}
