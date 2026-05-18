import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { type ConditionQuestionType } from '@/types/drill-modes';
import type { QuestionDTO } from '@/types/question-bank';
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
import { useDrillFSRS } from '@/hooks/useDrillFSRS';
import { resolveCorrectAnswerIndex } from '@/lib/answerLetterMap';
import { logger } from '@/lib/logger';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export type ConditionDrillStatus =
  | 'landing'
  | 'menu'
  | 'playing'
  | 'coaching'
  | 'feedback'
  | 'metacognition'
  | 'summary'
  | 'completed';

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

export interface UseConditionDrillOptions {
  initialSystem?: string;
  initialSubcategory?: string;
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
  // DEV-003 Item 5: Feedback data from API response
  isRapidGuess: boolean;
  nextReview: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  } | null;
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

function mapDtoToConditionQuestion(dto: QuestionDTO): ConditionQuestion | null {
  // Canonical resolver — handles letter ("A"–"E"), numeric, and full-text formats.
  // Returning null (vs. silently using index 0) prevents the UI from marking option
  // A as correct when the stored correctAnswer is malformed or unmatched.
  if (!Array.isArray(dto.options) || dto.options.length === 0) {
    logger.warn('[ConditionDrill] Skipping question with no options', { id: dto.id });
    return null;
  }
  if (typeof dto.correctAnswer !== 'string' || dto.correctAnswer.trim().length === 0) {
    logger.warn('[ConditionDrill] Skipping question with missing correctAnswer', { id: dto.id });
    return null;
  }
  const correctIndex = resolveCorrectAnswerIndex(dto.correctAnswer, dto.options);
  if (correctIndex === null) {
    logger.warn(
      '[ConditionDrill] Skipping question — correctAnswer does not resolve to any option',
      { id: dto.id, correctAnswer: dto.correctAnswer }
    );
    return null;
  }
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
    correctAnswerIndex: correctIndex,
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

export function useConditionDrill(options: UseConditionDrillOptions = {}): UseConditionDrillReturn {
  const { getToken, isSignedIn } = useAuth();
  const { initialSystem, initialSubcategory } = options;

  // Initialize unified FSRS submission hook
  const { startQuestion: startQuestionFSRS, recordAnswerChange, submitAnswer: submitAnswerFSRS } = useDrillFSRS({
    drillType: 'condition',
  });

  // Store current filter state
  const [currentFilters, setCurrentFilters] = useState<{
    system?: string;
    subcategory?: string;
  }>({
    system: initialSystem,
    subcategory: initialSubcategory,
  });

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

  // DEV-003 Item 5: Feedback data from API response
  const [isRapidGuess, setIsRapidGuess] = useState(false);
  const [nextReview, setNextReview] = useState<{
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  } | null>(null);

  // Implicit behavior metrics tracking
  const [currentImplicitMetrics, setCurrentImplicitMetrics] = useState<ImplicitMetrics>(
    createInitialImplicitMetrics
  );
  const questionStartTimeRef = useRef<number>(Date.now());
  const questionDisplayedAtRef = useRef<string>(new Date().toISOString());
  const previousSelectedAnswerRef = useRef<number | null>(null);

  // Track recently used conditions to avoid repetition
  const recentConditionsRef = useRef<Set<string>>(new Set());

  const currentQuestion = queue[currentIndex] ?? null;

  /**
   * Start tracking implicit metrics for current question
   */
  const startImplicitTracking = useCallback(() => {
    questionStartTimeRef.current = Date.now();
    questionDisplayedAtRef.current = new Date().toISOString();
    previousSelectedAnswerRef.current = null;
    setCurrentImplicitMetrics(createInitialImplicitMetrics());
    // Start FSRS telemetry tracking
    startQuestionFSRS();
  }, [startQuestionFSRS]);

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
    // Track answer change in FSRS hook
    recordAnswerChange(answerIndex);
  }, [recordAnswerChange]);

  const fetchQuestionsFromAPI = useCallback(
    async (
      count: number = INITIAL_QUEUE_SIZE,
      filters?: { system?: string; subcategory?: string }
    ): Promise<ConditionQuestion[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = isSignedIn ? await getToken() : null;

        // Use the new filtered endpoint
        const response = await fetch('/api/questions/condition-drill', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            count,
            system: filters?.system,
            subcategory: filters?.subcategory,
          }),
        });
        const responseJson = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(getApiEnvelopeError(responseJson, 'Failed to fetch questions'));
        }

        const data = unwrapApiEnvelope<{ success?: boolean; questions?: QuestionDTO[] }>(
          responseJson
        );

        if (!data.success || !data.questions) {
          throw new Error('Invalid response from server');
        }

        const mappedQuestions = data.questions
          .map((q: QuestionDTO) => mapDtoToConditionQuestion(q))
          .filter((q): q is ConditionQuestion => q !== null);
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
    [isSignedIn, getToken]
  );

  const startSession = useCallback(
    async (category: ConditionCategory) => {
      setSelectedCategory(category);
      recentConditionsRef.current.clear();
      metacognitionTrackerRef.current = initSessionTracker(); // Reset metacognition tracker

      const questions = await fetchQuestionsFromAPI(INITIAL_QUEUE_SIZE, currentFilters);

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
    [fetchQuestionsFromAPI, startImplicitTracking, currentFilters]
  );

  const showCategoryMenu = useCallback(() => {
    setStatus('menu');
  }, []);

  const exitToMenu = useCallback(() => {
    // Log session metacognition summary before exiting
    const summary = getSessionMetacognitionSummary(metacognitionTrackerRef.current);
    if (import.meta.env.DEV) console.debug('[Metacognition] Session Summary:', summary);

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

      // Option A: Coaching skew fix - post-hint attempt (attempt 2)
      // Grade locally only, skip API/FSRS to preserve data integrity
      if (attemptNumber === 2) {
        setIsCorrect(isCorrectAnswer);
        if (isCorrectAnswer) setScore((prev) => prev + 0.5);
        setStreak(isCorrectAnswer ? streak + 1 : 0);
        setStatus('feedback');
        setIsSubmitting(false);
        return;
      }

      try {
        // Build telemetry object with full client metrics
        const now = Date.now();
        const durationMs = finalMetrics.totalDwellTime;
        
        // Map ConditionQuestionType to API question_type enum
        const questionTypeMap: Record<string, 'vignette' | 'recall' | 'image' | 'rapid_recall' | 'unknown'> = {
          presentation: 'vignette',
          diagnosis: 'recall',
          treatment: 'recall',
          etiology: 'recall',
          complication: 'recall',
        };
        const questionType = questionTypeMap[currentQuestion.type] || 'recall';

        // Submit to FSRS pipeline via unified hook
        const result = await submitAnswerFSRS({
          questionId: currentQuestion.id,
          selectedAnswer,
          timeSpentMs: durationMs,
        });

        if (!result) {
          throw new Error('Failed to submit answer to FSRS pipeline');
        }

        setIsCorrect(result.isCorrect ?? null);
        
        // DEV-003 Item 5: Extract feedback data from API response
        setIsRapidGuess(result.isRapidGuess ?? false);
        setNextReview(result.nextReview ?? null);

        // Check metacognition trigger (only for incorrect answers on first attempt)
        const isCorrect = result.isCorrect === true;
        if (!isCorrect && attemptNumber === 1) {
          const metacogResult = shouldShowMetacognition({
            isCorrect,
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
            isCorrect,
            conditionId: currentQuestion.conditionId || currentQuestion.id,
            conditionName: currentQuestion.conditionName,
            subcategory: currentQuestion.subcategory || currentQuestion.system,
            system: currentQuestion.system,
            panaceYield: currentQuestion.panaceYield,
            tracker: metacognitionTrackerRef.current,
          });
        }

        // Coaching interception: First attempt and incorrect
        if (attemptNumber === 1 && !isCorrect) {
          setStreak(0);
          setStatus('coaching');
          setIsLoadingHint(true);

          // Generate Socratic hint
          const { getSocraticHint } = await import('@/services/core/CoachingService');
          const correctOption = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';
          const hint = await getSocraticHint(
            currentQuestion.question,
            correctOption,
            selectedAnswer ?? ''
          );
          setSocraticHint(hint);
          setIsLoadingHint(false);
        } else if (isCorrect) {
          // Correct answer: award full or partial points
          if (attemptNumber === 1) {
            setScore((prev) => prev + 1);
          } else {
            setScore((prev) => prev + 0.5);
          }
          const rating = result.implicitMetrics?.rating;
          setStreak(typeof rating === 'number' && rating >= 3 ? streak + 1 : 1);

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
        const im = result.implicitMetrics;
        if (im) {
          if (import.meta.env.DEV) console.debug('[FSRS] Implicit rating:', im.rating, 'confidence:', im.confidence);
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
            const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';
            const userAnswer = currentQuestion.options[answerIndex] ?? '';
            module
              .getSocraticHint(currentQuestion.question, correctAnswer, userAnswer)
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
      streak,
      metacognitionPrompt,
      submitAnswerFSRS,
    ]
  );

  const retryAfterHint = useCallback(() => {
    setAttemptNumber(2);
    setUserAnswerIndex(null);
    setStatus('playing');
    // Keep tracking time but reset first click for second attempt
    questionStartTimeRef.current = Date.now();
    setCurrentImplicitMetrics((prev) => ({
      ...prev,
      timeToFirstClick: null,
      answerSwitches: 0,
    }));
    previousSelectedAnswerRef.current = null;
  }, []);

  const nextQuestion = useCallback(async () => {
    const newQuestions = await fetchQuestionsFromAPI(1, currentFilters);

    if (newQuestions.length > 0 && newQuestions[0]) {
      const newQuestion = newQuestions[0];
      setQueue((prev) => [...prev, newQuestion]);
      setCurrentIndex((prev) => prev + 1);
      setUserAnswerIndex(null);
      setIsCorrect(null);
      setSocraticHint(null);
      setAttemptNumber(1);
      setFirstAttemptAnswer(null);
      setMetacognitionPrompt(null);
      setStatus('playing');
      startImplicitTracking();
    } else {
      // No more questions available - session is complete
      setStatus('completed');
    }
  }, [fetchQuestionsFromAPI, startImplicitTracking, currentFilters]);

  const reset = useCallback(async () => {
    recentConditionsRef.current.clear();
    metacognitionTrackerRef.current = initSessionTracker();

    const newQuestions = await fetchQuestionsFromAPI(INITIAL_QUEUE_SIZE, currentFilters);

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
  }, [fetchQuestionsFromAPI, startImplicitTracking, currentFilters]);

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
    isRapidGuess,
    nextReview,
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
