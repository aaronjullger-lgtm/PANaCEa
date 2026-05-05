// components/session/hooks/useQuizSubmit.ts
import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { calculateParTime } from '@/lib/utils/questionComplexity';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { syncManager } from '@/lib/services/sync/syncManager';
import { fetchPearlsClient } from '@/services/client/questionApi';
import {
  behavioralPayloadToTelemetryData,
  enrichTelemetryWithSessionPosition,
  type BehavioralPayload,
} from '@/components/quiz/Tracker';
import { getQuestionIdentity } from '@/lib/study/questionIdentity';
import type { Question } from '@/types';

const LOG_SCOPE = 'useQuizSubmit';
const quizSubmitLogger = logger.scope(LOG_SCOPE);
const STRIP_HTML_TAGS_REGEX = /<[^>]*>/g;
const WELLNESS_CHECK_QUESTION_THRESHOLD = 30;
const LATE_NIGHT_START_HOUR = 22;
const LATE_NIGHT_END_HOUR = 5;
const LATE_NIGHT_CHECK_INTERVAL = 15;

// ---------------------------------------------------------------------------
// Config — every external dependency the hook needs
// ---------------------------------------------------------------------------

export interface UseQuizSubmitConfig {
  // Answer state (owned by QuizView for recovery/rendering compatibility)
  selectedAnswerIndex: number | null;
  isAnswered: boolean;
  setSelectedAnswerIndex: (index: number | null) => void;
  setIsAnswered: (answered: boolean) => void;

  // Question context
  currentQuestion: Question | null;
  questionStartTime: number;
  questionNumber: number;
  eliminatedAnswers: Set<number>;
  sessionMode: string;
  sessionFocus: string;
  isExamSimulator: boolean;
  currentStreak: number;
  getToken: () => Promise<string | null>;
  userId: string | undefined;

  // Mutable refs
  answerChangeCountRef: React.RefObject<number>;
  firstSelectedAnswerRef: React.RefObject<number | null>;
  eliminationTimestampsRef: React.RefObject<number[]>;
  questionsAnsweredRef: React.RefObject<number>;

  // Behavioral tracker callbacks
  behavioralFinalize: () => BehavioralPayload | null;
  getMicroMetrics: () => {
    oscillations: number;
    vignetteRegressions: number;
    selectionDriftMs: number | null;
    tremorScore: number;
    cursorEntropy: number;
  };
  microKineticsInputMethod: 'mouse' | 'touch';
  onMicroKineticsRecordSelection: () => void;
  onAnswersRevealed: () => void;
  onRecordFirstInteraction: () => void;
  onRecordAnswerChange: () => void;
  onRecordImplicitAnswerSelection: (index: number) => void;
  getTimeToFirstClick: () => number | undefined;

  // Defensive analytics callbacks
  recordBehavioralConfidence: (signals: Record<string, unknown>, isCorrect: boolean) => void;
  recordMomentumResult: (isCorrect: boolean, timeToAnswer: number, parTime: number) => void;
  recordAnswerPattern: (data: Record<string, unknown>) => void;
  inferConfidence: (signals: Record<string, unknown>) => { score?: number } | number;
  updatePerformancePrediction: (data: Record<string, unknown>) => void;
  recordPauseResult: (data: Record<string, unknown>) => void;
  recordQuestionResult: (data: Record<string, unknown>) => void;

  // Wellness & domain callbacks
  recordWellnessAttempt: (isCorrect: boolean, timeToAnswer: number) => void;
  generateCausalChain: (data: Record<string, unknown>) => void;
  recordQuestionBySystem: (system: string) => void;

  // Haptics / feedback
  feedbackCorrect: () => void;
  feedbackIncorrect: () => void;
  feedbackStreak: (n: number) => void;
  hapticStreak: (n: number) => void;

