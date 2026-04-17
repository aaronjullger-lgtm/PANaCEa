// components/QuizView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useShortcut } from '@/contexts/ShortcutContext';
import { useUser } from '@clerk/clerk-react';
import { useCommuter } from '@/contexts/CommuterContext';
import { announceToScreenReader } from '@/lib/utils/accessibilityUtils';
// useSwipeGestures removed — not used in this file
import { enhancedHaptics } from '@/lib/enhancedHaptics';
import { useQuizSessionRecovery } from '@/hooks/useQuizSessionRecovery';
import { debounce } from '@/lib/utils/debounce';
import { useQuizTimer } from '@/hooks/useQuizTimer';
import { useQuizKeyboard } from './hooks/useQuizKeyboard';
import { useQuizReplenishment } from './hooks/useQuizReplenishment';

// Core services - using client-safe API wrappers
import { fetchPearlsClient } from '@/services/client/questionApi';
import {
  // fetchSessionQuestions moved to useQuizReplenishment hook
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
import { recordCircadianPerformance } from '@/services/analytics';
import { updatePerformancePrediction, resetPrediction } from '@/services/analytics';

// Domain services
import { recordQuestion, getSessionSummary, resetSessionDistribution } from '@/services/domain';

// AI services
// generateAlternateRationale removed — moved to AnswerFeedback component

// Components — lazy-load conditionally shown modals/overlays
import { lazy, Suspense } from 'react';
const FlagQuestionModal = lazy(() =>
  import('@/components/modals/FlagQuestionModal').then((m) => ({ default: m.FlagQuestionModal }))
);
const QuizLabCalcModal = lazy(() =>
  import('@/components/quiz/QuizLabCalcModal').then((m) => ({ default: m.QuizLabCalcModal }))
);
const WellnessCheckModal = lazy(() =>
  import('@/components/wellness/WellnessCheckModal').then((m) => ({ default: m.default }))
);
const BreakTimer = lazy(() =>
  import('@/components/session/BreakTimer').then((m) => ({ default: m.BreakTimer }))
);
const FatigueBreakPrompt = lazy(() =>
  import('@/components/session/FatigueBreakPrompt').then((m) => ({ default: m.FatigueBreakPrompt }))
);
const SessionEndSummary = lazy(() =>
  import('@/components/quiz/SessionEndSummary').then((m) => ({ default: m.SessionEndSummary }))
);
const SocraticTutorChat = lazy(() =>
  import('@/components/quiz/SocraticTutorChat').then((m) => ({ default: m.SocraticTutorChat }))
);

import AnswerChoice from '@/components/quiz/AnswerChoice';
import {
  useBehavioralTracker,
  OptionHoverTracker,
} from '@/components/quiz/Tracker';
import { useUnifiedKinetics } from '@/hooks/useUnifiedKinetics';
import { useFatigueTracking } from '@/hooks/useFatigueTracking';
// ErrorTagger moved to AnswerFeedback component
import { DrillLoadingState, InlineSpinner } from '@/components/loading';

// Sprint 4: Enhanced session components (streamlined - removed janky popups)
import { SessionStatsOverlay } from '@/components/quiz/SessionStatsOverlay';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';

// Sprint 10: Trust badges for question source indication
import { TrustBadge } from '@/components/ui/TrustBadge';
// Progress moved to QuizToolbar component
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { SplitPaneDrillLayout } from '@/components/drill/SplitPaneDrillLayout';
import { NormalLabsPanel } from '@/components/session/NormalLabsPanel';

// FlagIcon, ClearHighlightIcon, CloseIcon, lucide icons moved to QuizToolbar/AnswerFeedback
// ROUTES moved to QuizToolbar

// Types
import type { Question, PerformanceRecord, SessionSettings, ErrorTag } from '@/types';
import type { SRSScheduleResult } from '@/lib/services/srsService';
// ExplanationPanel moved to AnswerFeedback component
import QuizToolbar from '@/components/session/QuizToolbar';
import AnswerFeedback from '@/components/session/AnswerFeedback';
import { SessionPacer } from '@/components/session/SessionPacer';
import { useSessionWellness } from '@/hooks/useSessionWellness';

// Lib utils
import { calculateParTime } from '@/lib/utils/questionComplexity';

/** Map Question to the shape inferQuestionType expects (type, stem, hasImage, mediaAssets). */
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
import {
  optimisticUpdateStats,
  optimisticUpdateSystemStats,
  createOptimisticPerformanceRecord,
} from '@/lib/utils/optimisticUI';
// getApiEndpoint, API_ENDPOINTS removed — no longer used directly in QuizView

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useImplicitMetrics } from '@/hooks/useImplicitMetrics';
import { inferQuestionType } from '@/hooks/useTelemetryCollector';
import { useCausalChain, expertiseToDisplayLevel } from '@/hooks/useCausalChain';
import { useAnalyticsTracking, type QuestionMeta } from '@/hooks/useAnalyticsTracking';
import { useWellnessChecks } from '@/hooks/useWellnessChecks';
import { computeScore } from '@/lib/scoring/computeScore';

// Other services (non-barrel)
import { feedback } from '@/services/core/feedbackService';
import { syncManager } from '@/lib/services/sync/syncManager';
import { logger } from "@/lib/simple-logger";

/** Regex to strip HTML tags (defined outside JSX to avoid TS1382 parse errors) */
const STRIP_HTML_TAGS_REGEX = /<[^>]*>/g;
/** Regex to match <br> and <br/> for normalizing line breaks */
const BR_TAG_REGEX = /<br\s*\/?>/gi;

const LOG_SCOPE = 'QuizView';
const quizLogger = logger.scope(LOG_SCOPE);

// Strip basic HTML tags from question text while preserving table HTML rendered separately
function stripSimpleHtmlTags(text: string): string {
  if (!text) return text;
  return text.replace(/<[^>]+>/g, '');
}

