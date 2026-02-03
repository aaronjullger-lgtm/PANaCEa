// components/QuizView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcut } from '@/src/context/ShortcutContext';
import { useUser } from '@clerk/clerk-react';
import { useCommuter } from '@/contexts/CommuterContext';

// Core services - using client-safe API wrappers
import { getQuestionClient, fetchPearlsClient } from '@/services/client/questionApi';
import {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
  getSessionSummary as getMainSessionSummary,
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
import { recordCircadianPerformance } from '@/services/analytics';
import { updatePerformancePrediction, resetPrediction } from '@/services/analytics';

// Domain services
import { recordQuestion, getSessionSummary, resetSessionDistribution } from '@/services/domain';

// AI services
import { generateAlternateRationale } from '@/services/ai';

// Components
import { FlagQuestionModal } from '@/components/modals/FlagQuestionModal';
import AnswerChoice from '@/components/quiz/AnswerChoice';
import { QuizLabCalcModal } from '@/components/quiz/QuizLabCalcModal';
import ErrorTagger from '@/components/quiz/ErrorTagger';
import Loader from '@/components/loading/Loader';
import WellnessCheckModal from '@/components/wellness/WellnessCheckModal';

// Sprint 4: Enhanced session components (streamlined - removed janky popups)
import {
  SessionStatsOverlay,
  SessionEndSummary,
  QuestionTimer,
  MomentumBadge,
  StreakBadge,
} from '@/components/quiz';
import { ClinicalSkeleton } from '@/components/ui/ClinicalSkeleton';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';
import { getAccuracyBarClass } from '@/lib/accuracyColorUtils';

// Sprint 10: Trust badges for question source indication
import { TrustBadge } from '@/components/ui/TrustBadge';
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { SplitPaneDrillLayout } from '@/components/drill/SplitPaneDrillLayout';
import { DrillLoadingState } from '@/components/drill/DrillLoadingState';

// Icons
import { CloseIcon } from '@/components/icons/CloseIcon';
import { FlagIcon } from '@/components/icons/FlagIcon';
import { AlertTriangle, BarChart3, Calculator } from 'lucide-react';
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon';
import { ClearHighlightIcon } from '@/components/icons/ClearHighlightIcon';

// Types
import type { Question, PerformanceRecord, SessionSettings, ErrorTag } from '@/types';
import type { SRSScheduleResult } from '@/lib/services/srsService';
import type { StructuredRationale } from '@/components/questions/ExplanationPanel';

// Lib utils
import { calculateParTime } from '@/lib/utils/questionComplexity';
import {
  optimisticUpdateStats,
  optimisticUpdateSystemStats,
  createOptimisticPerformanceRecord,
} from '@/lib/utils/optimisticUI';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useImplicitMetrics } from '@/hooks/useImplicitMetrics';

// Other services (non-barrel)
import { feedback } from '@/services/core/feedbackService';
import { syncManager } from '@/lib/services/sync/syncManager';

interface QuizViewProps {
  initialQueue: Question[];
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: Question) => void;
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
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
  /** When true and question has vignette, use split-pane layout (vignette left, content right) */
  useSplitPane?: boolean;
}

const QuestionDisplay: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Text highlighting logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      try {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          return;
        }

        const span = document.createElement('span');
        span.className = 'user-highlight';
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch (e) {
        console.error('Highlighting failed.', e);
        window.getSelection()?.removeAllRanges();
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [text]);

  const hasTable = text.includes('<table');

  // ---------- TABLE BRANCH ----------
  if (hasTable) {
    // 1) Extract table HTML
    const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
    const tableHTML = tableMatch ? tableMatch[0] : '';

    // 2) Replace table with a sentinel
    const beforeAfter = text.replace(tableHTML, '|||TABLE|||');

    // 3) Normalize line breaks
    const normalized = beforeAfter
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const [beforeTable = '', afterTableRaw = ''] = normalized.split('|||TABLE|||');

    // 4) Pull out the last sentence (the actual question) after the table
    const lastSentenceMatch = afterTableRaw.match(/[^.!?]+[.!?]+\s*$/);
    const lastSentence = lastSentenceMatch ? lastSentenceMatch[0].trim() : '';

    const vignetteAfterTable = lastSentence
      ? afterTableRaw.replace(lastSentenceMatch![0], '').trim()
      : afterTableRaw.trim();

    return (
      <div
        ref={containerRef}
        id="question-container"
        className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm space-y-4"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
      >
        {/* Text before the table */}
        {beforeTable && <p className="whitespace-pre-wrap">{beforeTable}</p>}

        {/* Table */}
        <div className="my-2" dangerouslySetInnerHTML={{ __html: sanitizeForRationale(tableHTML) }} />

        {/* Any non-final text after the table */}
        {vignetteAfterTable && <p className="whitespace-pre-wrap">{vignetteAfterTable}</p>}

        {/* Final bolded question line */}
        {lastSentence && <p className="font-semibold whitespace-pre-wrap">{lastSentence}</p>}
      </div>
    );
  }

  // ---------- NON-TABLE BRANCH ----------
  const normalizedText = text.replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(/<br\s*\/?>/gi, '\n');

  const lastSentenceMatch = normalizedText.match(/[^.!?]+[.!?]+\s*$/);

  if (!lastSentenceMatch) {
    return (
      <div
        ref={containerRef}
        id="question-container"
        className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
      >
        {normalizedText}
      </div>
    );
  }

  const lastSentence = lastSentenceMatch[0].trim();
  const vignette = normalizedText.replace(lastSentenceMatch[0], '').trim();

  // Add visual enhancement (shadowed block/border) around question text for better focus
  return (
    <div
      ref={containerRef}
      id="question-container"
      className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
      style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
    >
      <p className="whitespace-pre-wrap">{vignette}</p>
      <p className="font-semibold mt-4 whitespace-pre-wrap">{lastSentence}</p>
    </div>
  );
};

