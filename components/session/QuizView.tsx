// components/session/QuizView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcut } from '@/contexts/ShortcutContext';
import { useUser } from '@clerk/clerk-react';
import { useCommuter } from '@/contexts/CommuterContext';
import { announceToScreenReader } from '@/lib/utils/accessibilityUtils';
import { enhancedHaptics } from '@/lib/enhancedHaptics';
import { useQuizSessionRecovery } from '@/hooks/useQuizSessionRecovery';
import { useQuizTimer } from './hooks/useQuizTimer';
import { debounce } from '@/lib/utils/debounce';
import { logger } from '@/src/lib/logger';

// Core services
import { getQuestionClient, fetchPearlsClient } from '@/services/client/questionApi';
import {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
} from '@/services/core';

// Session services
import {
  recordAnswerPattern,
  recordBehavioralConfidence,
  inferConfidence,
  type BehaviorSignals,
  recordMomentumResult,
  recordPauseResult,
  resetPauseTracking,
} from '@/services/session';

// Analytics services
import { recordCircadianPerformance, updatePerformancePrediction, resetPrediction } from '@/services/analytics';

// Domain services
import { recordQuestion, getSessionSummary, resetSessionDistribution } from '@/services/domain';

// Components
import { FlagQuestionModal } from '@/components/modals/FlagQuestionModal';
import AnswerChoice from '@/components/quiz/AnswerChoice';
import {
  useBehavioralTracker,
  OptionHoverTracker,
  behavioralPayloadToTelemetryData,
  enrichTelemetryWithSessionPosition,
} from '@/components/quiz/Tracker';
import { useUnifiedKinetics } from '@/hooks/useUnifiedKinetics';
import { useFatigueTracking } from '@/hooks/useFatigueTracking';
import { QuizLabCalcModal } from '@/components/quiz/QuizLabCalcModal';
import { DrillLoadingState } from '@/components/loading';
import WellnessCheckModal from '@/components/wellness/WellnessCheckModal';
import {
  SessionStatsOverlay,
  SessionEndSummary,
  SocraticTutorChat,
} from '@/components/quiz';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { SplitPaneDrillLayout } from '@/components/drill/SplitPaneDrillLayout';
import { NormalLabsPanel } from './NormalLabsPanel';

// Extracted sub-components and hooks
import QuestionDisplay from './QuestionDisplay';
import QuizToolbar from './QuizToolbar';
import AnswerFeedback from './AnswerFeedback';
import { SessionPacer } from './SessionPacer';
import { BreakTimer } from './BreakTimer';
import { FatigueBreakPrompt } from './FatigueBreakPrompt';
import { useSessionWellness } from '@/hooks/useSessionWellness';
import { useQuizSubmit } from './hooks/useQuizSubmit';

// Lib utils
import { calculateParTime } from '@/lib/utils/questionComplexity';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { syncManager } from '@/lib/services/sync/syncManager';
import { inferQuestionType } from '@/hooks/useTelemetryCollector';
import { useCausalChain, expertiseToDisplayLevel } from '@/hooks/useCausalChain';
import { useAuth } from '@/hooks/useAuth';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useImplicitMetrics } from '@/hooks/useImplicitMetrics';
import { feedback } from '@/services/core/feedbackService';

// Types
import type { Question, PerformanceRecord, SessionSettings, ErrorTag } from '@/types';
import type { SRSScheduleResult } from '@/lib/services/srsService';

/** Map Question to the shape inferQuestionType expects */
function questionToInferShape(q: Question): {
  type?: string;
  stem?: string;
  hasImage?: boolean;
  mediaAssets?: unknown[];
} {
  return {
    type: (q as { type?: string }).type,
    stem: q.question ?? (q as { vignette?: string }).vignette,
    hasImage: !!(q as { imageUrl?: string }).imageUrl,
    mediaAssets: (q as { mediaAssets?: unknown[] }).mediaAssets ?? [],
  };
}

/** Regex to strip HTML tags */
const STRIP_HTML_TAGS_REGEX = /<[^>]*>/g;

const LOG_SCOPE = 'QuizView';

export interface QuizViewProps {
  initialQueue: Question[];
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: Question) => void;
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
  removeDueConcept?: (conditionId: string, taskType: string | null) => void;
  updateLastPerformanceErrorTag: (tag: ErrorTag) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  sessionSettings: SessionSettings;
  growthAreas: string[];
  onEndSession: () => void;
  onShowMenu: () => void;
  performanceData: PerformanceRecord[];
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  flaggedQuestions: Question[];
  addFlaggedQuestion: (question: Question) => void;
  removeFlaggedQuestion: (question: Question) => void;
  updateQuestionNote: (question: Question, note: string) => void;
  useSplitPane?: boolean;
  onReviewMissed?: () => void;
  isExamSimulator?: boolean;
  isFullSitDownTest?: boolean;
  totalQuestions?: number;
  modeLabel?: string;
}

// ---- Wellness constants ----
const WELLNESS_CHECK_QUESTION_THRESHOLD = 30;
const LATE_NIGHT_START_HOUR = 22;
const LATE_NIGHT_END_HOUR = 5;
const LATE_NIGHT_CHECK_INTERVAL = 15;

