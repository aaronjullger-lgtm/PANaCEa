import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { type ConditionQuestionType } from '@/types/drill-modes';
import type { QuestionDTO } from '@/lib/services/questionBankService';
import {
  initSessionTracker,
  shouldShowMetacognition,
  getSessionMetacognitionSummary,
  type SessionMissTracker,
  type MetacognitionPrompt,
} from '@/lib/metacognition';
import { getBrowserTimezone } from '@/lib/circadian';
import { useSession } from '@/contexts/SessionContext';
import type { SubmitReviewResponse } from '@/services/analytics';

export type ConditionDrillStatus =
  | 'landing'
  | 'menu'
  | 'playing'
  | 'coaching'
  | 'feedback'
  | 'metacognition'
  | 'summary';

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
  conditionId?: string;
  subcategory?: string;
  system: string;
  difficulty: 'easy' | 'medium' | 'hard';
  panaceYield?: number;
}

/**
 * Implicit behavior metrics tracked during question answering
 */
export interface ImplicitMetrics {
  timeToFirstClick: number | null;
  answerSwitches: number;
  totalDwellTime: number;
  timezone: string;
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
  // Metacognition
  metacognitionPrompt: MetacognitionPrompt | null;
  // Implicit metrics for debugging/display
  currentImplicitMetrics: ImplicitMetrics;
  // Actions
  submitAnswer: (answerIndex: number) => void;
  recordAnswerSelection: (answerIndex: number) => void;
  retryAfterHint: () => void;
  nextQuestion: () => void;
  dismissMetacognition: () => void;
  reset: () => void;
  startSession: (category: ConditionCategory) => void;
  exitToMenu: () => void;
  showCategoryMenu: () => void;
}

const INITIAL_QUEUE_SIZE = 3;
const MAX_RECENT_CONDITIONS = 20;