const QuizView: React.FC<QuizViewProps> = ({
  initialQueue,
  setParentQueue,
  addPerformanceRecord,
  addMissedQuestion,
  updateReviewQuestion,
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
}) => {
  // Validate required callback props at runtime
  useEffect(() => {
    const requiredCallbacks = {
      setParentQueue,
      addPerformanceRecord,
      addMissedQuestion,
      updateReviewQuestion,
      updateLastPerformanceErrorTag,
      setIsLoading,
      setError,
      onEndSession,
      onShowMenu,
      setFontSizeAdjustment,
      addFlaggedQuestion,
      removeFlaggedQuestion,
      updateQuestionNote,
    };

    for (const [name, callback] of Object.entries(requiredCallbacks)) {
      if (typeof callback !== 'function') {
        console.error(
          `QuizView: Required callback prop "${name}" is not a function:`,
          typeof callback
        );
      }
    }
  }, []);

  // ---- CLERK USER & AUTH ----
  const { user } = useUser();
  const { getToken } = useAuth();

  // ---- ADVANCED ANALYTICS ----
  const { recordQuestionResult, cognitiveState, recommendations } = useAdvancedAnalytics();

  // ---- IMPLICIT METRICS TRACKING ----
  const implicitMetrics = useImplicitMetrics();

  // ---- QUEUE HANDLING ----
  const [queue, setQueue] = useState<Question[]>(initialQueue);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQueue[0] || null);

  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [questionNumber, setQuestionNumber] = useState<number>(1);

  // ---- SRS RESULT STATE ----
  const [srsResult, setSrsResult] = useState<SRSScheduleResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const [showRationale, setShowRationale] = useState<boolean>(false);
  const [alternateRationale, setAlternateRationale] = useState<string | null>(null);
  const [isExplainerLoading, setIsExplainerLoading] = useState<boolean>(false);

  const [localNote, setLocalNote] = useState<string>('');

  // Track eliminated answers (by index) for the current question
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<number>>(new Set());

  // Track answer changes for analytics
  const [answerChangeCount, setAnswerChangeCount] = useState<number>(0);
  const [firstSelectedAnswer, setFirstSelectedAnswer] = useState<number | null>(null);

  // Track if we're actively generating a question in the background
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);

  // Report issue modal state
  const [showReportModal, setShowReportModal] = useState(false);
  // Lab calculator modal (Anion Gap, Osmolar Gap, Parkland) – encourages active calculation
  const [showLabCalcModal, setShowLabCalcModal] = useState(false);

  // Peer selection stats ("42% of students also chose B") – Wisdom of the Crowds
  const [answerDistribution, setAnswerDistribution] = useState<
    { optionLetter: string; count: number; percent: number }[] | null
  >(null);

  // Wellness check state and constants
  const WELLNESS_CHECK_QUESTION_THRESHOLD = 30;
  const LATE_NIGHT_START_HOUR = 22;
  const LATE_NIGHT_END_HOUR = 5;
  const LATE_NIGHT_CHECK_INTERVAL = 15;

  const [showWellnessModal, setShowWellnessModal] = useState(false);
  const [wellnessReason, setWellnessReason] = useState<'rapid_questions' | 'late_night' | 'manual'>(
    'rapid_questions'
  );
  const questionsAnsweredInSession = useRef(0);
  const sessionStartTime = useRef(Date.now());

  // Sprint 4: Enhanced session state
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);
  const [showSessionEndSummary, setShowSessionEndSummary] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const commuter = useCommuter();
  const showTimerVisible = showTimer && !commuter?.isCommuterMode;
  const [behavioralRefreshKey, setBehavioralRefreshKey] = useState(0);

  const noteUpdateTimeout = useRef<number | null>(null);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Keep CSS variable in sync with fontSizeAdjustment
  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-adj', `${fontSizeAdjustment * 0.1}rem`);
  }, [fontSizeAdjustment]);

  const isFlagged = useMemo(() => {
    if (!currentQuestion) return false;
    return flaggedQuestions.some((q) => q.question === currentQuestion.question);
  }, [currentQuestion, flaggedQuestions]);

  // Fetch peer selection stats when feedback is shown (for "X% of students also chose B")
  useEffect(() => {
    if (!isAnswered || !currentQuestion?.id || selectedAnswerIndex === null) {
      setAnswerDistribution(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${getApiEndpoint(API_ENDPOINTS.QUESTIONS_ANSWER_DISTRIBUTION)}?questionId=${encodeURIComponent(currentQuestion?.id ?? '')}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data?: { distribution?: { optionLetter: string; count: number; percent: number }[] } };
        const dist = json?.data?.distribution;
        if (!cancelled && Array.isArray(dist)) setAnswerDistribution(dist);
      } catch {
        if (!cancelled) setAnswerDistribution(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAnswered, currentQuestion?.id, selectedAnswerIndex, getToken]);

  // Keep current question synced with queue[0]
  useEffect(() => {
    setCurrentQuestion(queue[0] || null);
  }, [queue]);

  // ---- SHOULD WE REPLENISH ENDLESSLY? ----
  // 'review' and 'reviewFlagged' are finite (show specific questions)
  // 'due' is continuous - generates variant questions for concepts needing SRS review
  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

  // Sprint 4: Handler to show session end summary before ending
  const handleEndSession = useCallback(() => {
    // For finite sessions (review mode), show the session end summary
    if (!shouldEndlesslyReplenish || performanceData.length >= 5) {
      setShowSessionEndSummary(true);
    } else {
      // For continuous sessions with few questions, just end directly
      onEndSession();
    }
  }, [onEndSession, shouldEndlesslyReplenish, performanceData.length]);

  // Sprint 4: Handler for stats overlay toggle with keyboard shortcut
  useShortcut('TOGGLE_STATS', () => setShowStatsOverlay((prev) => !prev), { enabled: true });

  // ---- REPLENISH QUEUE (Commuter Mode: keep buffer so tunnel/bad WiFi doesn't run out) ----
  const BATCH_SIZE = 25;
  const LOW_QUEUE_THRESHOLD = 20; // Refill when 20 left so we keep a buffer

  const replenishQueue = useCallback(async () => {
    // Do NOT show the global loader here – this is background work
    if (!shouldEndlesslyReplenish) return;
    if (isGeneratingQuestion) return; // Prevent concurrent fetches

    setIsGeneratingQuestion(true);
    try {
      // Fetch multiple questions in parallel for better throughput
      const fetchPromises = Array.from({ length: BATCH_SIZE }, () =>
        getQuestionClient(sessionSettings, growthAreas, getToken).catch((err) => {
          console.warn('Single question fetch failed:', err);
          return null;
        })
      );

      const results = await Promise.all(fetchPromises);
      const newQuestions = results.filter((q): q is Question => q !== null);

      if (newQuestions.length > 0) {
        // Keep both queues in sync with batch update
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        console.log(`[QuizView] Replenished ${newQuestions.length} questions`);
      } else {
        console.warn('[QuizView] No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      console.error('Failed to replenish queue:', err);
      // soft-fail: show a user-friendly error but don't kill the session
      setError(
        'Unable to load more questions right now. You can continue with your current questions.'
      );
    } finally {
      setIsGeneratingQuestion(false);
    }
  }, [
    shouldEndlesslyReplenish,
    sessionSettings,
    growthAreas,
    setParentQueue,
    setError,
    getToken,
    isGeneratingQuestion,
  ]);

  // Proactive replenishment - trigger when queue drops below threshold
  useEffect(() => {
    if (shouldEndlesslyReplenish && queue.length < LOW_QUEUE_THRESHOLD && !isGeneratingQuestion) {
      console.log(`[QuizView] Queue low (${queue.length}), triggering replenishment`);
      void replenishQueue();
    }
  }, [queue.length, shouldEndlesslyReplenish, isGeneratingQuestion, replenishQueue]);

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    try {
      setIsAnswered(false);
      setSelectedAnswerIndex(null);
      setShowRationale(false);
      setAlternateRationale(null);
      setAnswerDistribution(null); // Reset peer selection stats for next question
      setIsExplainerLoading(false);
      setQuestionNumber((prev) => prev + 1);
      setEliminatedAnswers(new Set()); // Reset eliminated answers for new question
      setSrsResult(null); // Reset SRS result for new question
      setQuestionStartTime(Date.now()); // Track time for new question
      setAnswerChangeCount(0); // Reset answer change tracking
      setFirstSelectedAnswer(null); // Reset first selected answer

      // Reset implicit metrics for new question
      implicitMetrics.reset();
      implicitMetrics.startQuestion();

      setQueue((prev) => {
        if (prev.length === 0) return prev;

        const [, ...rest] = prev;
        const newQueue = rest;

        setParentQueue(newQueue);

        // Finite sessions ONLY: REVIEW / REVIEW FLAGGED - show summary when done
        // For continuous sessions, NEVER auto-end - the proactive replenishment effect handles it
        if (!shouldEndlesslyReplenish && newQueue.length === 0) {
          handleEndSession();
        }

        return newQueue;
      });

      // Note: Replenishment is handled by the proactive effect when queue < LOW_QUEUE_THRESHOLD
    } catch (error) {
      console.error('Error advancing to next question:', error);
      setError('Failed to load next question. Please try again.');
    }
  }, [
    setParentQueue,
    shouldEndlesslyReplenish,
    replenishQueue,
    handleEndSession,
    setError,
    implicitMetrics,
  ]);

  // Initialize from incoming queue once
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0] ?? null);
    }
    setLocalNote(initialQueue[0]?.userNote || '');
    setEliminatedAnswers(new Set()); // Reset when new question loaded

    // Start tracking implicit metrics for the first question
    if (initialQueue.length > 0) {
      implicitMetrics.startQuestion();
    }
  }, [initialQueue, currentQuestion, implicitMetrics]);

  // Handler for toggling elimination state
  const handleToggleEliminate = useCallback(
    (index: number) => {
      if (isAnswered) return;
      setEliminatedAnswers((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    },
    [isAnswered]
  );

  // Keyboard shortcuts
  const handleSubmitAnswer = useCallback(async () => {
    // Guard against submitting without selection
    if (selectedAnswerIndex === null || !currentQuestion || isAnswered) return;

    // Runtime validation: Log undefined functions to debug "S is not a function" error
    const functionChecks = {
      recordBehavioralConfidence: typeof recordBehavioralConfidence,
      recordMomentumResult: typeof recordMomentumResult,
      recordAnswerPattern: typeof recordAnswerPattern,
      updatePerformancePrediction: typeof updatePerformancePrediction,
      recordPauseResult: typeof recordPauseResult,
      recordCircadianPerformance: typeof recordCircadianPerformance,
      inferConfidence: typeof inferConfidence,
      recordQuestionResult: typeof recordQuestionResult,
      recordQuestion: typeof recordQuestion,
      recordSessionAnswer: typeof recordSessionAnswer,
    };

    const undefinedFunctions = Object.entries(functionChecks)
      .filter(([_, type]) => type !== 'function')
      .map(([name, type]) => `${name}: ${type}`);

    if (undefinedFunctions.length > 0) {
      console.error(
        '[QuizView] CRITICAL: Undefined functions detected in handleSubmitAnswer:',
        undefinedFunctions
      );
    }

    setIsAnswered(true);

    // Sprint 4: Calculate correctness IMMEDIATELY
    const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
    const timeToAnswer = Date.now() - questionStartTime;
    const questionId = currentQuestion.id || `temp-${questionNumber}`;

    // Commuter Mode: Optimistic UI — assume save worked. Queue to Sync Manager; do not block on server.
    syncManager.queueAnswer({
      questionId,
      selectedAnswer: selectedAnswerIndex,
      isCorrect,
      timeSpentMs: timeToAnswer,
      system: currentQuestion.system ?? undefined,
      conditionId: currentQuestion.conditionId ?? undefined,
    });
    // Fire-and-forget: metrics and review sync in background (or when back online).
    void implicitMetrics.submitAnswer(questionId, isCorrect, 'multiple_choice').catch((err) => {
      console.warn('Implicit metrics submission failed (will retry when online):', err);
    });

    // Note: Removed showOptimisticFeedback() call - user feedback on correctness
    // is already shown via the answer button color change and rationale panel

    // Load pearls from medical content if not already loaded
    if (!currentQuestion.pearls && currentQuestion.conditionId) {
      try {
        const token = await getToken();
        const pearls = await fetchPearlsClient(currentQuestion.conditionId, token);
        if (pearls.length > 0) {
          // Update the current question with loaded pearls
          setCurrentQuestion((prev) => (prev ? { ...prev, pearls } : null));
        }
      } catch (error) {
        console.error('Failed to load clinical pearls:', error);
      }
    }

    // Sprint 4: Calculate par time (isCorrect and timeToAnswer already calculated above for instant feedback)
    const parTime = calculateParTime(currentQuestion);

    // Sprint 4: Record behavioral confidence (auto-inferred, no manual input)
    const behaviorSignals: BehaviorSignals = {
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
      answerChangeCount,
      eliminatedCount: eliminatedAnswers.size,
      quickInitialSelection:
        firstSelectedAnswer !== null && Date.now() - questionStartTime < parTime * 0.5,
    };

    // Defensive calls - wrap analytics functions to prevent crashes
    try {
      if (typeof recordBehavioralConfidence === 'function') {
        recordBehavioralConfidence(behaviorSignals, isCorrect);
      }
    } catch (e) {
      console.warn('[QuizView] recordBehavioralConfidence failed:', e);
    }

    // Sprint 4: Record momentum data
    try {
      if (typeof recordMomentumResult === 'function') {
        recordMomentumResult(isCorrect, timeToAnswer, parTime);
      }
    } catch (e) {
      console.warn('[QuizView] recordMomentumResult failed:', e);
    }

    // Sprint 4: Record answer pattern for post-session analysis
    try {
      if (typeof recordAnswerPattern === 'function') {
        recordAnswerPattern({
          questionId: currentQuestion.id || `temp-${questionNumber}`,
          firstAnswer: firstSelectedAnswer ?? selectedAnswerIndex,
          finalAnswer: selectedAnswerIndex,
          correctAnswer: currentQuestion.correctAnswerIndex,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
          eliminatedCount: eliminatedAnswers.size,
          answerChangeCount,
          wasCorrect: isCorrect,
        });
      }
    } catch (e) {
      console.warn('[QuizView] recordAnswerPattern failed:', e);
    }

    // Sprint 4: Update performance prediction
    try {
      let inferredConfidenceValue = 0.5; // Default
      if (typeof inferConfidence === 'function') {
        const confidenceResult = inferConfidence(behaviorSignals);
        inferredConfidenceValue =
          typeof confidenceResult === 'number'
            ? confidenceResult
            : (confidenceResult?.score ?? 0.5);
      }
      if (typeof updatePerformancePrediction === 'function') {
        updatePerformancePrediction({
          correct: isCorrect,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
          system: currentQuestion.system,
          questionNumber,
          inferredConfidence: inferredConfidenceValue,
        });
      }
    } catch (e) {
      console.warn('[QuizView] updatePerformancePrediction failed:', e);
    }

    // Sprint 4: Record for smart pause detection
    try {
      if (typeof recordPauseResult === 'function') {
        recordPauseResult({
          correct: isCorrect,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
        });
      }
    } catch (e) {
      console.warn('[QuizView] recordPauseResult failed:', e);
    }

    // Advanced analytics: Record comprehensive question result
    try {
      if (typeof recordQuestionResult === 'function') {
        recordQuestionResult({
          questionId: currentQuestion.id || `temp-${questionNumber}`,
          responseTimeMs: timeToAnswer,
          wasCorrect: isCorrect,
          difficulty: (currentQuestion.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
          answerChanges: behaviorSignals.answerChangeCount,
          eliminationsUsed: behaviorSignals.eliminatedCount,
          system: currentQuestion.system || 'Unknown',
        });
      }
    } catch (e) {
      console.warn('[QuizView] recordQuestionResult failed:', e);
    }

    setBehavioralRefreshKey((k) => k + 1);

    // Trigger sensory feedback (haptic + optional sound)
    if (isCorrect) {
      feedback.correct();
      setCurrentStreak((prev) => prev + 1);
    } else {
      feedback.incorrect();
      setCurrentStreak(0);
    }

    // Sprint 4: Record question for PANCE distribution tracking
    if (currentQuestion.system) {
      recordQuestion(currentQuestion.system, undefined);
    }

    if (sessionSettings.focus === 'review') {
      updateReviewQuestion(currentQuestion, isCorrect);
    } else {
      if (!isCorrect) {
        addMissedQuestion(currentQuestion);
      }
    }

    // Calculate question word count for vignette stamina analysis
    const questionWordCount = currentQuestion.question
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    // Record detailed performance, including system/subcategory/condition
    const timestamp = Date.now();

    addPerformanceRecord({
      timestamp,
      system: currentQuestion.system ?? null,
      subcategory: currentQuestion.subcategory ?? null,
      conditionId: currentQuestion.conditionId,
      condition: currentQuestion.condition,
      topic: currentQuestion.topic,
      isCorrect,
      focus: sessionSettings.focus,
      // Note: Difficulty removed - all questions are PANCE-level
      questionWordCount,
      timeSpentMs: timeToAnswer,
    });

    // Attempt is recorded via SyncManager.queueAnswer above (syncs to /api/questions/attempt when online or when back online).

    // Track answer in session analytics (local state for session summary)
    recordSessionAnswer(
      currentQuestion.id || `temp-${questionNumber}`,
      isCorrect,
      currentQuestion.system || 'Unknown',
      timeToAnswer
    );

    // Record circadian performance data
    recordCircadianPerformance({
      timestamp,
      isCorrect,
      topic: currentQuestion.topic,
    });

    // Update SRS schedule (if user is authenticated)
    if (user?.id && currentQuestion.id) {
      // Submit review to API endpoint (replaces legacy updateReviewOutcome)
      // This syncs FSRS data to server, creates QuestionAttempt, updates UserProgress
      getToken()
        .then(async (token) => {
          try {
            const response = await fetch(getApiEndpoint(API_ENDPOINTS.SUBMIT_REVIEW), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                questionId: currentQuestion.id,
                selectedAnswer: selectedAnswerIndex,
                timeSpentMs: timeToAnswer,
                timeToFirstClick: implicitMetrics.metrics.timeToFirstClick ?? undefined,
                answerSwitches: answerChangeCount,
                totalDwellTime: timeToAnswer,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Map API response to legacy SRSScheduleResult format for backward compatibility
            setSrsResult({
              interval: 1,
              repetition: 0,
              easiness: 2.5,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              difficulty: result.data?.quality ?? 3,
              stabilityScore: result.data?.implicitMetrics?.latencyRatio ?? 1.0,
              qualityAdjusted: result.data?.quality ?? 3,
              modifiersApplied: [],
            });
          } catch (err) {
            console.error('Failed to submit review to server:', err);
            // Silent failure - don't block the user
            // Local data is already recorded, server sync can be retried later
          }
        })
        .catch((err) => {
          console.error('Failed to get auth token:', err);
        });
    }

    // Track questions answered and check for wellness triggers
    questionsAnsweredInSession.current += 1;

    // Trigger wellness check after threshold questions
    if (
      questionsAnsweredInSession.current > 0 &&
      questionsAnsweredInSession.current % WELLNESS_CHECK_QUESTION_THRESHOLD === 0
    ) {
      setWellnessReason('rapid_questions');
      setShowWellnessModal(true);
    }

    // Check if studying late at night
    const currentHour = new Date().getHours();
    if (
      (currentHour >= LATE_NIGHT_START_HOUR || currentHour < LATE_NIGHT_END_HOUR) &&
      questionsAnsweredInSession.current % LATE_NIGHT_CHECK_INTERVAL === 0
    ) {
      setWellnessReason('late_night');
      setShowWellnessModal(true);
    }
  }, [
    selectedAnswerIndex,
    currentQuestion,
    isAnswered,
    sessionSettings,
    updateReviewQuestion,
    addMissedQuestion,
    addPerformanceRecord,
    recordCircadianPerformance,
    user,
    questionStartTime,
    performanceData,
    getToken,
    currentStreak,
    answerChangeCount,
    eliminatedAnswers,
    firstSelectedAnswer,
    setCurrentQuestion,
    questionNumber,
    implicitMetrics,
  ]);

  // Keyboard shortcuts using centralized shortcut context
  // FLIP_CARD: Toggle showing the explanation/rationale after answering
  useShortcut(
    'FLIP_CARD',
    () => {
      if (isAnswered) {
        setShowRationale((prev) => !prev);
      }
    },
    { enabled: isAnswered }
  );

  // NEXT_QUESTION: Go to next question after answering
  useShortcut(
    'NEXT_QUESTION',
    () => {
      if (isAnswered) {
        nextButtonRef.current?.click();
      }
    },
    { enabled: isAnswered }
  );

  // Keep the legacy keyboard handler for quiz-specific shortcuts (A/B/C/D, Shift+A/B/C/D, Enter, Escape)
  // These are quiz-specific and don't map to global actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'textarea') {
        return;
      }

      // Escape key to go back to menu
      if (event.key === 'Escape') {
        event.preventDefault();
        onShowMenu();
        return;
      }

      // Map letter keys to indices (A=0, B=1, C=2, D=3)
      const letterToIndex: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

      // Shift + A/B/C/D to toggle elimination
      if (!isAnswered && event.shiftKey) {
        const eliminateIndex = letterToIndex[event.key.toLowerCase()];

        if (eliminateIndex !== undefined && currentQuestion?.options[eliminateIndex]) {
          event.preventDefault();
          handleToggleEliminate(eliminateIndex);
          return;
        }
      }

      // Regular A/B/C/D to select (only if not eliminated)
      if (!isAnswered && !event.shiftKey) {
        const index = letterToIndex[event.key.toLowerCase()];
        if (index !== undefined && !eliminatedAnswers.has(index)) {
          event.preventDefault();
          optionButtonsRef.current[index]?.click();
        }
      }

      // Enter to submit selected answer (if not yet submitted)
      if (!isAnswered && selectedAnswerIndex !== null && event.key === 'Enter') {
        event.preventDefault();
        handleSubmitAnswer();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isAnswered,
    selectedAnswerIndex,
    handleToggleEliminate,
    eliminatedAnswers,
    currentQuestion,
    onShowMenu,
    handleSubmitAnswer,
  ]);

  const handleOptionClick = (index: number) => {
    // Guard against selecting eliminated answers or already answered questions
    if (isAnswered || !currentQuestion || eliminatedAnswers.has(index)) return;

    // Track answer changes
    if (firstSelectedAnswer === null) {
      // First selection
      setFirstSelectedAnswer(index);
    } else if (selectedAnswerIndex !== null && selectedAnswerIndex !== index) {
      // Changed answer
      setAnswerChangeCount((prev) => prev + 1);
    }

    // Record answer selection for implicit metrics
    implicitMetrics.recordAnswerSelection(index);

    // Just select the option, don't submit yet
    setSelectedAnswerIndex(index);
  };

  const handleExplainDifferently = useCallback(async () => {
    if (!currentQuestion || selectedAnswerIndex === null) return;

    setIsExplainerLoading(true);
    setAlternateRationale(''); // Start with empty string for streaming

    try {
      const userAnswer = currentQuestion.options[selectedAnswerIndex] ?? '';
      const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '';

      // Build prompt for alternate explanation
      const prompt = `You are a clinical educator helping a PA student understand why they got a question wrong.

Question: ${currentQuestion.question}

Their Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

Original Explanation: ${currentQuestion.rationale}

Provide an ALTERNATE explanation that approaches this from a different angle. Use:
- Different clinical reasoning pathway
- Different mnemonic or memory aid
- Different real-world clinical scenario
- Simpler language if the original was technical

Keep it concise (3-4 sentences max) and focus on helping them understand WHY they made this mistake.`;

      // Use Edge streaming API (/api/gemini/stream) so user sees tokens immediately (latency masking)
      const { callGeminiTextStreaming } = await import('@/services/ai/geminiService');

      try {
        await callGeminiTextStreaming('gemini-2.5-flash', prompt, 0.7, {
          getToken,
          onChunk: (chunk) => setAlternateRationale((prev) => prev + chunk),
          onComplete: () => setIsExplainerLoading(false),
          onError: () => setIsExplainerLoading(false),
        });
        setIsExplainerLoading(false);
      } catch (err) {
        console.error('Error generating alternate rationale:', err);
        setAlternateRationale(
          "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
        );
        setIsExplainerLoading(false);
      }
    } catch (err) {
      // User-friendly error message instead of technical details
      console.error('Error generating alternate rationale:', err);
      setAlternateRationale(
        "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
      );
      setIsExplainerLoading(false);
    }
  }, [currentQuestion, selectedAnswerIndex]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNote = e.target.value;
    setLocalNote(newNote);

    if (noteUpdateTimeout.current) {
      clearTimeout(noteUpdateTimeout.current);
    }

    noteUpdateTimeout.current = window.setTimeout(() => {
      if (currentQuestion) {
        updateQuestionNote(currentQuestion, newNote);
      }
    }, 750);
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    if (isFlagged) {
      removeFlaggedQuestion(currentQuestion);
    } else {
      addFlaggedQuestion(currentQuestion);
    }
  };

  const topicStats = useMemo(() => {
    if (!isAnswered || !currentQuestion) return null;

    const topicQuestions = performanceData
      .filter((p) => p.topic === currentQuestion.topic)
      .slice(-100);

    const correct = topicQuestions.filter((p) => p.isCorrect).length;
    const total = topicQuestions.length;
    const score = total > 0 ? (correct / total) * 100 : 0;

    return { score, correct, total };
  }, [isAnswered, currentQuestion, performanceData]);

  const getBarColor = (score: number): string =>
    getAccuracyBarClass(score);

  // NO CURRENT QUESTION - Show appropriate screen based on context
  if (!currentQuestion) {
    // In continuous mode, show loading while waiting for questions
    if (shouldEndlesslyReplenish) {
      if (!isGeneratingQuestion) {
        void replenishQueue();
      }
      return (
        <DrillLoadingState
          message="Preparing your question..."
          variant="question"
          showTimer={false}
        />
      );
    }

    // Finite modes (review, reviewFlagged) - show session complete
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4">
        <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
        <p className="text-[var(--color-text-secondary)]">
          You've reached the end of this set of questions.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
          <button onClick={onShowMenu} className="btn-glass px-6 py-2">
            Back to Dashboard
          </button>
          <button onClick={handleEndSession} className="btn-secondary px-6 py-2">
            View Summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4 mt-1">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Back to dashboard */}
            <button
              onClick={onShowMenu}
              className="p-2 rounded-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors flex-shrink-0 flex items-center justify-center border border-[var(--color-border)]"
              aria-label="Back to Menu"
            >
              <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
                Question {questionNumber}
              </p>
              {/* Sprint 4: Momentum Badge (compact) */}
              {questionNumber > 3 && <MomentumBadge refreshKey={behavioralRefreshKey} />}
              {/* Sprint 4: Streak Badge */}
              {currentStreak >= 3 && <StreakBadge streak={currentStreak} />}
              {/* Sprint 4: Question Timer */}
              {currentQuestion && (
                <QuestionTimer
                  startTime={questionStartTime}
                  parTimeMs={calculateParTime(currentQuestion)}
                  isAnswered={isAnswered}
                  isVisible={showTimerVisible}
                  compact
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Sprint 4: Session Stats Toggle */}
            <button
              onClick={() => setShowStatsOverlay((prev) => !prev)}
              title="Toggle session stats (S)"
              className={`p-1.5 rounded-full transition-colors border ${
                showStatsOverlay
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* Report Issue - for reporting bad questions to admins */}
            <button
              onClick={() => setShowReportModal(true)}
              title="Report an issue with this question"
              className="p-1.5 rounded-full transition-colors border bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-data-fail)]/10 hover:text-[var(--color-data-fail)] hover:border-[var(--color-data-fail)]"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>

            {/* Flag for personal review */}
            <button
              onClick={toggleFlag}
              title={isFlagged ? 'Unflag for review' : 'Flag for review'}
              className={`p-1.5 rounded-full transition-colors border ${
                isFlagged
                  ? 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]'
                  : 'bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
              }`}
            >
              <FlagIcon className="w-5 h-5" />
            </button>

            {/* Clear Highlights */}
            <button
              onClick={() => {
                const container = document.getElementById('question-container');
                if (!container) return;
                const spans = container.querySelectorAll('span.user-highlight');
                spans.forEach((s) => {
                  const parent = s.parentNode;
                  if (!parent) return;
                  while (s.firstChild) {
                    parent.insertBefore(s.firstChild, s);
                  }
                  parent.removeChild(s);
                });
              }}
              title="Clear highlights"
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)] transition-colors"
            >
              <ClearHighlightIcon className="w-5 h-5" />
            </button>

            {/* Lab calculators (Anion Gap, Osmolar Gap, Parkland) – encourages active calculation */}
            <button
              onClick={() => setShowLabCalcModal(true)}
              title="Lab calculators (Anion Gap, Osmolar Gap, Parkland)"
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
            >
              <Calculator className="w-5 h-5" />
            </button>

            {/* Font size controls */}
            <div className="flex items-center border border-[var(--color-border)] rounded-md bg-[var(--color-card-bg)]">
              <button
                onClick={() => setFontSizeAdjustment((prev) => prev - 1)}
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-l-md text-sm"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <div className="w-px h-4 bg-[var(--color-border)]"></div>
              <button
                onClick={() => setFontSizeAdjustment((prev) => prev + 1)}
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-r-md text-sm"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* End session */}
            <button
              onClick={handleEndSession}
              title="End Session"
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-data-fail)]/10 hover:border-[var(--color-data-fail)] hover:text-[var(--color-data-fail)] transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <SplitPaneDrillLayout
          vignette={useSplitPane ? currentQuestion.vignette : null}
          className="mb-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id ?? `${currentQuestion.question}-${questionNumber}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Sprint 10: Trust Badge for question source; Beta badge when from staging */}
              <div className="flex items-center gap-2 mb-2">
                <TrustBadge
                  source={currentQuestion.source}
                  fromStaging={currentQuestion.fromStaging}
                  size="sm"
                />
              </div>
              {currentQuestion.contentSource === 'openstax' && (
                <OpenStaxAttributionFooter
                  title={currentQuestion.contentSourceTitle || 'Textbook'}
                  sourceUrl="https://openstax.org"
                />
              )}
              {currentQuestion.imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Clinical image for question"
                    className="w-full max-h-[320px] object-contain"
                  />
                </div>
              )}
              <QuestionDisplay
                text={
                  useSplitPane && currentQuestion.vignette
                    ? currentQuestion.question.replace(
                        (currentQuestion.vignette || '') + '\n\n',
                        ''
                      )
                    : currentQuestion.question
                }
              />
            </motion.div>
          </AnimatePresence>

          {/* ANSWER OPTIONS */}
          <div className="space-y-3 mt-6">
            {(currentQuestion.options || []).map((option, index) => {
              const isCorrect = index === currentQuestion.correctAnswerIndex;
              const isSelected = index === selectedAnswerIndex;

              return (
                <AnswerChoice
                  key={index}
                  ref={(el) => {
                    optionButtonsRef.current[index] = el;
                  }}
                  text={option}
                  index={index}
                  isSelected={isSelected}
                  isCorrect={isCorrect}
                  isAnswered={isAnswered}
                  isEliminated={eliminatedAnswers.has(index)}
                  onSelect={handleOptionClick}
                  onToggleEliminate={handleToggleEliminate}
                  fontSizeAdjustment={fontSizeAdjustment}
                />
              );
            })}
          </div>

          {/* SUBMIT BUTTON - Only show when answer is selected but not yet submitted */}
          {!isAnswered && selectedAnswerIndex !== null && (
            <div className="mt-6 text-center animate-fade-in space-y-4">
              <button onClick={handleSubmitAnswer} className="btn-glass px-8 py-3">
                Submit Answer
              </button>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Press{' '}
                <kbd className="px-2 py-1 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded text-xs font-mono">
                  Enter
                </kbd>{' '}
                to submit
              </p>
            </div>
          )}

          {/* FEEDBACK / RATIONALE */}
          {isAnswered && (
            <div className="mt-6 animate-fade-in space-y-4">
              {topicStats && (
                <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg">
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="font-semibold text-[var(--color-text-secondary)]">
                      {currentQuestion.topic}
                    </span>
                    <span className="font-medium text-[var(--color-text-muted)]">
                      {topicStats.score.toFixed(0)}% ({topicStats.correct}/{topicStats.total})
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${getBarColor(
                        topicStats.score
                      )} transition-all duration-500 ease-out`}
                      style={{ width: `${topicStats.score}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg feedback-content">
                {/* Error Tagger - Only show when incorrect */}
                {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
                  <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                    <ErrorTagger onTagError={updateLastPerformanceErrorTag} />
                  </div>
                )}

                {/* Peer selection stats: "42% of students also chose B" — Wisdom of the Crowds (especially when wrong) */}
                {selectedAnswerIndex !== null && answerDistribution && (() => {
                  const letter = ['A', 'B', 'C', 'D'][selectedAnswerIndex];
                  const entry = answerDistribution.find((d) => d.optionLetter === letter);
                  if (!entry || entry.count === 0) return null;
                  return (
                    <p className="mb-4 text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                      <span className="font-medium text-[var(--color-text-secondary)]">
                        {entry.percent}% of students also chose {letter}.
                      </span>
                      {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
                        <> This was a tricky distractor — you&apos;re not alone.</>
                      )}
                    </p>
                  );
                })()}

                {/* Core PANCE: rationale – structured (5-section) or legacy HTML */}
                {(() => {
                  const r = currentQuestion.rationale;
                  const structured: StructuredRationale | null =
                    typeof r === 'object' && r !== null && 'whyCorrect' in r
                      ? (r as StructuredRationale)
                      : (() => {
                          if (typeof r !== 'string') return null;
                          try {
                            const parsed = JSON.parse(r) as unknown;
                            if (parsed && typeof parsed === 'object' && 'whyCorrect' in parsed)
                              return parsed as StructuredRationale;
                          } catch {
                            /* not JSON */
                          }
                          return null;
                        })();
                  if (structured) {
                    const letters = ['A', 'B', 'C', 'D'] as const;
                    const whyKeys = ['whyIncorrectA', 'whyIncorrectB', 'whyIncorrectC', 'whyIncorrectD'] as const;
                    return (
                      <div className="space-y-4">
                        {structured.bottomLine && (
                          <section>
                            <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                              Bottom Line
                            </h3>
                            <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg px-4 py-3">
                              {structured.bottomLine}
                            </p>
                          </section>
                        )}
                        <section>
                          <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                            Why the Correct Answer is Right
                          </h3>
                          <div
                            className="text-[var(--color-text-secondary)] leading-relaxed bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg px-4 py-3"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeForRationale(structured.whyCorrect.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')),
                            }}
                          />
                        </section>
                        <section>
                          <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                            Why the Distractors Are Wrong
                          </h3>
                          <div className="space-y-2">
                            {letters.map((letter, i) => {
                              if (i === currentQuestion.correctAnswerIndex) return null;
                              const key = whyKeys[i];
                              if (!key) return null;
                              const text = structured[key as keyof typeof structured];
                              if (!text || typeof text !== 'string') return null;
                              const optionText = currentQuestion.options[i];
                              const isUserChoice = i === selectedAnswerIndex;
                              return (
                                <div
                                  key={letter}
                                  className={`px-4 py-2 rounded-lg border text-sm ${
                                    isUserChoice
                                      ? 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20 border-dusty-rose-300 dark:border-dusty-rose-700'
                                      : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                                  }`}
                                >
                                  <span className="font-semibold text-[var(--color-text-muted)]">
                                    Option {letter} ({optionText}):
                                  </span>{' '}
                                  <span
                                    className="text-[var(--color-text-secondary)]"
                                    dangerouslySetInnerHTML={{
                                      __html: text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'),
                                    }}
                                  />
                                  {isUserChoice && (
                                    <span className="ml-2 text-xs text-dusty-rose-600 dark:text-dusty-rose-400 font-medium">
                                      (Your answer)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                        {structured.highYieldImageOrTable && structured.highYieldImageOrTable !== 'N/A' && (
                          <section>
                            <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                              High-Yield Image / Table
                            </h3>
                            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed bg-steel-blue-50 dark:bg-steel-blue-900/20 border border-steel-blue-200 dark:border-steel-blue-800 rounded-lg px-4 py-3">
                              {structured.highYieldImageOrTable}
                            </p>
                          </section>
                        )}
                        {structured.clinicalPearl && (
                          <section>
                            <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                              Clinical Pearl
                            </h3>
                            <div
                              className="text-[var(--color-text-secondary)] leading-relaxed bg-muted-amber-50 dark:bg-muted-amber-900/20 border border-muted-amber-200 dark:border-muted-amber-800 rounded-lg px-4 py-3"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeForRationale(structured.clinicalPearl.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')),
                              }}
                            />
                          </section>
                        )}
                        {structured.commonPitfalls && structured.commonPitfalls.length > 0 && (
                          <section>
                            <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                              Common Pitfalls
                            </h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                              {structured.commonPitfalls.map((pitfall, i) => (
                                <li key={i}>{pitfall}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </div>
                    );
                  }
                  // Legacy rationale: enforce 5-section style – no wall of text (see IMMEDIATE_CONTENT_ACTION_PLAN.md)
                  const raw = (currentQuestion.rationale as string) || '';
                  const firstSentenceEnd = raw.search(/[.!?]\s+/);
                  const bottomLine =
                    firstSentenceEnd > 0 ? raw.slice(0, firstSentenceEnd + 1).trim() : '';
                  const restBody = firstSentenceEnd > 0 ? raw.slice(firstSentenceEnd + 1).trim() : '';
                  const showRest = restBody.length > 0;
                  return (
                    <div className="space-y-4">
                      {bottomLine && (
                        <section>
                          <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                            Bottom Line
                          </h3>
                          <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800 rounded-lg px-4 py-3">
                            {bottomLine}
                          </p>
                        </section>
                      )}
                      {(showRest || !bottomLine) && (
                        <section>
                          <h3 className="font-bold text-base mb-1.5 text-[var(--color-text-primary)]">
                            Rationale
                          </h3>
                          <div
                            className="text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-4 py-3 max-h-[40vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: showRest ? restBody : raw }}
                          />
                        </section>
                      )}
                    </div>
                  );
                })()}

                {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
                  <div className="mt-4">
                    <button
                      onClick={handleExplainDifferently}
                      disabled={isExplainerLoading}
                      className="btn-glass px-4 py-2 text-sm"
                    >
                      {isExplainerLoading ? 'Thinking...' : 'Explain this differently'}
                    </button>
                  </div>
                )}

                {isExplainerLoading && (
                  <div className="mt-4 flex items-center space-x-2 text-[var(--color-text-secondary)]">
                    <div className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse"></div>
                    <div
                      className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-[var(--color-bg-tertiary)] rounded-full animate-pulse"
                      style={{ animationDelay: '0.4s' }}
                    ></div>
                    <span className="text-sm">Generating new explanation...</span>
                  </div>
                )}

                {alternateRationale && !isExplainerLoading && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)] animate-fade-in">
                    <h4 className="font-bold text-md mb-2 text-[var(--color-text-primary)]">
                      Alternate Explanation
                    </h4>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {alternateRationale}
                    </p>
                  </div>
                )}

                {/* Clinical Pearls Section */}
                {currentQuestion.pearls && currentQuestion.pearls.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                      Key Pearls: {currentQuestion.condition}
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                      {currentQuestion.pearls.map((pearl, index) => (
                        <li key={index} dangerouslySetInnerHTML={{ __html: sanitizeForRationale(pearl) }} />
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                    My Notes
                  </h3>
                  <textarea
                    value={localNote}
                    onChange={handleNoteChange}
                    placeholder="Type your notes here... They will be saved automatically."
                    className="w-full p-2 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {isAnswered && (
            <div className="mt-4 text-center">
              <button
                ref={nextButtonRef}
                onClick={() => {
                  try {
                    showNextQuestion();
                  } catch (error) {
                    console.error('Error in Next Question button click:', error);
                    setError('Failed to proceed to next question. Please refresh the page.');
                  }
                }}
                className="px-8 py-3 btn-glass font-bold rounded-lg"
              >
                Next Question
              </button>
            </div>
          )}
        </SplitPaneDrillLayout>
      </div>

      {/* Session stats available via S shortcut (SessionStatsOverlay) - no cluttering popups */}

      {/* Wellness Check Modal */}
      <WellnessCheckModal
        isOpen={showWellnessModal}
        onClose={() => setShowWellnessModal(false)}
        reason={wellnessReason}
      />

      {/* Lab calculators modal – Anion Gap, Osmolar Gap, Parkland (in-question Calc button) */}
      {showLabCalcModal && (
        <QuizLabCalcModal onClose={() => setShowLabCalcModal(false)} />
      )}

      {/* Report Question Issue Modal */}
      {currentQuestion && (
        <FlagQuestionModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          questionId={currentQuestion.id || `temp-${Date.now()}`}
          questionText={currentQuestion.question}
          correctAnswer={
            typeof currentQuestion.correctIndex === 'number'
              ? currentQuestion.answers?.[currentQuestion.correctIndex]
              : undefined
          }
          topic={currentQuestion.topic}
          system={currentQuestion.system || undefined}
          userId={user?.id || 'anonymous'}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userFirstName={user?.firstName || undefined}
        />
      )}

      {/* Sprint 4: Session Stats Overlay */}
      <SessionStatsOverlay
        isVisible={showStatsOverlay}
        onToggle={() => setShowStatsOverlay((prev) => !prev)}
        performanceData={performanceData.map((p) => ({
          topic: p.system || 'Unknown',
          correct: p.isCorrect,
        }))}
        currentQuestionNumber={questionNumber}
      />

      {/* Sprint 4: Session End Summary */}
      <SessionEndSummary
        isOpen={showSessionEndSummary}
        onClose={() => {
          setShowSessionEndSummary(false);
          resetSessionDistribution();
          resetPrediction();
          resetPauseTracking();
          onEndSession();
        }}
        performanceData={performanceData}
        sessionSummary={getSessionSummary()}
        sessionStartTime={sessionStartTime.current}
        sessionSettings={{
          mode: sessionSettings.mode,
          focus: sessionSettings.focus,
        }}
        onContinueStudying={() => {
          setShowSessionEndSummary(false);
          // Could restart session or stay on current screen
        }}
        onViewAnalytics={() => {
          setShowSessionEndSummary(false);
          resetSessionDistribution();
          resetPrediction();
          resetPauseTracking();
          onEndSession();
          // The analytics view would be shown by the parent component
        }}
      />
    </div>
  );
};

export default QuizView;