const QuizView: React.FC<QuizViewProps> = ({
  initialQueue,
  setParentQueue,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
  removeDueConcept,
  updateLastPerformanceErrorTag,
  setIsLoading,
  setError,
  sessionSettings,
  growthAreas,
  onEndSession,
  onShowMenu,
  performanceData,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  flaggedQuestions,
  addFlaggedQuestion,
  removeFlaggedQuestion,
  updateQuestionNote,
  useSplitPane = false,
  onReviewMissed,
  isExamSimulator = false,
  isFullSitDownTest = false,
  totalQuestions,
  modeLabel,
}) => {
  // Validate required callback props at runtime
  useEffect(() => {
    const requiredCallbacks = {
      setParentQueue, addPerformanceRecord, addMissedQuestion, updateReviewQuestion,
      removeDueConcept, updateLastPerformanceErrorTag, setIsLoading, setError,
      onEndSession, onShowMenu, setFontSizeAdjustment,
      addFlaggedQuestion, removeFlaggedQuestion, updateQuestionNote,
    };
    for (const [name, callback] of Object.entries(requiredCallbacks)) {
      if (typeof callback !== 'function') {
        logger.error(LOG_SCOPE, `Required callback prop "${name}" is not a function`, typeof callback);
      }
    }
  }, []);

  // ---- AUTH & ANALYTICS HOOKS ----
  const { user } = useUser();
  const { getToken } = useAuth();
  const { recordQuestionResult, cognitiveState, recommendations } = useAdvancedAnalytics();

  // ---- BEHAVIORAL TRACKING HOOKS ----
  const implicitMetrics = useImplicitMetrics();
  const behavioralTracker = useBehavioralTracker();
  const microKinetics = useUnifiedKinetics();
  const fatigueTracking = useFatigueTracking(isExamSimulator);
  const sessionWellness = useSessionWellness();
  const causalChainHook = useCausalChain();

  // ---- ANSWER STATE ----
  const [srsResult, setSrsResult] = useState<SRSScheduleResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [showRationale, setShowRationale] = useState<boolean>(false);
  const [alternateRationale, setAlternateRationale] = useState<string | null>(null);
  const [isExplainerLoading, setIsExplainerLoading] = useState<boolean>(false);
  const [localNote, setLocalNote] = useState<string>('');
  const [showNotes, setShowNotes] = useState(false);
  const [showNormalLabsPanel, setShowNormalLabsPanel] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  const [showLabCalcModal, setShowLabCalcModal] = useState(false);
  const [showWellnessModal, setShowWellnessModal] = useState(false);
  const [wellnessReason, setWellnessReason] = useState<'rapid_questions' | 'late_night' | 'manual'>('rapid_questions');
  const [answerDistribution, setAnswerDistribution] = useState<
    { optionLetter: string; count: number; percent: number }[] | null
  >(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [behavioralRefreshKey, setBehavioralRefreshKey] = useState(0);
  const [replenishmentError, setReplenishmentError] = useState<string | null>(null);

  // ---- QUEUE STATE ----
  const [queue, setQueue] = useState<Question[]>(initialQueue);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQueue[0] || null);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [replenishAttempts, setReplenishAttempts] = useState(0);
  const MAX_REPLENISH_ATTEMPTS = 3;
  const BATCH_SIZE = 25;
  const LOW_QUEUE_THRESHOLD = 20;

  // Session overlay state
  const [showSessionEndSummary, setShowSessionEndSummary] = useState(false);
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);
  const commuter = useCommuter();

  // Refs
  const eliminatedAnswersRef = useRef<Set<number>>(new Set());
  const eliminationTimestampsRef = useRef<number[]>([]);
  const answerChangeCountRef = useRef<number>(0);
  const firstSelectedAnswerRef = useRef<number | null>(null);
  const recoveredSessionScoreRef = useRef<{ correct: number; total: number } | null>(null);
  const questionsAnsweredInSession = useRef(0);
  const noteUpdateTimeout = useRef<number | null>(null);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // For eliminatedAnswers state (triggers re-renders)
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<number>>(new Set());

  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

  // ---- SESSION RECOVERY ----
  const { saveState, clearSavedState } = useQuizSessionRecovery({
    userId: user?.id,
    sessionSettings,
    initialQueue,
    onRestore: (restored) => {
      if (restored.queue && restored.queue.length > 0) {
        setQueue(restored.queue);
        setParentQueue(restored.queue);
      }
      if (restored.currentQuestionIndex !== undefined && restored.queue) {
        const idx = restored.currentQuestionIndex;
        if (idx >= 0 && idx < restored.queue.length) {
          setCurrentQuestion(restored.queue[idx]);
        }
      }
      if (restored.selectedAnswerIndex !== undefined) setSelectedAnswerIndex(restored.selectedAnswerIndex);
      if (restored.isAnswered !== undefined) setIsAnswered(restored.isAnswered);
      if (restored.questionNumber !== undefined) setQuestionNumber(restored.questionNumber);
      if (restored.eliminatedAnswers) setEliminatedAnswers(new Set(restored.eliminatedAnswers));
      if (restored.localNote !== undefined) setLocalNote(restored.localNote);
      if (restored.answerChangeCount !== undefined) answerChangeCountRef.current = restored.answerChangeCount;
      if (restored.firstSelectedAnswer !== undefined) firstSelectedAnswerRef.current = restored.firstSelectedAnswer;
      if (restored.sessionScore) recoveredSessionScoreRef.current = restored.sessionScore;
    },
  });

  const debouncedSave = useRef(
    debounce((state: Parameters<typeof saveState>[0]) => saveState(state), 1000)
  ).current;

  // Save state whenever essential state changes
  useEffect(() => {
    if (!currentQuestion) return;
    const currentQuestionIndex = queue.findIndex(q => q.id === currentQuestion.id);
    debouncedSave({
      queue, currentQuestionIndex, selectedAnswerIndex, isAnswered, questionNumber,
      eliminatedAnswers: Array.from(eliminatedAnswers), localNote,
      answerChangeCount: answerChangeCountRef.current,
      firstSelectedAnswer: firstSelectedAnswerRef.current,
      sessionScore: {
        correct: performanceData.filter((p) => p.isCorrect).length,
        total: performanceData.length,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentQuestion, selectedAnswerIndex, isAnswered, questionNumber, eliminatedAnswers, localNote, debouncedSave]);

  // Clear saved state when session ends
  useEffect(() => {
    if (showSessionEndSummary) clearSavedState();
  }, [showSessionEndSummary, clearSavedState]);

  // Flush session state immediately on tab close
  const sessionStateRef = useRef({ currentQuestion, queue, selectedAnswerIndex, isAnswered, questionNumber, eliminatedAnswers, localNote });
  useEffect(() => {
    sessionStateRef.current = { currentQuestion, queue, selectedAnswerIndex, isAnswered, questionNumber, eliminatedAnswers, localNote };
  });
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = sessionStateRef.current;
      if (!s.currentQuestion) return;
      saveState({
        queue: s.queue,
        currentQuestionIndex: s.queue.findIndex(q => q.id === s.currentQuestion!.id),
        selectedAnswerIndex: s.selectedAnswerIndex, isAnswered: s.isAnswered,
        questionNumber: s.questionNumber,
        eliminatedAnswers: Array.from(s.eliminatedAnswers), localNote: s.localNote,
        answerChangeCount: answerChangeCountRef.current,
        firstSelectedAnswer: firstSelectedAnswerRef.current,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (noteUpdateTimeout.current) {
        clearTimeout(noteUpdateTimeout.current);
        noteUpdateTimeout.current = null;
      }
    };
  }, []);

  // Keep CSS variable in sync with fontSizeAdjustment
  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-adj', `${fontSizeAdjustment * 0.1}rem`);
  }, [fontSizeAdjustment]);

  // Reset collapsible states when question changes
  useEffect(() => { setShowNotes(false); }, [currentQuestion?.id]);

  const isFlagged = useMemo(() => {
    if (!currentQuestion) return false;
    return flaggedQuestions.some((q) => q.question === currentQuestion.question);
  }, [currentQuestion, flaggedQuestions]);

  // Fetch peer selection stats when feedback is shown
  useEffect(() => {
    if (!isAnswered || !currentQuestion?.id || selectedAnswerIndex === null) {
      setAnswerDistribution(null);
      return;
    }
    let cancelled = false;
    const fetchDistribution = async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/analytics/peer-stats?questionId=${encodeURIComponent(currentQuestion?.id ?? '')}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          data?: { distribution?: { optionLetter: string; count: number; percent: number }[] };
        };
        const dist = json?.data?.distribution;
        if (!cancelled && Array.isArray(dist)) setAnswerDistribution(dist);
      } catch {
        if (!cancelled) setAnswerDistribution(null);
      }
    };
    const timeoutId = setTimeout(fetchDistribution, 500);
    return () => { cancelled = true; if (timeoutId) clearTimeout(timeoutId); };
  }, [isAnswered, currentQuestion?.id, selectedAnswerIndex, getToken]);

  // Keep current question synced with queue[0]
  useEffect(() => { setCurrentQuestion(queue[0] || null); }, [queue]);

  // Auto-read question aloud when commuter mode is active
  useEffect(() => {
    if (!commuter?.isCommuterMode || !commuter.settings.autoReadQuestions || !currentQuestion) return;
    const vignette = currentQuestion.vignette ? currentQuestion.vignette + ' ' : '';
    const stem = currentQuestion.stem || '';
    const text = vignette + stem;
    if (text.trim()) {
      commuter.speak(text);
      const timer = setTimeout(() => {
        if (commuter.settings.voiceEnabled) commuter.startListening();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [commuter, currentQuestion]);

  // ---- QUIZ SUBMIT HOOK ----
  const quizSubmit = useQuizSubmit({
    currentQuestion,
    questionStartTime,
    questionNumber,
    eliminatedAnswers,
    sessionMode: sessionSettings.mode,
    sessionFocus: sessionSettings.focus,
    isExamSimulator,
    currentStreak,
    getToken,
    userId: user?.id,
    answerChangeCountRef,
    firstSelectedAnswerRef,
    eliminationTimestampsRef,
    questionsAnsweredRef,
    behavioralFinalize: () => behavioralTracker.finalize(),
    getMicroMetrics: () => microKinetics.getMetrics(),
    microKineticsInputMethod: microKinetics.inputMethod,
    onMicroKineticsRecordSelection: () => microKinetics.recordSelection(),
    onAnswersRevealed: () => microKinetics.onAnswersRevealed(),
    onRecordFirstInteraction: () => behavioralTracker.recordFirstInteraction(),
    onRecordAnswerChange: () => behavioralTracker.recordAnswerChange(),
    onRecordImplicitAnswerSelection: (i) => implicitMetrics.recordAnswerSelection(i),
    getTimeToFirstClick: () => implicitMetrics.metrics.timeToFirstClick,
    recordBehavioralConfidence,
    recordMomentumResult,
    recordAnswerPattern,
    inferConfidence,
    updatePerformancePrediction,
    recordPauseResult,
    recordQuestionResult,
    recordWellnessAttempt: (correct, time) => sessionWellness.recordAttempt(correct, time),
    generateCausalChain: (data) => causalChainHook.generate(data as Parameters<typeof causalChainHook.generate>[0]),
    recordQuestionBySystem: (system) => recordQuestion(system, undefined),
    feedbackCorrect: () => feedback.correct(),
    feedbackIncorrect: () => feedback.incorrect(),
    feedbackStreak: (n) => feedback.streak(),
    hapticStreak: (n) => enhancedHaptics.streak(n),
    updateReviewQuestion,
    addMissedQuestion,
    addPerformanceRecord,
    recordSessionAnswer,
    recordCircadianPerformance,
    removeDueConcept,
    setCurrentQuestion,
    setError,
    setCurrentStreak,
    setBehavioralRefreshKey,
    setShowWellnessModal,
    setWellnessReason,
  });

  // ---- HANDLE END SESSION ----
  const handleEndSession = useCallback(() => {
    const correctCount = performanceData.filter((p) => p.isCorrect).length;
    const totalCount = performanceData.length;
    const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    announceToScreenReader(
      `Session ended. Score: ${scorePercent} percent. ${correctCount} correct out of ${totalCount}.`,
      'assertive'
    );
    if (!shouldEndlesslyReplenish || performanceData.length >= 5) {
      setShowSessionEndSummary(true);
    } else {
      onEndSession();
    }
  }, [onEndSession, shouldEndlesslyReplenish, performanceData]);

  // ---- TIMER (hook) ----
  const timer = useQuizTimer({
    timeLimit: sessionSettings.timeLimit,
    isCommuterMode: !!commuter?.isCommuterMode,
    onTimeUp: handleEndSession,
  });

  // Stats overlay toggle shortcut
  useShortcut('TOGGLE_STATS', () => setShowStatsOverlay((prev) => !prev), { enabled: true });

  // ---- REPLENISH QUEUE ----
  const replenishQueue = useCallback(async () => {
    if (!shouldEndlesslyReplenish || isGeneratingQuestion) return;
    setIsGeneratingQuestion(true);
    setReplenishmentError(null);
    if (replenishAttempts >= MAX_REPLENISH_ATTEMPTS) {
      setReplenishmentError('Unable to load questions after several attempts. Please try again later.');
      setIsGeneratingQuestion(false);
      return;
    }
    setReplenishAttempts(prev => prev + 1);
    try {
      let newQuestions: Question[] = [];
      const token = await getToken();
      try {
        if (token) {
          const result = await fetchSessionQuestions(sessionSettings, token, BATCH_SIZE);
          newQuestions = result.questions ?? [];
        }
      } catch (apiErr) {
        logger.warn(LOG_SCOPE, 'Session API replenish failed, using fallback', apiErr);
      }
      if (newQuestions.length === 0) {
        const fetchPromises = Array.from({ length: BATCH_SIZE }, () =>
          getQuestionClient(sessionSettings, growthAreas, getToken).catch((err) => {
            logger.warn(LOG_SCOPE, 'Single question fetch failed', err);
            return null;
          })
        );
        const results = await Promise.all(fetchPromises);
        newQuestions = results.filter((q): q is Question => q !== null);
      }
      if (newQuestions.length > 0) {
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        setReplenishAttempts(0);
      } else {
        logger.warn(LOG_SCOPE, 'No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      logger.error(LOG_SCOPE, 'Failed to replenish queue', err);
      setError('Unable to load more questions right now. You can continue with your current questions.');
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [shouldEndlesslyReplenish, sessionSettings, growthAreas, setParentQueue, setError, getToken, isGeneratingQuestion, replenishAttempts]);

  // Proactive replenishment
  useEffect(() => {
    if (shouldEndlesslyReplenish && queue.length < LOW_QUEUE_THRESHOLD && !isGeneratingQuestion) {
      void replenishQueue();
    }
  }, [queue.length, shouldEndlesslyReplenish, isGeneratingQuestion, replenishQueue]);

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    try {
      quizSubmit.resetForNextQuestion();
      setShowRationale(false);
      setAlternateRationale(null);
      setShowSocraticTutor(false);
      setAnswerDistribution(null);
      setIsExplainerLoading(false);
      setQuestionNumber((prev) => prev + 1);
      setEliminatedAnswers(new Set());
      eliminationTimestampsRef.current = [];
      setSrsResult(null);
      setQuestionStartTime(Date.now());
      answerChangeCountRef.current = 0;
      firstSelectedAnswerRef.current = null;
      causalChainHook.reset();
      implicitMetrics.reset();
      implicitMetrics.startQuestion();
      microKinetics.reset();
      const nextQ = queue.length > 1 ? queue[1] : undefined;
      const qType = nextQ ? inferQuestionType(questionToInferShape(nextQ)) : 'unknown';
      behavioralTracker.start(qType);
      setQueue((prev) => {
        if (prev.length === 0) return prev;
        const [, ...rest] = prev;
        const newQueue = rest;
        setParentQueue(newQueue);
        if (!shouldEndlesslyReplenish && newQueue.length === 0) handleEndSession();
        return newQueue;
      });
      const totalQ = queue.length + performanceData.length;
      const currentNum = questionNumber + 1;
      announceToScreenReader(`Question ${currentNum} of ${totalQ}`, 'polite');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById('question-container');
          if (el && typeof (el as HTMLElement).focus === 'function') (el as HTMLElement).focus();
        });
      });
    } catch (error) {
      logger.error(LOG_SCOPE, 'Error advancing to next question', error);
      setError('Failed to load next question. Please try again.');
    }
  }, [queue, setParentQueue, shouldEndlesslyReplenish, handleEndSession, setError, implicitMetrics, behavioralTracker, microKinetics, quizSubmit]);

  // Initialize from incoming queue once
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) setCurrentQuestion(initialQueue[0] ?? null);
    setLocalNote(initialQueue[0]?.userNote || '');
    setEliminatedAnswers(new Set());
    eliminationTimestampsRef.current = [];
    if (initialQueue.length > 0) {
      implicitMetrics.startQuestion();
      microKinetics.reset();
      const q = initialQueue[0];
      behavioralTracker.start(q ? inferQuestionType(questionToInferShape(q)) : 'unknown');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueue, currentQuestion]);

  // ---- ELIMINATION ----
  const handleToggleEliminate = useCallback(
    (index: number) => {
      if (isAnswered) return;
      setEliminatedAnswers((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else { next.add(index); eliminationTimestampsRef.current.push(Date.now()); }
        return next;
      });
    },
    [isAnswered]
  );

  // ---- KEYBOARD SHORTCUTS ----
  useShortcut('FLIP_CARD', () => { if (isAnswered) setShowRationale((prev) => !prev); }, { enabled: isAnswered });
  useShortcut('NEXT_QUESTION', () => { if (isAnswered) nextButtonRef.current?.click(); }, { enabled: isAnswered });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'textarea') return;
      if (event.key === 'Escape') { event.preventDefault(); onShowMenu(); return; }
      const letterToIndex: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
      if (!isAnswered && event.shiftKey) {
        const eliminateIndex = letterToIndex[event.key.toLowerCase()];
        if (eliminateIndex !== undefined && currentQuestion?.options[eliminateIndex]) {
          event.preventDefault(); handleToggleEliminate(eliminateIndex); return;
        }
      }
      if (!isAnswered && !event.shiftKey) {
        const index = letterToIndex[event.key.toLowerCase()];
        if (index !== undefined && !eliminatedAnswers.has(index)) {
          event.preventDefault(); optionButtonsRef.current[index]?.click();
        }
      }
      if (!isAnswered && selectedAnswerIndex !== null && event.key === 'Enter') {
        event.preventDefault(); handleSubmitAnswer(); return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, selectedAnswerIndex, handleToggleEliminate, eliminatedAnswers, currentQuestion, onShowMenu, handleSubmitAnswer]);

  // ---- EXPLAIN DIFFERENTLY ----
  const handleExplainDifferently = useCallback(async () => {
    if (!currentQuestion || selectedAnswerIndex === null) return;
    setIsExplainerLoading(true);
    setAlternateRationale('');
    try {
      const userAnswer = currentQuestion.options[selectedAnswerIndex] ?? '';
      const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';
      const prompt = `You are a clinical educator helping a PA student understand why they got a question wrong.\n\nQuestion: ${currentQuestion.question}\n\nTheir Answer: ${userAnswer}\nCorrect Answer: ${correctAnswer}\n\nOriginal Explanation: ${currentQuestion.rationale}\n\nProvide an ALTERNATE explanation that approaches this from a different angle. Use:\n- Different clinical reasoning pathway\n- Different mnemonic or memory aid\n- Different real-world clinical scenario\n- Simpler language if the original was technical\n\nKeep it concise (3-4 sentences max) and focus on helping them understand WHY they made this mistake.`;
      const { callGeminiTextStreaming } = await import('@/services/ai/geminiService');
      try {
        await callGeminiTextStreaming('gemini-2.5-flash', prompt, 0.7, {
          getToken,
          systemInstruction: 'You are a clinical educator for PA students. Be concise (3-4 sentences), use a different angle than the original explanation, and focus on why the mistake was made.',
          onChunk: (chunk) => setAlternateRationale((prev) => prev + chunk),
          onComplete: () => setIsExplainerLoading(false),
          onError: () => setIsExplainerLoading(false),
        });
        setIsExplainerLoading(false);
      } catch (err) {
        logger.error(LOG_SCOPE, 'Error generating alternate rationale', err);
        setAlternateRationale("Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment.");
        setIsExplainerLoading(false);
      }
    } catch (err) {
      logger.error(LOG_SCOPE, 'Error generating alternate rationale', err);
      setAlternateRationale("Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment.");
      setIsExplainerLoading(false);
    }
  }, [currentQuestion, selectedAnswerIndex, getToken]);

  // ---- NOTE CHANGE ----
  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNote = e.target.value;
    setLocalNote(newNote);
    if (noteUpdateTimeout.current) clearTimeout(noteUpdateTimeout.current);
    noteUpdateTimeout.current = window.setTimeout(() => {
      if (currentQuestion) updateQuestionNote(currentQuestion, newNote);
    }, 750);
  }, [currentQuestion, updateQuestionNote]);

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    if (isFlagged) removeFlaggedQuestion(currentQuestion);
    else addFlaggedQuestion(currentQuestion);
  }, [currentQuestion, isFlagged, removeFlaggedQuestion, addFlaggedQuestion]);

  const topicStats = useMemo(() => {
    if (!isAnswered || !currentQuestion) return null;
    const topicQuestions = performanceData.filter((p) => p.topic === currentQuestion.topic).slice(-100);
    const correct = topicQuestions.filter((p) => p.isCorrect).length;
    const total = topicQuestions.length;
    return { score: total > 0 ? (correct / total) * 100 : 0, correct, total };
  }, [isAnswered, currentQuestion, performanceData]);

  const parTimeMs = useMemo(() => currentQuestion ? calculateParTime(currentQuestion) : null, [currentQuestion]);

  // ---- NO CURRENT QUESTION ----
  if (!currentQuestion) {
    if (shouldEndlesslyReplenish) {
      if (replenishAttempts >= MAX_REPLENISH_ATTEMPTS) {
        const isDueMode = sessionSettings.mode === 'due';
        const isVariantMode = sessionSettings.mode === 'variant';
        let errorTitle = 'Unable to Load Questions';
        let errorMessage = replenishmentError || 'The question service is currently unavailable. Please try again later.';
        let secondaryActionLabel = 'Retry';
        if (isDueMode) {
          errorTitle = 'No Questions Due';
          errorMessage = 'Great job! You\'ve completed all your due questions. Come back when more questions are ready for review, or explore other study modes to continue learning.';
          secondaryActionLabel = 'Explore Other Modes';
        } else if (isVariantMode) {
          errorTitle = 'No Variant Questions Available';
          errorMessage = 'You\'ve completed all available variants for this topic. Try another topic or mode to continue your practice session.';
          secondaryActionLabel = 'Try Another Mode';
        }
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4">
            <h2 className="text-2xl font-semibold mb-2">{errorTitle}</h2>
            <p className="text-[var(--color-text-secondary)] max-w-md">{errorMessage}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
              <GhostButton type="button" onClick={onShowMenu}>
                {isDueMode || isVariantMode ? 'Back to Practice' : 'Back to Dashboard'}
              </GhostButton>
              <SecondaryButton type="button" onClick={() => { if (isDueMode || isVariantMode) onShowMenu(); else setReplenishAttempts(0); }}>
                {secondaryActionLabel}
              </SecondaryButton>
            </div>
          </div>
        );
      }
      if (!isGeneratingQuestion) void replenishQueue();
      return <DrillLoadingState message="Preparing your question..." variant="question" showTimer={false} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4">
        <h2 className="text-2xl font-semibold mb-2">Session Complete</h2>
        <p className="text-[var(--color-text-secondary)]">You've reached the end of this set of questions.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
          <GhostButton type="button" onClick={onShowMenu}>Back to Dashboard</GhostButton>
          <SecondaryButton type="button" onClick={handleEndSession}>View Summary</SecondaryButton>
        </div>
      </div>
    );
  }

  // Focus question container when question changes
  useEffect(() => {
    if (currentQuestion) {
      const timer = setTimeout(() => {
        const questionEl = document.getElementById('question-container');
        questionEl?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion?.id, questionNumber]);

  // Announce correctness to screen readers
  useEffect(() => {
    if (isAnswered && selectedAnswerIndex !== null) {
      const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
      const correctOption = ['A', 'B', 'C', 'D', 'E'][currentQuestion.correctAnswerIndex] ?? '';
      const message = isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${correctOption}: ${currentQuestion.options[currentQuestion.correctAnswerIndex]}.`;
      announceToScreenReader(message, 'assertive');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnswered]);

  // ---- MAIN RENDER ----
  return (
    <div className={`flex flex-col ${isExamSimulator ? 'exam-simulator-high-contrast' : ''}`}>
      <a href="#question-container" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-accent)] focus:rounded-md">Skip to question</a>

      <header role="banner" aria-label="Quiz session toolbar">
        <QuizToolbar
          questionNumber={questionNumber} isFullSitDownTest={isFullSitDownTest} totalQuestions={totalQuestions}
          modeLabel={modeLabel} behavioralRefreshKey={behavioralRefreshKey} currentStreak={currentStreak}
          questionStartTime={questionStartTime} parTimeMs={parTimeMs} isAnswered={isAnswered}
          showTimerVisible={timer.showTimerVisible} isCommuterMode={!!commuter?.isCommuterMode}
          timeRemainingMs={timer.timeRemaining} showStatsOverlay={showStatsOverlay}
          onToggleStatsOverlay={() => setShowStatsOverlay((prev) => !prev)} isFlagged={isFlagged}
          onToggleFlag={toggleFlag} showNormalLabsPanel={showNormalLabsPanel}
          onToggleNormalLabs={() => setShowNormalLabsPanel((prev) => !prev)}
          onShowReportModal={() => setShowReportModal(true)}
          onShowLabCalcModal={() => setShowLabCalcModal(true)}
          fontSizeAdjustment={fontSizeAdjustment} setFontSizeAdjustment={setFontSizeAdjustment}
          onEndSession={handleEndSession} replenishmentError={replenishmentError}
          onRetryReplenish={() => { setReplenishmentError(null); setError(null); void replenishQueue(); }}
          currentQuestion={currentQuestion}
        />
      </header>

      <main id="main-content" role="main" aria-label="Quiz question and answers">
        <SplitPaneDrillLayout vignette={useSplitPane ? currentQuestion.vignette : null} className="mb-6">
          <div ref={microKinetics.registerMouseTrackingContainer}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id ?? `${currentQuestion.question}-${questionNumber}`}
                initial={{ y: 10, opacity: 0 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrustBadge source={currentQuestion.source} fromStaging={currentQuestion.fromStaging} size="sm" />
                </div>
                {currentQuestion.contentSource === 'openstax' && (
                  <OpenStaxAttributionFooter title={currentQuestion.contentSourceTitle || 'Textbook'} sourceUrl="https://openstax.org" />
                )}
                {currentQuestion.imageUrl && (
                  <div className="mb-5 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]" style={{ boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.06), 0 4px 16px -4px rgba(0, 0, 0, 0.08)' }}>
                    <img src={currentQuestion.imageUrl} alt="Clinical image for question" className="w-full max-h-[320px] object-contain" />
                  </div>
                )}
                <QuestionDisplay
                  text={
                    useSplitPane && currentQuestion.vignette
                      ? currentQuestion.question.replace((currentQuestion.vignette || '') + '\n\n', '')
                      : currentQuestion.question
                  }
                />
              </motion.div>
            </AnimatePresence>

            {/* ANSWER OPTIONS */}
            <div className="space-y-3 mt-6" role="radiogroup" aria-label={`Answer options for question ${questionNumber}`}>
              {(currentQuestion.options || []).map((option, index) => {
                const isCorrect = index === currentQuestion.correctAnswerIndex;
                const isSelected = index === selectedAnswerIndex;
                const optionLabel = ['A', 'B', 'C', 'D', 'E'][index] ?? 'A';
                return (
                  <OptionHoverTracker key={`${currentQuestion.id}-${index}`} optionIndex={index} optionLabel={optionLabel} className="block" onHoverEnter={microKinetics.recordOptionInteraction}>
                    <AnswerChoice
                      ref={(el) => { optionButtonsRef.current[index] = el; }}
                      text={option} index={index} isSelected={isSelected} isCorrect={isCorrect}
                      isAnswered={isAnswered} isEliminated={eliminatedAnswers.has(index)}
                      onSelect={handleOptionClick} onToggleEliminate={handleToggleEliminate}
                      fontSizeAdjustment={fontSizeAdjustment}
                    />
                  </OptionHoverTracker>
                );
              })}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          {!isAnswered && selectedAnswerIndex !== null && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="sticky bottom-0 z-10 mt-6 -mx-4 px-4 py-4 text-center space-y-2 md:static md:bg-transparent md:backdrop-blur-0 md:mx-0 md:px-0 md:py-0 md:mt-6 md:space-y-4"
              style={{ background: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)', backdropFilter: 'blur(12px) saturate(1.2)', WebkitBackdropFilter: 'blur(12px) saturate(1.2)' }}>
              <Button type="button" onClick={handleSubmitAnswer} loading={isSubmitting}
                className="btn-cinematic px-10 py-3.5 mx-auto min-h-[48px] text-body font-semibold">
                Submit Answer
              </Button>
              <p className="mt-2 text-caption text-[var(--color-text-muted)] hidden md:block">
                Press <kbd className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded-lg text-caption font-mono" style={{ boxShadow: '0 0 0 1px var(--color-border), 0 1px 2px rgba(0,0,0,0.04)' }}>Enter</kbd> to submit
              </p>
            </motion.div>
          )}

          {/* FEEDBACK / RATIONALE */}
          {isAnswered && selectedAnswerIndex !== null && (
            <AnswerFeedback
              currentQuestion={currentQuestion} selectedAnswerIndex={selectedAnswerIndex}
              isExamSimulator={isExamSimulator} fontSizeAdjustment={fontSizeAdjustment}
              topicStats={topicStats} answerDistribution={answerDistribution}
              updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
              onExplainDifferently={handleExplainDifferently} isExplainerLoading={isExplainerLoading}
              alternateRationale={alternateRationale} onShowSocraticTutor={() => setShowSocraticTutor(true)}
              localNote={localNote} showNotes={showNotes} setShowNotes={setShowNotes}
              onNoteChange={handleNoteChange} implicitConfidence={lastImplicitConfidence}
              causalChain={causalChainHook.chain}
              causalChainDisplayLevel={lastImplicitConfidence !== undefined ? expertiseToDisplayLevel(lastImplicitConfidence) : 'collapsed'}
            />
          )}

          {/* Fatigue break prompt */}
          {isAnswered && (
            <FatigueBreakPrompt
              fatigue={sessionWellness.fatigue} dismissed={sessionWellness.breakDismissed}
              onTakeBreak={(minutes) => sessionWellness.startBreak(minutes)}
              onDismiss={sessionWellness.dismissBreak}
              hardStopVisible={sessionWellness.check.shouldStop && !sessionWellness.dismissed}
            />
          )}

          {/* NEXT QUESTION BUTTON */}
          {isAnswered && !sessionWellness.onBreak && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="sticky bottom-0 z-10 mt-4 -mx-4 px-4 py-4 text-center md:static md:bg-transparent md:backdrop-blur-0 md:mx-0 md:px-0 md:py-0 md:mt-5"
              style={{ background: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)', backdropFilter: 'blur(12px) saturate(1.2)', WebkitBackdropFilter: 'blur(12px) saturate(1.2)' }}>
              <Button ref={nextButtonRef} onClick={() => { try { showNextQuestion(); } catch (error) { logger.error(LOG_SCOPE, 'Error in Next Question button click', error); setError('Failed to proceed to next question. Please refresh the page.'); } }}
                className="btn-cinematic px-10 py-3.5 font-semibold min-h-[48px] text-body">
                Next Question
              </Button>
            </motion.div>
          )}
        </SplitPaneDrillLayout>
      </main>

      {/* Modals and overlays */}
      <WellnessCheckModal isOpen={showWellnessModal} onClose={() => setShowWellnessModal(false)} reason={wellnessReason} />
      <SessionPacer check={sessionWellness.check} dismissed={sessionWellness.dismissed} onDismiss={sessionWellness.dismiss} onEndSession={() => setShowSessionEndSummary(true)} />
      <BreakTimer isActive={sessionWellness.onBreak} secondsLeft={sessionWellness.breakSecondsLeft} totalSeconds={sessionWellness.fatigue.suggestedBreakMinutes * 60 || 300} onReturn={sessionWellness.endBreak} questionsAnswered={sessionWellness.check.stats.questionsAnswered} accuracy={sessionWellness.check.stats.accuracy} />
      {showLabCalcModal && <QuizLabCalcModal onClose={() => setShowLabCalcModal(false)} />}
      <NormalLabsPanel isOpen={showNormalLabsPanel} onClose={() => setShowNormalLabsPanel(false)} />
      {currentQuestion && (
        <FlagQuestionModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} questionId={currentQuestion.id || `temp-${Date.now()}`} questionText={currentQuestion.question} correctAnswer={typeof currentQuestion.correctIndex === 'number' ? currentQuestion.answers?.[currentQuestion.correctIndex] : undefined} topic={currentQuestion.topic} system={currentQuestion.system || undefined} userId={user?.id || 'anonymous'} userEmail={user?.primaryEmailAddress?.emailAddress} userFirstName={user?.firstName || undefined} />
      )}
      <SessionStatsOverlay isVisible={showStatsOverlay} onToggle={() => setShowStatsOverlay((prev) => !prev)} performanceData={performanceData.map((p) => ({ topic: p.topic, correct: p.isCorrect }))} currentQuestionNumber={questionNumber} />
      <SessionEndSummary
        isOpen={showSessionEndSummary} celebrateStreak={performanceData.length >= 10}
        onClose={() => { setShowSessionEndSummary(false); resetSessionDistribution(); resetPrediction(); resetPauseTracking(); onEndSession(); }}
        performanceData={performanceData} sessionSummary={getSessionSummary()}
        sessionDurationMs={timer.elapsed} sessionStartTime={timer.sessionStartTime}
        sessionSettings={{ mode: sessionSettings.mode, focus: sessionSettings.focus }}
        onContinueStudying={() => setShowSessionEndSummary(false)}
        onViewAnalytics={() => { setShowSessionEndSummary(false); resetSessionDistribution(); resetPrediction(); resetPauseTracking(); onEndSession(); }}
        onReviewMissed={onReviewMissed ? () => { setShowSessionEndSummary(false); onReviewMissed(); } : undefined}
      />
      <AnimatePresence>
        {showSocraticTutor && currentQuestion && selectedAnswerIndex !== null && selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
          <SocraticTutorChat
            vignette={currentQuestion.vignette || ''} question={currentQuestion.question}
            correctAnswer={(currentQuestion.options as string[])?.[currentQuestion.correctAnswerIndex] ?? ''}
            userWrongAnswer={(currentQuestion.options as string[])?.[selectedAnswerIndex] ?? ''}
            options={currentQuestion.options as string[]}
            fullExplanation={(() => {
              const stripHtml = (s: string) => s.replace(STRIP_HTML_TAGS_REGEX, ' ').replace(/\s+/g, ' ').trim();
              const r = currentQuestion.rationale;
              if (typeof r === 'object' && r !== null && 'bottomLine' in r) {
                const s = r as { bottomLine?: string; whyCorrect?: string };
                return [s.bottomLine, s.whyCorrect].filter((x): x is string => typeof x === 'string').map(stripHtml).join(' ') || 'See rationale above.';
              }
              return stripHtml(typeof r === 'string' ? r : '') || 'See rationale above.';
            })()}
            onClose={() => setShowSocraticTutor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export { QuizView };
export default QuizView;