  // Post-submit callbacks
  updateReviewQuestion: (q: Question, correct: boolean) => void;
  addMissedQuestion: (q: Question) => void;
  addPerformanceRecord: (record: Record<string, unknown>) => void;
  recordSessionAnswer: (id: string, correct: boolean, system: string, time: number) => void;
  recordCircadianPerformance: (data: { timestamp: number; isCorrect: boolean; topic?: string }) => void;
  removeDueConcept?: (id: string, type: string | null) => void;

  // Parent state setters
  setCurrentQuestion: React.Dispatch<React.SetStateAction<Question | null>>;
  setError: (error: string | null) => void;
  setCurrentStreak: React.Dispatch<React.SetStateAction<number>>;
  setBehavioralRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setShowWellnessModal: React.Dispatch<React.SetStateAction<boolean>>;
  setWellnessReason: React.Dispatch<React.SetStateAction<'rapid_questions' | 'late_night' | 'manual'>>;
}

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface UseQuizSubmitReturn {
  isSubmitting: boolean;
  submitError: string | null;
  lastImplicitConfidence: number | undefined;
  /** Select an answer option (includes behavioral tracking) */
  selectAnswer: (index: number) => void;
  /** Submit the currently selected answer */
  submitAnswer: () => Promise<void>;
  /** Retry after an error */
  retrySubmit: () => Promise<void>;
  /** Reset state for the next question */
  resetForNextQuestion: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuizSubmit(cfg: UseQuizSubmitConfig): UseQuizSubmitReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastImplicitConfidence, setLastImplicitConfidence] = useState<number | undefined>(undefined);
  const submittingRef = useRef(false);

  // ---- SELECT ANSWER ----
  const selectAnswer = useCallback(
    (index: number) => {
      if (cfg.isAnswered || !cfg.currentQuestion || cfg.eliminatedAnswers.has(index)) return;
      cfg.onMicroKineticsRecordSelection();
      if (cfg.firstSelectedAnswerRef.current === null) {
        cfg.firstSelectedAnswerRef.current = index;
        cfg.onRecordFirstInteraction();
      } else if (cfg.selectedAnswerIndex !== null && cfg.selectedAnswerIndex !== index) {
        cfg.answerChangeCountRef.current += 1;
        cfg.onRecordAnswerChange();
      }
      cfg.onRecordImplicitAnswerSelection(index);
      cfg.setSelectedAnswerIndex(index);
    },
    [cfg.isAnswered, cfg.currentQuestion, cfg.eliminatedAnswers, cfg.selectedAnswerIndex, cfg.onMicroKineticsRecordSelection, cfg.firstSelectedAnswerRef, cfg.onRecordFirstInteraction, cfg.answerChangeCountRef, cfg.onRecordAnswerChange, cfg.onRecordImplicitAnswerSelection, cfg.setSelectedAnswerIndex],
  );

  // ---- SUBMIT ANSWER ----
  const submitAnswer = useCallback(async () => {
    const { selectedAnswerIndex, currentQuestion, isAnswered } = cfg;
    if (selectedAnswerIndex === null || !currentQuestion || isAnswered || isSubmitting) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    // Function existence guard
    const functionChecks = {
      recordBehavioralConfidence: typeof cfg.recordBehavioralConfidence,
      recordMomentumResult: typeof cfg.recordMomentumResult,
      recordAnswerPattern: typeof cfg.recordAnswerPattern,
      updatePerformancePrediction: typeof cfg.updatePerformancePrediction,
      recordPauseResult: typeof cfg.recordPauseResult,
      recordQuestionResult: typeof cfg.recordQuestionResult,
    };
    const undefinedFns = Object.entries(functionChecks)
      .filter(([, t]) => t !== 'function')
      .map(([name, t]) => `${name}: ${t}`);
    if (undefinedFns.length > 0) {
      quizSubmitLogger.error('CRITICAL: Undefined functions in submitAnswer', { undefinedFns });
    }

    cfg.setIsAnswered(true);
    cfg.onAnswersRevealed();

    if (currentQuestion.correctAnswerIndex == null) {
      quizSubmitLogger.error('Question missing correctAnswerIndex', { id: currentQuestion.id });
      setIsSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
    const timeToAnswer = Date.now() - cfg.questionStartTime;
    const questionIdentity = getQuestionIdentity(currentQuestion);
    const questionId = questionIdentity.sourceQuestionId || currentQuestion.id || `temp-${cfg.questionNumber}`;

    cfg.recordWellnessAttempt(isCorrect, timeToAnswer);

    // Behavioral data
    const behavioralPayload = cfg.behavioralFinalize();
    const microMetrics = cfg.getMicroMetrics();
    const elimTimestamps = cfg.eliminationTimestampsRef.current;
    const eliminationVelocity =
      elimTimestamps.length >= 2
        ? elimTimestamps.length /
          ((elimTimestamps[elimTimestamps.length - 1]! - elimTimestamps[0]!) / 1000)
        : undefined;

    const telemetryForApi =
      behavioralPayload != null
        ? behavioralPayloadToTelemetryData(
            behavioralPayload,
            behavioralPayload.answer_change_count,
            false,
            {
              oscillations: microMetrics.oscillations,
              vignetteRegressions: microMetrics.vignetteRegressions,
              selectionDriftMs: microMetrics.selectionDriftMs,
              tremorScore: microMetrics.tremorScore,
              cursorEntropy: microMetrics.cursorEntropy,
              inputMethod: cfg.microKineticsInputMethod,
            },
            eliminationVelocity,
          )
        : undefined;
    const telemetryWithPosition = telemetryForApi
      ? enrichTelemetryWithSessionPosition(telemetryForApi, cfg.questionNumber)
      : undefined;

    // Derive FSRS rating from behavioral signals
    const parTimeForRating = calculateParTime(currentQuestion);
    const fsrsRating = behavioralPayload
      ? deriveFsrsRatingFromBehavior({
          isCorrect,
          timeToFirstClickMs: behavioralPayload.time_to_first_interaction_ms as number | null,
          totalDwellTimeMs: behavioralPayload.duration_ms as number,
          parTimeMs: parTimeForRating,
          answerSwitches: behavioralPayload.answer_change_count as number,
          cursorEntropy: microMetrics.cursorEntropy,
          hoverOscillations: microMetrics.oscillations,
          vignetteRegressions: microMetrics.vignetteRegressions,
          selectionDriftMs: microMetrics.selectionDriftMs,
          tremorScore: microMetrics.tremorScore,
        })
      : deriveFsrsRatingFromBehavior({
          isCorrect,
          timeToFirstClickMs: null,
          totalDwellTimeMs: timeToAnswer,
          parTimeMs: parTimeForRating,
          answerSwitches: 0,
        });

    // Persist for offline sync
    if (cfg.userId && currentQuestion.id) {
      try {
        syncManager.queueReview({
          questionId,
          canonicalQuestionId: questionIdentity.canonicalQuestionId,
          sourceQuestionId: questionIdentity.sourceQuestionId,
          questionSource: questionIdentity.questionSource,
          medicalContentId: currentQuestion.medicalContentId ?? null,
          selectedAnswer:
            (currentQuestion.options as string[])[selectedAnswerIndex] ??
            String(selectedAnswerIndex),
          timeSpentMs: timeToAnswer,
          timeToFirstClick: cfg.getTimeToFirstClick() ?? undefined,
          answerSwitches: cfg.answerChangeCountRef.current,
          totalDwellTime: timeToAnswer,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sessionType:
            cfg.sessionMode === 'rapid_recall'
              ? 'rapid_recall'
              : cfg.sessionMode === 'cram_mode' || cfg.sessionMode === 'cram'
                ? 'cram'
                : cfg.sessionMode === 'targeted'
                  ? 'targeted'
                  : 'main',
          telemetry: telemetryWithPosition,
        });
      } catch (err) {
        quizSubmitLogger.error('Failed to queue review for offline sync', { error: err });
      }
    }

    // Load pearls
    if (!currentQuestion.pearls && currentQuestion.conditionId) {
      try {
        const token = await cfg.getToken();
        const pearls = await fetchPearlsClient(currentQuestion.conditionId, token);
        if (pearls.length > 0)
          cfg.setCurrentQuestion((prev) => (prev ? { ...prev, pearls } : prev));
      } catch (error) {
        quizSubmitLogger.error('Failed to load clinical pearls', { error });
      }
    }

    // Behavior signals
    const parTime = calculateParTime(currentQuestion);
    const behaviorSignals = {
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
      answerChangeCount: cfg.answerChangeCountRef.current,
      eliminatedCount: cfg.eliminatedAnswers.size,
      quickInitialSelection:
        cfg.firstSelectedAnswerRef.current !== null &&
        Date.now() - cfg.questionStartTime < parTime * 0.5,
    };

    // Defensive analytics calls
    try {
      cfg.recordBehavioralConfidence(behaviorSignals, isCorrect);
    } catch (e) {
      quizSubmitLogger.warn('recordBehavioralConfidence failed', { error: e });
    }
    try {
      cfg.recordMomentumResult(isCorrect, timeToAnswer, parTime);
    } catch (e) {
      quizSubmitLogger.warn('recordMomentumResult failed', { error: e });
    }
    try {
      cfg.recordAnswerPattern({
        questionId,
        firstAnswer: cfg.firstSelectedAnswerRef.current ?? selectedAnswerIndex,
        finalAnswer: selectedAnswerIndex,
        correctAnswer: currentQuestion.correctAnswerIndex,
        timeSpentMs: timeToAnswer,
        parTimeMs: parTime,
        eliminatedCount: cfg.eliminatedAnswers.size,
        answerChangeCount: cfg.answerChangeCountRef.current,
        wasCorrect: isCorrect,
      });
    } catch (e) {
      quizSubmitLogger.warn('recordAnswerPattern failed', { error: e });
    }

    try {
      const confidenceResult = cfg.inferConfidence(behaviorSignals);
      const inferredConfidenceValue =
        typeof confidenceResult === 'number'
          ? confidenceResult
          : (confidenceResult?.score ?? 0.5);
      setLastImplicitConfidence(inferredConfidenceValue);

      if (!cfg.isExamSimulator && currentQuestion.condition) {
        cfg.generateCausalChain({
          questionId,
          questionText: currentQuestion.question || '',
          correctAnswer:
            currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '',
          condition: currentQuestion.condition,
          studentAnswer: !isCorrect
            ? currentQuestion.options[selectedAnswerIndex] ?? undefined
            : undefined,
          system: currentQuestion.system ?? undefined,
        });
      }

      cfg.updatePerformancePrediction({
        correct: isCorrect,
        timeSpentMs: timeToAnswer,
        parTimeMs: parTime,
        system: currentQuestion.system,
        questionNumber: cfg.questionNumber,
        inferredConfidence: inferredConfidenceValue,
      });
    } catch (e) {
      quizSubmitLogger.warn('confidence/prediction failed', { error: e });
    }

    try {
      cfg.recordPauseResult({ correct: isCorrect, timeSpentMs: timeToAnswer, parTimeMs: parTime });
    } catch (e) {
      quizSubmitLogger.warn('recordPauseResult failed', { error: e });
    }

    try {
      cfg.recordQuestionResult({
        questionId,
        responseTimeMs: timeToAnswer,
        wasCorrect: isCorrect,
        difficulty:
          (currentQuestion.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        answerChanges: behaviorSignals.answerChangeCount,
        eliminationsUsed: behaviorSignals.eliminatedCount,
        system: currentQuestion.system || 'Unknown',
      });
    } catch (e) {
      quizSubmitLogger.warn('recordQuestionResult failed', { error: e });
    }

    cfg.setBehavioralRefreshKey((k) => k + 1);

    // Haptic feedback + streak
    if (isCorrect) {
      const newStreak = cfg.currentStreak + 1;
      cfg.setCurrentStreak(newStreak);
      if (newStreak >= 10) cfg.hapticStreak(newStreak);
      else if (newStreak >= 5) cfg.hapticStreak(newStreak);
      else if (newStreak >= 3) cfg.feedbackStreak(newStreak);
      else cfg.feedbackCorrect();
    } else {
      cfg.feedbackIncorrect();
      cfg.setCurrentStreak(0);
    }

    // Domain recording
    if (currentQuestion.system) cfg.recordQuestionBySystem(currentQuestion.system);

    if (cfg.sessionFocus === 'review') {
      cfg.updateReviewQuestion(currentQuestion, isCorrect);
      if (
        isCorrect &&
        currentQuestion.dueConceptKey &&
        cfg.removeDueConcept
      ) {
        cfg.removeDueConcept(
          currentQuestion.dueConceptKey.conditionId,
          currentQuestion.dueConceptKey.taskType,
        );
      }
    } else {
      if (!isCorrect) cfg.addMissedQuestion(currentQuestion);
    }

    // Performance record
    const questionWordCount = currentQuestion.question
      .replace(STRIP_HTML_TAGS_REGEX, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 0).length;
    const timestamp = Date.now();

    cfg.addPerformanceRecord({
      timestamp,
      system: currentQuestion.system ?? null,
      subcategory: currentQuestion.subcategory ?? null,
      conditionId: currentQuestion.conditionId,
      condition: currentQuestion.condition,
      topic: currentQuestion.topic,
      isCorrect,
      focus: cfg.sessionFocus,
      questionWordCount,
      timeSpentMs: timeToAnswer,
    });

    cfg.recordSessionAnswer(
      questionId,
      isCorrect,
      currentQuestion.system || 'Unknown',
      timeToAnswer,
    );
    cfg.recordCircadianPerformance({
      timestamp,
      isCorrect,
      topic: currentQuestion.topic,
    });

    // Wellness triggers
    cfg.questionsAnsweredRef.current += 1;
    if (
      cfg.questionsAnsweredRef.current > 0 &&
      cfg.questionsAnsweredRef.current % WELLNESS_CHECK_QUESTION_THRESHOLD === 0
    ) {
      cfg.setWellnessReason('rapid_questions');
      cfg.setShowWellnessModal(true);
    }
    const currentHour = new Date().getHours();
    if (
      (currentHour >= LATE_NIGHT_START_HOUR || currentHour < LATE_NIGHT_END_HOUR) &&
      cfg.questionsAnsweredRef.current > 0 &&
      cfg.questionsAnsweredRef.current % LATE_NIGHT_CHECK_INTERVAL === 0
    ) {
      cfg.setWellnessReason('late_night');
      cfg.setShowWellnessModal(true);
    }

    submittingRef.current = false;
    setIsSubmitting(false);
  }, [
    cfg,
    isSubmitting,
  ]);

  // ---- RETRY ----
  const retrySubmit = useCallback(async () => {
    setSubmitError(null);
    await submitAnswer();
  }, [submitAnswer]);

  // ---- RESET FOR NEXT QUESTION ----
  const resetForNextQuestion = useCallback(() => {
    cfg.setIsAnswered(false);
    cfg.setSelectedAnswerIndex(null);
    setIsSubmitting(false);
    setSubmitError(null);
    submittingRef.current = false;
    setLastImplicitConfidence(undefined);
  }, [cfg.setIsAnswered, cfg.setSelectedAnswerIndex]);

  return {
    isSubmitting,
    submitError,
    lastImplicitConfidence,
    selectAnswer,
    submitAnswer,
    retrySubmit,
    resetForNextQuestion,
  };
}