export interface QuizViewProps {
  initialQueue: Question[];
  setParentQueue: React.Dispatch<React.SetStateAction<Question[]>>;
  addPerformanceRecord: (record: PerformanceRecord) => void;
  addMissedQuestion: (question: Question) => void;
  updateReviewQuestion: (question: Question, wasCorrect: boolean) => void;
  /** When user answers a Due sibling correctly, remove that concept from the Due queue */
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
  /** When true and question has vignette, use split-pane layout (vignette left, content right) */
  useSplitPane?: boolean;
  /** Start a review session with missed questions (from SessionEndSummary) */
  onReviewMissed?: () => void;
  /** When true, enables exam simulator mode (hide feedback, enforce timer, high-contrast theme) */
  isExamSimulator?: boolean;
  /** When true, enables full sit-down test mode (locked navigation, 300 questions, progress tracking) */
  isFullSitDownTest?: boolean;
  /** Total number of questions in the session (used for progress tracking in full sit-down test) */
  totalQuestions?: number;
  /** Breadcrumb/context label (e.g. "Practice → Diagnostic Puzzle") shown beside BackLink */
  modeLabel?: string;
  /** Optional external session identifier used by some parent modes */
  sessionId?: string | null;
}

const QuestionDisplay: React.FC<{ text: string }> = React.memo(({ text }) => {
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
      } catch (highlightErr) {
        // Highlighting failed - clear selection (cross-element ranges can't be wrapped)
        console.debug('[QuizView] user-highlight failed', highlightErr);
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
      .replace(BR_TAG_REGEX, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const [beforeTableRaw = '', afterTableRaw = ''] = normalized.split('|||TABLE|||');

    // 4) Pull out the last sentence (the actual question) after the table
    const lastSentenceMatch = afterTableRaw.match(/[^.!?]+[.!?]+\s*$/);
    const lastSentenceRaw = lastSentenceMatch ? lastSentenceMatch[0].trim() : '';

    const vignetteAfterTableRaw = lastSentenceRaw
      ? afterTableRaw.replace(lastSentenceMatch![0], '').trim()
      : afterTableRaw.trim();

    const beforeTable = stripSimpleHtmlTags(beforeTableRaw);
    const vignetteAfterTable = stripSimpleHtmlTags(vignetteAfterTableRaw);
    const lastSentence = stripSimpleHtmlTags(lastSentenceRaw);

    return (
      <div
        ref={containerRef}
        id="question-container"
        tabIndex={-1}
        className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-xl p-6 space-y-4"
        style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
      >
        {/* Text before the table */}
        {beforeTable && <p className="whitespace-pre-wrap">{beforeTable}</p>}

        {/* Table */}
        <div
          className="my-2"
          dangerouslySetInnerHTML={{ __html: sanitizeForRationale(tableHTML) }}
        />

        {/* Any non-final text after the table */}
        {vignetteAfterTable && <p className="whitespace-pre-wrap">{vignetteAfterTable}</p>}

        {/* Final bolded question line */}
        {lastSentence && <p className="font-semibold whitespace-pre-wrap">{lastSentence}</p>}
      </div>
    );
  }

  // ---------- NON-TABLE BRANCH ----------
  const normalizedText = stripSimpleHtmlTags(
    text.replace(/&lt;br\s*\/?&gt;/gi, '\n').replace(BR_TAG_REGEX, '\n')
  );

  const lastSentenceMatch = normalizedText.match(/[^.!?]+[.!?]+\s*$/);

  if (!lastSentenceMatch) {
    return (
      <div
        ref={containerRef}
        id="question-container"
        tabIndex={-1}
        className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap bg-[var(--color-bg-primary)] rounded-xl p-6"
        style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
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
      tabIndex={-1}
      className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] rounded-xl p-6"
      style={{ fontSize: `calc(1em + var(--font-size-adj))`, boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      <p className="whitespace-pre-wrap">{vignette}</p>
      <p className="font-semibold mt-4 whitespace-pre-wrap">{lastSentence}</p>
    </div>
  );
});

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
  const prefersReducedMotion = useReducedMotion();
  // Validate required callback props at runtime
  useEffect(() => {
    const requiredCallbacks = {
      setParentQueue,
      addPerformanceRecord,
      addMissedQuestion,
      updateReviewQuestion,
      removeDueConcept,
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
        quizLogger.error(`Required callback prop "${name}" is not a function`, {
          callbackType: typeof callback,
        });
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
  const behavioralTracker = useBehavioralTracker();
  const microKinetics = useUnifiedKinetics();
  const fatigueTracking = useFatigueTracking(isExamSimulator);
  const sessionWellness = useSessionWellness();

  // Causal Reasoning Chain — mechanistic "Why This Happens" (tier1 Item 4)
  const causalChainHook = useCausalChain();
  const { trackAnswer: analyticsTrackerTrack } = useAnalyticsTracking();
  const analyticsTracker = { trackAnswer: analyticsTrackerTrack };

  // ---- QUEUE HANDLING ----
  const [queue, setQueue] = useState<Question[]>(initialQueue);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQueue[0] || null);

  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [questionNumber, setQuestionNumber] = useState<number>(1);
  const [lastImplicitConfidence, setLastImplicitConfidence] = useState<number | undefined>(undefined);

  // ---- SRS RESULT STATE ----
  const [srsResult, setSrsResult] = useState<SRSScheduleResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const [showRationale, setShowRationale] = useState<boolean>(false);
  const [alternateRationale, setAlternateRationale] = useState<string | null>(null);
  const [isExplainerLoading, setIsExplainerLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [localNote, setLocalNote] = useState<string>('');

  // eliminatedAnswers + eliminationTimestampsRef owned by useQuizKeyboard hook (below)

  // Track answer changes for analytics (using refs to avoid re-renders)
  const answerChangeCountRef = useRef<number>(0);
  const firstSelectedAnswerRef = useRef<number | null>(null);
  // Setters for session recovery (update refs without causing re-renders)
  const setAnswerChangeCount = (value: number) => { answerChangeCountRef.current = value; };
  const setFirstSelectedAnswer = (value: number | null) => { firstSelectedAnswerRef.current = value; };

  /** Recovered session score base from tab crash recovery (Finding 4 fix).
   *  After restore, this ref holds the correct/total count from the previous
   *  session fragment so the score display isn't zeroed out. */
  const recoveredSessionScoreRef = useRef<{ correct: number; total: number } | null>(null);

  // ---- QUEUE REPLENISHMENT (extracted hook) ----
  const {
    isGeneratingQuestion,
    replenishAttempts,
    replenishmentError,
    shouldEndlesslyReplenish,
    replenishQueue,
    retryReplenishment,
  } = useQuizReplenishment({
    queue,
    setQueue,
    setParentQueue,
    setError,
    sessionSettings,
    growthAreas,
    getToken,
  });

  // Report issue modal state
  const [showReportModal, setShowReportModal] = useState(false);

  // Socratic Tutor (Tutor Me) for incorrect answers
  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  // Lab calculator modal (Anion Gap, Osmolar Gap, Parkland) – encourages active calculation
  const [showLabCalcModal, setShowLabCalcModal] = useState(false);

  // Peer selection stats ("42% of students also chose B") – Wisdom of the Crowds
  const [answerDistribution, setAnswerDistribution] = useState<
    { optionLetter: string; count: number; percent: number }[] | null
  >(null);

  // Sprint 3: Wellness checks extracted to useWellnessChecks hook
  const wellness = useWellnessChecks();

  // Sprint 4: Enhanced session state
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);
  const [showSessionEndSummary, setShowSessionEndSummary] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const commuter = useCommuter();
  const showTimerVisible = showTimer && !commuter?.isCommuterMode;
  // Auto‑read question aloud when commuter mode is active
  useEffect(() => {
    if (!commuter?.isCommuterMode || !commuter.settings.autoReadQuestions || !currentQuestion) {
      return undefined;
    }
    // Build readable text from question vignette and stem
    const vignette = currentQuestion.vignette ? currentQuestion.vignette + ' ' : '';
    const stem = currentQuestion.question || '';
    const text = vignette + stem;
    if (!text.trim()) {
      return undefined;
    }

    commuter.speak(text);
    // Start listening for voice answers after a short delay
    const timer = setTimeout(() => {
      if (commuter.settings.voiceEnabled) {
        commuter.startListening();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [commuter, currentQuestion]);
  const [behavioralRefreshKey, setBehavioralRefreshKey] = useState(0);

  // Fix #6a: Overflow menu moved to QuizToolbar component
  // Fix #6b: Collapsible detailed explanation
  // Fix #6c: Notes textarea toggle
  const [showNotes, setShowNotes] = useState(false);
  // Normal Labs reference panel (slide-out from right)
  const [showNormalLabsPanel, setShowNormalLabsPanel] = useState(false);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Ref-based callback to break the submit ↔ keyboard cycle:
  // the keyboard hook needs a submit handler before the real callback is defined.
  const handleSubmitAnswerRef = useRef<() => void>(() => {});

  // ---- KEYBOARD SHORTCUTS & ELIMINATION (extracted hook) ----
  const {
    eliminatedAnswers,
    setEliminatedAnswers,
    handleToggleEliminate,
    eliminationTimestampsRef,
    resetElimination,
  } = useQuizKeyboard({
    isAnswered,
    selectedAnswerIndex,
    currentQuestion,
    onShowMenu,
    onSubmitAnswer: () => handleSubmitAnswerRef.current(),
    onToggleRationale: () => setShowRationale((prev) => !prev),
    optionButtonsRef,
    nextButtonRef,
  });

  // ---- SESSION RECOVERY ----
  const userId = user?.id;
  const { saveState, clearSavedState, shouldRestore, savedState } = useQuizSessionRecovery({
    userId,
    sessionSettings,
    initialQueue,
    onRestore: (restored) => {
      // Restore queue and other state
      if (restored.queue && restored.queue.length > 0) {
        setQueue(restored.queue);
        setParentQueue(restored.queue);
      }
      if (restored.currentQuestionIndex !== undefined && restored.queue) {
        const idx = restored.currentQuestionIndex;
        if (idx >= 0 && idx < restored.queue.length) {
          setCurrentQuestion(restored.queue[idx] ?? null);
        }
      }
      if (restored.selectedAnswerIndex !== undefined) setSelectedAnswerIndex(restored.selectedAnswerIndex);
      if (restored.isAnswered !== undefined) setIsAnswered(restored.isAnswered);
      if (restored.questionNumber !== undefined) setQuestionNumber(restored.questionNumber);
      if (restored.eliminatedAnswers) setEliminatedAnswers(new Set(restored.eliminatedAnswers));
      if (restored.localNote !== undefined) setLocalNote(restored.localNote);
      if (restored.answerChangeCount !== undefined) setAnswerChangeCount(restored.answerChangeCount);
      if (restored.firstSelectedAnswer !== undefined) setFirstSelectedAnswer(restored.firstSelectedAnswer);
      // Finding 4 fix: restore running session score so displays aren't zeroed
      if (restored.sessionScore) {
        recoveredSessionScoreRef.current = restored.sessionScore;
      }
    },
  });

  // Debounced save function
  const debouncedSave = useRef(
    debounce((state: Parameters<typeof saveState>[0]) => saveState(state), 1000)
  ).current;

  // Save state whenever essential state changes
  useEffect(() => {
    if (!currentQuestion) return;
    const currentQuestionIndex = queue.findIndex(q => q.id === currentQuestion.id);
    debouncedSave({
      queue,
      currentQuestionIndex,
      selectedAnswerIndex,
      isAnswered,
      questionNumber,
      eliminatedAnswers: Array.from(eliminatedAnswers),
      localNote,
      answerChangeCount: answerChangeCountRef.current,
      firstSelectedAnswer: firstSelectedAnswerRef.current,
      // Finding 4 fix: persist running session score so it survives tab crash/reload
      sessionScore: {
        correct: performanceData.filter((p) => p.isCorrect).length,
        total: performanceData.length,
      },
    });
  }, [
    queue,
    currentQuestion,
    selectedAnswerIndex,
    isAnswered,
    questionNumber,
    eliminatedAnswers,
    localNote,
    performanceData,
    debouncedSave,
  ]);

  // Clear saved state when session ends
  useEffect(() => {
    if (showSessionEndSummary) {
      clearSavedState();
    }
  }, [showSessionEndSummary, clearSavedState]);

  // Flush session state immediately on tab close to prevent data loss in the debounce window
  const sessionStateRef = useRef({
    currentQuestion,
    queue,
    selectedAnswerIndex,
    isAnswered,
    questionNumber,
    eliminatedAnswers,
    localNote,
    sessionScore: {
      correct: performanceData.filter((p) => p.isCorrect).length,
      total: performanceData.length,
    },
  });
  useEffect(() => {
    sessionStateRef.current = {
      currentQuestion,
      queue,
      selectedAnswerIndex,
      isAnswered,
      questionNumber,
      eliminatedAnswers,
      localNote,
      sessionScore: {
        correct: performanceData.filter((p) => p.isCorrect).length,
        total: performanceData.length,
      },
    };
  });
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = sessionStateRef.current;
      if (!s.currentQuestion) return;
      saveState({
        queue: s.queue,
        currentQuestionIndex: s.queue.findIndex(q => q.id === s.currentQuestion!.id),
        selectedAnswerIndex: s.selectedAnswerIndex,
        isAnswered: s.isAnswered,
        questionNumber: s.questionNumber,
        eliminatedAnswers: Array.from(s.eliminatedAnswers),
        localNote: s.localNote,
        answerChangeCount: answerChangeCountRef.current,
        firstSelectedAnswer: firstSelectedAnswerRef.current,
        sessionScore: s.sessionScore,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);

  const noteUpdateTimeout = useRef<number | null>(null);

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

  // Close overflow menu on click outside — moved to QuizToolbar

  // Reset collapsible states when question changes
  useEffect(() => {
    setShowNotes(false);
  }, [currentQuestion?.id]);

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
      } catch (distErr) {
        console.warn('[QuizView] Failed to fetch answer distribution', distErr);
        if (!cancelled) setAnswerDistribution(null);
      }
    };
    const timeoutId = setTimeout(fetchDistribution, 500);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAnswered, currentQuestion?.id, selectedAnswerIndex, getToken]);

  // Keep current question synced with queue[0]
  useEffect(() => {
    setCurrentQuestion(queue[0] ?? null);
  }, [queue]);

  // ---- SHOULD WE REPLENISH ENDLESSLY? ----
  // shouldEndlesslyReplenish is derived inside the useQuizReplenishment hook

  // Sprint 4: Handler to show session end summary before ending
  const handleEndSession = useCallback(() => {
    // Accessibility: announce session completion
    const correctCount = performanceData.filter((p) => p.isCorrect).length;
    const totalCount = performanceData.length;
    const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    announceToScreenReader(
      `Session ended. Score: ${scorePercent} percent. ${correctCount} correct out of ${totalCount}.`,
      'assertive'
    );

    // For finite sessions (review mode), show the session end summary
    if (!shouldEndlesslyReplenish || performanceData.length >= 5) {
      setShowSessionEndSummary(true);
    } else {
      // For continuous sessions with few questions, just end directly
      onEndSession();
    }
  }, [onEndSession, shouldEndlesslyReplenish, performanceData]);

  // ---- EXAM TIMER (extracted to useQuizTimer hook) ----
  const { timeRemainingMs, sessionStartTime } = useQuizTimer({
    timeLimitMs: sessionSettings.timeLimit,
    onTimeUp: handleEndSession,
  });

  // Sprint 4: Handler for stats overlay toggle with keyboard shortcut
  useShortcut('TOGGLE_STATS', () => setShowStatsOverlay((prev) => !prev), { enabled: true });

  // replenishQueue + proactive replenishment effect handled by useQuizReplenishment hook

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    try {
      setIsAnswered(false);
      submittingRef.current = false;
      setIsSubmitting(false);
      setSelectedAnswerIndex(null);
      setShowRationale(false);
      setAlternateRationale(null);
      setShowSocraticTutor(false);
      setAnswerDistribution(null); // Reset peer selection stats for next question
      setIsExplainerLoading(false);
      setQuestionNumber((prev) => prev + 1);
      resetElimination();
      setSrsResult(null); // Reset SRS result for new question
      setQuestionStartTime(Date.now()); // Track time for new question
      answerChangeCountRef.current = 0; // Reset answer change tracking
      firstSelectedAnswerRef.current = null; // Reset first selected answer

      // Reset causal chain state for next question
      causalChainHook.reset();

      // Reset implicit metrics, behavioral tracker, and micro-kinetics for new question
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

        // Finite sessions ONLY: REVIEW / REVIEW FLAGGED - show summary when done
        // For continuous sessions, NEVER auto-end - the proactive replenishment effect handles it
        if (!shouldEndlesslyReplenish && newQueue.length === 0) {
          handleEndSession();
        }

        return newQueue;
      });

      // Accessibility: announce question progress and move focus to question content
      const totalQuestions = queue.length + performanceData.length; // Approximate total
      const currentNum = questionNumber + 1;
      announceToScreenReader(`Question ${currentNum} of ${totalQuestions}`, 'polite');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById('question-container');
          if (el && typeof (el as HTMLElement).focus === 'function') (el as HTMLElement).focus();
        });
      });

      // Note: Replenishment is handled by the proactive effect when queue < LOW_QUEUE_THRESHOLD
    } catch (error) {
      quizLogger.error('Error advancing to next question', { error });
      setError('Failed to load next question. Please try again.');
    }
  }, [
    queue,
    setParentQueue,
    shouldEndlesslyReplenish,
    replenishQueue,
    handleEndSession,
    setError,
    implicitMetrics,
    behavioralTracker,
    microKinetics,
  ]);

  // Initialize from incoming queue once.
  // Deps: only initialQueue (identity changes when a new session starts) and
  // currentQuestion (null → first question). Hook objects (implicitMetrics,
  // behavioralTracker, microKinetics) are now memoized/stable and read via refs
  // inside the effect body, so they don't need to be in the dep array.
  // (Finding 11 fix: previously, unstable hook object refs caused this effect
  // to re-fire on every render, resetting the dwell timer.)
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0] ?? null);
    }
    setLocalNote(initialQueue[0]?.userNote || '');
    resetElimination();

    // Start tracking implicit metrics, behavioral tracker, and micro-kinetics for the first question
    if (initialQueue.length > 0) {
      implicitMetrics.startQuestion();
      microKinetics.reset();
      const q = initialQueue[0];
      behavioralTracker.start(q ? inferQuestionType(questionToInferShape(q)) : 'unknown');
    }
  }, [behavioralTracker, currentQuestion, implicitMetrics, initialQueue, microKinetics, resetElimination]);

  // handleToggleEliminate provided by useQuizKeyboard hook

  // Ref-based guard: synchronous, immune to React batching delays.
  // State-based guards (isAnswered, isSubmitting) can have a window where
  // a second call sneaks through before the state update is committed.
  // (Finding 6 fix: prevents theoretical double-submit from held Enter key.)
  const submittingRef = useRef(false);

  // Keyboard shortcuts
  const handleSubmitAnswer = useCallback(async () => {
    // Guard against submitting without selection or already submitting
    if (selectedAnswerIndex === null || !currentQuestion || isAnswered || isSubmitting) return;
    // Synchronous ref guard — set immediately, before any async work
    if (submittingRef.current) return;
    submittingRef.current = true;

    setIsSubmitting(true);

    setIsAnswered(true);
    microKinetics.onAnswersRevealed();

    // Guard: correctAnswerIndex must be present — DB schema is Int (non-nullable) but TS type allows undefined
    if (currentQuestion.correctAnswerIndex == null) {
      quizLogger.error('Question missing correctAnswerIndex — cannot score answer', {
        id: currentQuestion.id,
      });
      // Surface a user-facing error so the submit click isn't a black hole.
      // Reset the answered state so the user isn't stuck on a frozen rationale panel.
      setError(
        'This question has corrupted scoring data and was skipped. Please flag it and move on.',
      );
      setIsAnswered(false);
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    // Sprint 4: Compute score using extracted utility
    const behavioralPayload = behavioralTracker.finalize();
    const microMetrics = microKinetics.getMetrics();

    const score = computeScore({
      selectedAnswerIndex,
      questionStartTime,
      question: currentQuestion,
      questionNumber,
      behavioralPayload,
      microMetrics: {
        ...microMetrics,
        inputMethod: microKinetics.inputMethod,
      },
      eliminationTimestamps: eliminationTimestampsRef.current,
    });

    const { isCorrect, timeToAnswer, questionId, parTime, telemetryWithPosition } = score;

    // Feed the wellness engine for mid-session diminishing returns detection
    sessionWellness.recordAttempt(isCorrect, timeToAnswer);

    // Sprint 2: queueAnswer removed — drillReviewService is now the single canonical
    // writer for all session types (main, drill, cram, rapid_recall). It handles:
    // QuestionAttempt, UserQuestionSeen, Question stats, Rolling360, FSRS scheduling,
    // ReviewLog, Card, ConfusionPair, and sibling propagation.
    // The old queueAnswer → /api/questions/attempt path remains functional for
    // backward compat with any offline items still in localStorage (24h TTL drain).

    // Persist the answer IMMEDIATELY (before any async operations) so the user
    // can't lose data by navigating away or the tab closing mid-submit.
    if (user?.id && currentQuestion.id) {
      try {
        syncManager.queueReview({
          questionId: currentQuestion.id,
          selectedAnswer: (currentQuestion.options as string[])?.[selectedAnswerIndex] ?? String(selectedAnswerIndex),
          timeSpentMs: timeToAnswer,
          timeToFirstClick: implicitMetrics.metrics.timeToFirstClick ?? undefined,
          answerSwitches: answerChangeCountRef.current,
          totalDwellTime: timeToAnswer,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sessionType:
            sessionSettings.mode === 'rapid_recall'
              ? 'rapid_recall'
              : sessionSettings.mode === 'cram_mode' || sessionSettings.mode === 'cram'
                ? 'cram'
                : 'main',
          telemetry: telemetryWithPosition,
        });
      } catch (err) {
        quizLogger.error('Failed to queue review for offline sync', { error: err });
      }
    }

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
        quizLogger.error('Failed to load clinical pearls', { error });
      }
    }

    // parTime already computed by computeScore()

    // Sprint 4: Record behavioral confidence (auto-inferred, no manual input)
    const behaviorSignals: BehaviorSignals = {
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
      answerChangeCount: answerChangeCountRef.current,
      eliminatedCount: eliminatedAnswers.size,
      quickInitialSelection:
        firstSelectedAnswerRef.current !== null && Date.now() - questionStartTime < parTime * 0.5,
    };

    // Sprint 2: Use consolidated analytics tracking hook
    analyticsTracker.trackAnswer({
      isCorrect,
      timeToAnswer,
      parTime,
      behaviorSignals,
      questionNumber,
      questionId,
      selectedAnswerIndex,
      eliminatedCount: eliminatedAnswers.size,
      answerChangeCount: answerChangeCountRef.current,
      firstAnswer: firstSelectedAnswerRef.current,
      question: currentQuestion as QuestionMeta,
    });

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
      // Store for CalibrationFeedbackBadge in AnswerFeedback
      setLastImplicitConfidence(inferredConfidenceValue);

      // Trigger causal chain generation (tier1 Item 4) — fires async in background
      if (!isExamSimulator && currentQuestion.condition) {
        causalChainHook.generate({
          questionId: questionId,
          questionText: currentQuestion.question || '',
          correctAnswer: currentQuestion.options[currentQuestion.correctAnswerIndex] ?? '',
          condition: currentQuestion.condition,
          studentAnswer: !isCorrect
            ? currentQuestion.options[selectedAnswerIndex] ?? undefined
            : undefined,
          system: currentQuestion.system ?? undefined,
        });
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
      quizLogger.warn('updatePerformancePrediction failed', { error: e });
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
      quizLogger.warn('recordPauseResult failed', { error: e });
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
      quizLogger.warn('recordQuestionResult failed', { error: e });
    }

    setBehavioralRefreshKey((k) => k + 1);

    // Trigger sensory feedback (haptic + optional sound)
    if (isCorrect) {
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      // Sprint 2: Enhanced haptic celebrations for streaks
      if (newStreak >= 10) {
        enhancedHaptics.streak(newStreak);
      } else if (newStreak >= 5) {
        enhancedHaptics.streak(newStreak);
      } else if (newStreak >= 3) {
        feedback.streak();
      } else {
        feedback.correct();
      }
    } else {
      feedback.incorrect();
      setCurrentStreak(0);
    }

    // recordQuestion + recordCircadianPerformance now handled by analyticsTracker.trackAnswer()

    if (sessionSettings.focus === 'review') {
      updateReviewQuestion(currentQuestion, isCorrect);
      if (isCorrect && currentQuestion.dueConceptKey && removeDueConcept) {
        removeDueConcept(
          currentQuestion.dueConceptKey.conditionId,
          currentQuestion.dueConceptKey.taskType
        );
      }
    } else {
      if (!isCorrect) {
        addMissedQuestion(currentQuestion);
      }
    }

    // Calculate question word count for vignette stamina analysis
    const questionWordCount = currentQuestion.question
      .replace(STRIP_HTML_TAGS_REGEX, ' ') // Remove HTML tags
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

    // Track answer in session analytics (local state for session summary)
    recordSessionAnswer(
      currentQuestion.id || `temp-${questionNumber}`,
      isCorrect,
      currentQuestion.system || 'Unknown',
      timeToAnswer
    );

    // Sprint 3: Wellness check (delegated to hook)
    wellness.checkAfterAnswer();

    // Clear submitting state (both ref and state)
    submittingRef.current = false;
    setIsSubmitting(false);
  }, [
    selectedAnswerIndex,
    currentQuestion,
    isAnswered,
    isSubmitting,
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
    eliminatedAnswers,
    questionNumber,
    implicitMetrics,
  ]);

  // Keep the ref current so the keyboard hook's onSubmitAnswer always calls the latest version
  handleSubmitAnswerRef.current = handleSubmitAnswer;

  // Keyboard shortcuts (FLIP_CARD, NEXT_QUESTION, A/B/C/D, Shift+A/B/C/D, Enter, Escape)
  // are now handled by the useQuizKeyboard hook above.

  const handleOptionClick = useCallback((index: number) => {
    // Guard against selecting eliminated answers or already answered questions
    if (isAnswered || !currentQuestion || eliminatedAnswers.has(index)) return;

    microKinetics.recordSelection();

    // Track answer changes
    if (firstSelectedAnswerRef.current === null) {
      firstSelectedAnswerRef.current = index;
      behavioralTracker.recordFirstInteraction();
    } else if (selectedAnswerIndex !== null && selectedAnswerIndex !== index) {
      answerChangeCountRef.current += 1;
      behavioralTracker.recordAnswerChange();
    }

    implicitMetrics.recordAnswerSelection(index);

    // Just select the option, don't submit yet
    setSelectedAnswerIndex(index);
  }, [isAnswered, currentQuestion, eliminatedAnswers, microKinetics, selectedAnswerIndex, behavioralTracker, implicitMetrics]);

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

      // Use Edge streaming API (/api/ai/chat/stream) so user sees tokens immediately (latency masking)
      const { callGeminiTextStreaming } = await import('@/services/ai/geminiService');

      try {
        await callGeminiTextStreaming('gemini-2.5-flash', prompt, 0.7, {
          getToken,
          systemInstruction:
            'You are a clinical educator for PA students. Be concise (3-4 sentences), use a different angle than the original explanation, and focus on why the mistake was made.',
          onChunk: (chunk) => setAlternateRationale((prev) => prev + chunk),
          onComplete: () => setIsExplainerLoading(false),
          onError: () => setIsExplainerLoading(false),
        });
        setIsExplainerLoading(false);
      } catch (err) {
        quizLogger.error('Error generating alternate rationale', { error: err });
        setAlternateRationale(
          "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
        );
        setIsExplainerLoading(false);
      }
    } catch (err) {
      // User-friendly error message instead of technical details
      quizLogger.error('Error generating alternate rationale', { error: err });
      setAlternateRationale(
        "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
      );
      setIsExplainerLoading(false);
    }
  }, [currentQuestion, selectedAnswerIndex]);

  const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  }, [currentQuestion, updateQuestionNote, noteUpdateTimeout, setLocalNote]);

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    if (isFlagged) {
      removeFlaggedQuestion(currentQuestion);
    } else {
      addFlaggedQuestion(currentQuestion);
    }
  }, [currentQuestion, isFlagged, removeFlaggedQuestion, addFlaggedQuestion]);

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

  const parTimeMs = useMemo(() =>
    currentQuestion ? calculateParTime(currentQuestion) : null,
    [currentQuestion]
  );

  // Focus the question container when a new question loads
  useEffect(() => {
    if (!currentQuestion) return undefined;

    // Small delay to let AnimatePresence finish its transition
    const timer = setTimeout(() => {
      const questionEl = document.getElementById('question-container');
      questionEl?.focus();
    }, 350);

    return () => clearTimeout(timer);
  }, [currentQuestion?.id, questionNumber]);

  // Announce correctness result to screen readers when answer is submitted
  useEffect(() => {
    if (!currentQuestion || !isAnswered || selectedAnswerIndex === null) return;

    const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
    const correctOption = ['A', 'B', 'C', 'D', 'E'][currentQuestion.correctAnswerIndex] ?? '';
    const message = isCorrect
      ? 'Correct!'
      : `Incorrect. The correct answer is ${correctOption}: ${currentQuestion.options[currentQuestion.correctAnswerIndex]}.`;

    announceToScreenReader(message, 'assertive');
  }, [currentQuestion, isAnswered, selectedAnswerIndex]);

  // NO CURRENT QUESTION - Show appropriate screen based on context
  if (!currentQuestion) {
    // In continuous mode, show loading while waiting for questions
    if (shouldEndlesslyReplenish) {
      // If we've already exceeded max attempts, show error
      if (replenishmentError || replenishAttempts >= 3) {
        // Determine the error type based on session settings
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
            <p className="text-[var(--color-text-secondary)] max-w-md">
              {errorMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
              <button type="button" onClick={onShowMenu} className="btn-glass px-6 py-2">
                {isDueMode || isVariantMode ? 'Back to Practice' : 'Back to Dashboard'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isDueMode || isVariantMode) {
                    onShowMenu();
                  } else {
                    void retryReplenishment();
                  }
                }}
                className="btn-secondary px-6 py-2"
              >
                {secondaryActionLabel}
              </button>
            </div>
          </div>
        );
      }
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
        <h2 className="text-2xl font-semibold mb-2">Session Complete</h2>
        <p className="text-[var(--color-text-secondary)]">
          You've reached the end of this set of questions.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
          <button type="button" onClick={onShowMenu} className="btn-glass px-6 py-2">
            Back to Dashboard
          </button>
          <button type="button" onClick={handleEndSession} className="btn-secondary px-6 py-2">
            View Summary
          </button>
        </div>
      </div>
    );
  }

  // Note: Swipe gestures are available via swipeContainerRef
  // Apply to main quiz container if needed (currently disabled to avoid conflicts with text selection)

  return (
    <div
      className={`flex flex-col ${isExamSimulator ? 'exam-simulator-high-contrast' : ''}`}
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,26,1) 0%, rgba(15,23,42,0.5) 50%, rgba(10,14,26,1) 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Skip link — keyboard users can jump past toolbar to question content */}
      <a
        href="#question-container"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-accent)] focus:rounded-md"
      >
        Skip to question
      </a>
      <header role="banner" aria-label="Quiz session toolbar">
      <QuizToolbar
        questionNumber={questionNumber}
        isFullSitDownTest={isFullSitDownTest}
        totalQuestions={totalQuestions}
        modeLabel={modeLabel}
        behavioralRefreshKey={behavioralRefreshKey}
        currentStreak={currentStreak}
        questionStartTime={questionStartTime}
        parTimeMs={parTimeMs}
        isAnswered={isAnswered}
        showTimerVisible={showTimerVisible}
        isCommuterMode={!!commuter?.isCommuterMode}
        timeRemainingMs={timeRemainingMs}
        showStatsOverlay={showStatsOverlay}
        onToggleStatsOverlay={() => setShowStatsOverlay((prev) => !prev)}
        isFlagged={isFlagged}
        onToggleFlag={toggleFlag}
        showNormalLabsPanel={showNormalLabsPanel}
        onToggleNormalLabs={() => setShowNormalLabsPanel((prev) => !prev)}
        onShowReportModal={() => setShowReportModal(true)}
        onShowLabCalcModal={() => setShowLabCalcModal(true)}
        fontSizeAdjustment={fontSizeAdjustment}
        setFontSizeAdjustment={setFontSizeAdjustment}
        onEndSession={handleEndSession}
        replenishmentError={replenishmentError}
        onRetryReplenish={() => {
          void retryReplenishment();
        }}
        currentQuestion={currentQuestion}
      />
      </header>
      <main id="main-content" role="main" aria-label="Quiz question and answers">
      <SplitPaneDrillLayout
          vignette={useSplitPane ? currentQuestion.vignette : null}
          className="mb-6"
        >
          <div ref={microKinetics.registerMouseTrackingContainer}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id ?? `${currentQuestion.question}-${questionNumber}`}
                initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
                  <div
                    className="mb-5 rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                    }}
                  >
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
            <div
              className="space-y-3 mt-6"
              role="radiogroup"
              aria-label={`Answer options for question ${questionNumber}`}
            >
              {(currentQuestion.options || []).map((option, index) => {
                const isCorrect = index === currentQuestion.correctAnswerIndex;
                const isSelected = index === selectedAnswerIndex;
                const optionLabel = ['A', 'B', 'C', 'D', 'E'][index] ?? 'A';

                return (
                  <OptionHoverTracker
                    key={`${currentQuestion.id}-${index}`}
                    optionIndex={index}
                    optionLabel={optionLabel}
                    className="block"
                    onHoverEnter={microKinetics.recordOptionInteraction}
                  >
                    <AnswerChoice
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
                  </OptionHoverTracker>
                );
              })}
            </div>
          </div>

          {/* SUBMIT BUTTON - Sticky on mobile with glass effect */}
          {!isAnswered && selectedAnswerIndex !== null && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="sticky bottom-0 z-10 mt-6 -mx-4 px-4 py-4 text-center space-y-2 md:static md:bg-transparent md:backdrop-blur-0 md:mx-0 md:px-0 md:py-0 md:mt-6 md:space-y-4"
              style={{
                background: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)',
                backdropFilter: 'blur(12px) saturate(1.2)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
              }}
            >
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={isSubmitting}
                className="btn-cinematic px-10 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto min-h-[48px] text-body font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <InlineSpinner size="md" />
                    <span role="status" aria-live="polite">Submitting...</span>
                  </>
                ) : (
                  'Submit Answer'
                )}
              </button>
              <p className="mt-2 text-caption text-[var(--color-text-muted)] hidden md:block">
                Press{' '}
                <kbd className="px-2 py-1 bg-[var(--color-bg-secondary)] rounded-lg text-caption font-mono"
                  style={{ boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
                >
                  Enter
                </kbd>{' '}
                to submit
              </p>
            </motion.div>
          )}

          {/* FEEDBACK / RATIONALE */}
          {isAnswered && selectedAnswerIndex !== null && (
            <AnswerFeedback
              currentQuestion={currentQuestion}
              selectedAnswerIndex={selectedAnswerIndex}
              isExamSimulator={isExamSimulator}
              fontSizeAdjustment={fontSizeAdjustment}
              topicStats={topicStats}
              answerDistribution={answerDistribution}
              updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
              onExplainDifferently={handleExplainDifferently}
              isExplainerLoading={isExplainerLoading}
              alternateRationale={alternateRationale}
              onShowSocraticTutor={() => setShowSocraticTutor(true)}
              localNote={localNote}
              showNotes={showNotes}
              setShowNotes={setShowNotes}
              onNoteChange={handleNoteChange}
              implicitConfidence={lastImplicitConfidence}
              causalChain={causalChainHook.chain}
              causalChainDisplayLevel={
                lastImplicitConfidence !== undefined
                  ? expertiseToDisplayLevel(lastImplicitConfidence)
                  : 'collapsed'
              }
            />
          )}

          {/* Proactive fatigue break prompt — inline between feedback and Next button */}
          {isAnswered && (
            <Suspense fallback={null}>
            <FatigueBreakPrompt
              fatigue={sessionWellness.fatigue}
              dismissed={sessionWellness.breakDismissed}
              onTakeBreak={(minutes) => sessionWellness.startBreak(minutes)}
              onDismiss={sessionWellness.dismissBreak}
              hardStopVisible={sessionWellness.check.shouldStop && !sessionWellness.dismissed}
            />
            </Suspense>
          )}

          {isAnswered && !sessionWellness.onBreak && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="sticky bottom-0 z-10 mt-4 -mx-4 px-4 py-4 text-center md:static md:bg-transparent md:backdrop-blur-0 md:mx-0 md:px-0 md:py-0 md:mt-5"
              style={{
                background: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)',
                backdropFilter: 'blur(12px) saturate(1.2)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
              }}
            >
              <button
                ref={nextButtonRef}
                onClick={() => {
                  try {
                    showNextQuestion();
                  } catch (error) {
                    quizLogger.error('Error in Next Question button click', { error });
                    setError('Failed to proceed to next question. Please refresh the page.');
                  }
                }}
                className="btn-cinematic px-10 py-3.5 font-semibold min-h-[48px] text-body"
              >
                Next Question
              </button>
            </motion.div>
          )}
      </SplitPaneDrillLayout>
      </main>

      {/* Session stats available via S shortcut (SessionStatsOverlay) - no cluttering popups */}

      {/* Wellness Check Modal */}
      <Suspense fallback={null}>
      <WellnessCheckModal
        isOpen={wellness.showModal}
        onClose={() => wellness.dismiss()}
        reason={wellness.reason}
      />
      </Suspense>

      {/* Session Pacer — diminishing returns detection (non-blocking) */}
      <SessionPacer
        check={sessionWellness.check}
        dismissed={sessionWellness.dismissed}
        onDismiss={sessionWellness.dismiss}
        onEndSession={() => setShowSessionEndSummary(true)}
      />

      {/* Break Timer — full-screen timed break overlay */}
      <Suspense fallback={null}>
      <BreakTimer
        isActive={sessionWellness.onBreak}
        secondsLeft={sessionWellness.breakSecondsLeft}
        totalSeconds={sessionWellness.fatigue.suggestedBreakMinutes * 60 || 300}
        onReturn={sessionWellness.endBreak}
        questionsAnswered={sessionWellness.check.stats.questionsAnswered}
        accuracy={sessionWellness.check.stats.accuracy}
      />
      </Suspense>

      {/* Lab calculators modal – Anion Gap, Osmolar Gap, Parkland (in-question Calc button) */}
      {showLabCalcModal && <Suspense fallback={null}><QuizLabCalcModal onClose={() => setShowLabCalcModal(false)} /></Suspense>}

      {/* Normal Labs reference panel (slide-out from right) */}
      <NormalLabsPanel
        isOpen={showNormalLabsPanel}
        onClose={() => setShowNormalLabsPanel(false)}
      />

      {/* Report Question Issue Modal */}
      {currentQuestion && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Sprint 4: Session Stats Overlay */}
      <SessionStatsOverlay
        isVisible={showStatsOverlay}
        onToggle={() => setShowStatsOverlay((prev) => !prev)}
        performanceData={performanceData.map((p) => ({ topic: p.topic, correct: p.isCorrect }))}
        currentQuestionNumber={questionNumber}
      />

      {/* Sprint 4: Session End Summary */}
      <Suspense fallback={null}>
      <SessionEndSummary
        isOpen={showSessionEndSummary}
        celebrateStreak={performanceData.length >= 10}
        onClose={() => {
          setShowSessionEndSummary(false);
          resetSessionDistribution();
          resetPrediction();
          resetPauseTracking();
          onEndSession();
        }}
        performanceData={performanceData}
        sessionSummary={getSessionSummary()}
        sessionDurationMs={Date.now() - sessionStartTime.current}
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
        onReviewMissed={
          onReviewMissed
            ? () => {
                setShowSessionEndSummary(false);
                onReviewMissed();
              }
            : undefined
        }
      />
      </Suspense>

      {/* Socratic Tutor: Tutor Me for incorrect answers */}
      <AnimatePresence>
        {showSocraticTutor &&
          currentQuestion &&
          selectedAnswerIndex !== null &&
          selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
            <Suspense fallback={null}>
            <SocraticTutorChat
              vignette={currentQuestion.vignette || ''}
              question={currentQuestion.question}
              correctAnswer={
                (currentQuestion.options as string[])?.[currentQuestion.correctAnswerIndex] ?? ''
              }
              userWrongAnswer={(currentQuestion.options as string[])?.[selectedAnswerIndex] ?? ''}
              options={currentQuestion.options as string[]}
              fullExplanation={(() => {
                const stripHtml = (s: string) =>
                  s
                    .replace(STRIP_HTML_TAGS_REGEX, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const r = currentQuestion.rationale;
                if (typeof r === 'object' && r !== null && 'bottomLine' in r) {
                  const s = r as { bottomLine?: string; whyCorrect?: string };
                  return (
                    [s.bottomLine, s.whyCorrect]
                      .filter((x): x is string => typeof x === 'string')
                      .map(stripHtml)
                      .join(' ') || 'See rationale above.'
                  );
                }
                return stripHtml(typeof r === 'string' ? r : '') || 'See rationale above.';
              })()}
              onClose={() => setShowSocraticTutor(false)}
            />
            </Suspense>
          )}
      </AnimatePresence>
    </div>
  );
};

export { QuizView };
export default QuizView;