function mapDtoToConditionQuestion(dto: QuestionDTO): ConditionQuestion {
  const correctIndex = dto.options.indexOf(dto.correctAnswer);
  // Cast to any to access optional extended properties from API
  const extendedDto = dto as QuestionDTO & {
    condition?: string;
    conditionId?: string;
    subcategory?: string;
    panaceYield?: number;
  };
  return {
    id: dto.id,
    type: 'diagnosis',
    question: dto.vignette || dto.question,
    options: dto.options,
    correctAnswerIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: dto.explanation,
    conditionName: extendedDto.condition || dto.system,
    conditionId: extendedDto.conditionId,
    subcategory: extendedDto.subcategory,
    system: dto.system,
    difficulty: (dto.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
    panaceYield: extendedDto.panaceYield,
  };
}

function createInitialImplicitMetrics(): ImplicitMetrics {
  return {
    timeToFirstClick: null,
    answerSwitches: 0,
    totalDwellTime: 0,
    timezone: getBrowserTimezone(),
  };
}

export function useConditionDrill(): UseConditionDrillReturn {
  const { getToken, isSignedIn } = useAuth();

  // Get calibration tracking from session context
  // Safe to call even if SessionProvider is not present (will throw if used)
  let recordCalibrationObservation:
    | ((questionId: string, response: SubmitReviewResponse, organSystem?: string) => void)
    | null = null;
  try {
    const session = useSession();
    recordCalibrationObservation = session.recordCalibrationObservation;
  } catch {
    // SessionProvider not available - calibration tracking disabled
    // This is fine for standalone drill usage
  }

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

  // Metacognition state
  const [metacognitionPrompt, setMetacognitionPrompt] = useState<MetacognitionPrompt | null>(null);
  const metacognitionTrackerRef = useRef<SessionMissTracker>(initSessionTracker());

  // Implicit behavior metrics tracking
  const [currentImplicitMetrics, setCurrentImplicitMetrics] = useState<ImplicitMetrics>(
    createInitialImplicitMetrics
  );
  const questionStartTimeRef = useRef<number>(Date.now());
  const previousSelectedAnswerRef = useRef<number | null>(null);

  // Track recently used conditions to avoid repetition
  const recentConditionsRef = useRef<Set<string>>(new Set());

  const currentQuestion = queue[currentIndex] ?? null;

  /**
   * Start tracking implicit metrics for current question
   */
  const startImplicitTracking = useCallback(() => {
    questionStartTimeRef.current = Date.now();
    previousSelectedAnswerRef.current = null;
    setCurrentImplicitMetrics(createInitialImplicitMetrics());
  }, []);

  /**
   * Record when user selects/changes answer (for implicit metrics)
   */
  const recordAnswerSelection = useCallback((answerIndex: number) => {
    setCurrentImplicitMetrics((prev) => {
      const now = Date.now();
      const isFirstSelection = prev.timeToFirstClick === null;
      const isSwitch =
        previousSelectedAnswerRef.current !== null &&
        previousSelectedAnswerRef.current !== answerIndex;

      previousSelectedAnswerRef.current = answerIndex;

      return {
        ...prev,
        timeToFirstClick: isFirstSelection
          ? now - questionStartTimeRef.current
          : prev.timeToFirstClick,
        answerSwitches: isSwitch ? prev.answerSwitches + 1 : prev.answerSwitches,
        totalDwellTime: now - questionStartTimeRef.current,
      };
    });
  }, []);

  const fetchQuestionsFromAPI = useCallback(
    async (count: number = INITIAL_QUEUE_SIZE): Promise<ConditionQuestion[]> => {
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

        const mappedQuestions = data.questions.map((q: QuestionDTO) =>
          mapDtoToConditionQuestion(q)
        );
        return mappedQuestions;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load questions';
        setError(errorMsg);
        console.error('Error fetching questions:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const startSession = useCallback(
    async (category: ConditionCategory) => {
      setSelectedCategory(category);
      recentConditionsRef.current.clear();
      metacognitionTrackerRef.current = initSessionTracker(); // Reset metacognition tracker

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
      setMetacognitionPrompt(null);
      setStatus('playing');
      startImplicitTracking();
    },
    [fetchQuestionsFromAPI, startImplicitTracking]
  );

  const showCategoryMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  const exitToMenu = useCallback(() => {
    // Log session metacognition summary before exiting
    const summary = getSessionMetacognitionSummary(metacognitionTrackerRef.current);
    console.log('[Metacognition] Session Summary:', summary);

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
    setMetacognitionPrompt(null);
  }, []);

  const dismissMetacognition = useCallback(() => {
    setMetacognitionPrompt(null);
    setStatus('feedback');
  }, []);

  const submitAnswer = useCallback(
    async (answerIndex: number) => {
      if (!currentQuestion || (status !== 'playing' && status !== 'coaching') || isSubmitting)
        return;

      setIsSubmitting(true);
      setUserAnswerIndex(answerIndex);
      setTotalAttempts((prev) => prev + 1);

      const selectedAnswer = currentQuestion.options[answerIndex];
      const isCorrectAnswer = answerIndex === currentQuestion.correctAnswerIndex;

      // Finalize implicit metrics
      const finalDwellTime = Date.now() - questionStartTimeRef.current;
      const finalMetrics: ImplicitMetrics = {
        ...currentImplicitMetrics,
        totalDwellTime: finalDwellTime,
      };
      setCurrentImplicitMetrics(finalMetrics);

      // Store first attempt for coaching flow
      if (attemptNumber === 1) {
        setFirstAttemptAnswer(answerIndex);
      }

      try {
        // Get auth token for authenticated request
        const token = isSignedIn ? await getToken() : null;

        // Submit to correct FSRS endpoint with implicit metrics
        const response = await fetch('/api/drills/submit-review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            selectedAnswer,
            timeSpentMs: finalMetrics.totalDwellTime,
            // Implicit behavior metrics for FSRS rating derivation
            timeToFirstClick: finalMetrics.timeToFirstClick,
            answerSwitches: finalMetrics.answerSwitches,
            totalDwellTime: finalMetrics.totalDwellTime,
            timezone: finalMetrics.timezone,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to submit answer');
        }

        const result = await response.json();
        setIsCorrect(result.isCorrect);

        // Check metacognition trigger (only for incorrect answers on first attempt)
        if (!result.isCorrect && attemptNumber === 1) {
          const metacogResult = shouldShowMetacognition({
            isCorrect: result.isCorrect,
            conditionId: currentQuestion.conditionId || currentQuestion.id,
            conditionName: currentQuestion.conditionName,
            subcategory: currentQuestion.subcategory || currentQuestion.system,
            system: currentQuestion.system,
            panaceYield: currentQuestion.panaceYield,
            tracker: metacognitionTrackerRef.current,
          });

          if (metacogResult.shouldShow) {
            setMetacognitionPrompt(metacogResult);
          }
        } else {
          // Track correct answer in metacognition tracker
          shouldShowMetacognition({
            isCorrect: result.isCorrect,
            conditionId: currentQuestion.conditionId || currentQuestion.id,
            conditionName: currentQuestion.conditionName,
            subcategory: currentQuestion.subcategory || currentQuestion.system,
            system: currentQuestion.system,
            panaceYield: currentQuestion.panaceYield,
            tracker: metacognitionTrackerRef.current,
          });
        }

        // Coaching interception: First attempt and incorrect
        if (attemptNumber === 1 && !result.isCorrect) {
          setStreak(0);
          setStatus('coaching');
          setIsLoadingHint(true);

          // Generate Socratic hint
          const { getSocraticHint } = await import('@/services/core/CoachingService');
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
            setScore((prev) => prev + 1);
          } else {
            setScore((prev) => prev + 0.5);
          }
          setStreak(result.implicitMetrics?.rating >= 3 ? streak + 1 : 1);

          // Show metacognition modal if triggered, otherwise go to feedback
          if (metacognitionPrompt?.shouldShow) {
            setStatus('metacognition');
          } else {
            setStatus('feedback');
          }
        } else {
          // Second attempt still wrong: show explanation
          setStreak(0);

          // Show metacognition modal if triggered, otherwise go to feedback
          if (metacognitionPrompt?.shouldShow) {
            setStatus('metacognition');
          } else {
            setStatus('feedback');
          }
        }

        // Log implicit metrics result for debugging
        if (result.implicitMetrics) {
          console.log(
            '[FSRS] Implicit rating:',
            result.implicitMetrics.rating,
            'confidence:',
            result.implicitMetrics.confidence
          );
        }

        // Record JOL calibration observation for metacognitive tracking
        if (recordCalibrationObservation && result.implicitMetrics) {
          recordCalibrationObservation(
            currentQuestion.id,
            result as SubmitReviewResponse,
            currentQuestion.system
          );
        }
      } catch (err) {
        console.error('Error submitting answer:', err);
        // Fallback to client-side grading if API fails
        setIsCorrect(isCorrectAnswer);

        // Still track in metacognition even if API fails
        shouldShowMetacognition({
          isCorrect: isCorrectAnswer,
          conditionId: currentQuestion.conditionId || currentQuestion.id,
          conditionName: currentQuestion.conditionName,
          subcategory: currentQuestion.subcategory || currentQuestion.system,
          system: currentQuestion.system,
          panaceYield: currentQuestion.panaceYield,
          tracker: metacognitionTrackerRef.current,
        });

        if (attemptNumber === 1 && !isCorrectAnswer) {
          setStreak(0);
          setStatus('coaching');
          setIsLoadingHint(true);

          import('@/services/core/CoachingService').then((module) => {
            module
              .getSocraticHint(
                currentQuestion.question,
                currentQuestion.options[currentQuestion.correctAnswerIndex],
                selectedAnswer
              )
              .then((hint) => {
                setSocraticHint(hint);
                setIsLoadingHint(false);
              });
          });
        } else if (isCorrectAnswer) {
          if (attemptNumber === 1) {
            setScore((prev) => prev + 1);
          } else {
            setScore((prev) => prev + 0.5);
          }
          setStreak((prev) => prev + 1);
          setStatus('feedback');
        } else {
          setStreak(0);
          setStatus('feedback');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentQuestion,
      status,
      isSubmitting,
      attemptNumber,
      currentImplicitMetrics,
      isSignedIn,
      getToken,
      streak,
      metacognitionPrompt,
    ]
  );

  const retryAfterHint = useCallback(() => {
    setAttemptNumber(2);
    setUserAnswerIndex(null);
    setStatus('playing');
    // Keep tracking time but reset first click for second attempt
    setCurrentImplicitMetrics((prev) => ({
      ...prev,
      timeToFirstClick: null,
      answerSwitches: 0,
    }));
    previousSelectedAnswerRef.current = null;
  }, []);

  const nextQuestion = useCallback(async () => {
    const newQuestions = await fetchQuestionsFromAPI(1);

    if (newQuestions.length > 0) {
      setQueue((prev) => [...prev, newQuestions[0]]);
    }

    setCurrentIndex((prev) => prev + 1);
    setUserAnswerIndex(null);
    setIsCorrect(null);
    setSocraticHint(null);
    setAttemptNumber(1);
    setFirstAttemptAnswer(null);
    setMetacognitionPrompt(null);
    setStatus('playing');
    startImplicitTracking();
  }, [fetchQuestionsFromAPI, startImplicitTracking]);

  const reset = useCallback(async () => {
    recentConditionsRef.current.clear();
    metacognitionTrackerRef.current = initSessionTracker();

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
    setMetacognitionPrompt(null);
    setStatus('playing');
    startImplicitTracking();
  }, [fetchQuestionsFromAPI, startImplicitTracking]);

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
    metacognitionPrompt,
    currentImplicitMetrics,
    submitAnswer,
    recordAnswerSelection,
    retryAfterHint,
    nextQuestion,
    dismissMetacognition,
    reset,
    startSession,
    exitToMenu,
    showCategoryMenu,
  };
}
