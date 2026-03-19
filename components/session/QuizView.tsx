// components/QuizView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcut } from '@/contexts/ShortcutContext';
import { useUser } from '@clerk/clerk-react';
import { useCommuter } from '@/contexts/CommuterContext';
import { announceToScreenReader } from '@/lib/utils/accessibilityUtils';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { enhancedHaptics } from '@/lib/enhancedHaptics';
import { useQuizSessionRecovery } from '@/hooks/useQuizSessionRecovery';
import { debounce } from '@/lib/utils/debounce';

// Core services - using client-safe API wrappers
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
import { recordCircadianPerformance } from '@/services/analytics';
import { updatePerformancePrediction, resetPrediction } from '@/services/analytics';

// Domain services
import { recordQuestion, getSessionSummary, resetSessionDistribution } from '@/services/domain';

// AI services
import { generateAlternateRationale } from '@/services/ai';

// Components
import { FlagQuestionModal } from '@/components/modals/FlagQuestionModal';
import AnswerChoice from '@/components/quiz/AnswerChoice';
import {
  useBehavioralTracker,
  OptionHoverTracker,
  behavioralPayloadToTelemetryData,
} from '@/components/quiz/Tracker';
import { useMicroKinetics } from '@/hooks/useMicroKinetics';
import { useFatigueTracking } from '@/hooks/useFatigueTracking';
import { QuizLabCalcModal } from '@/components/quiz/QuizLabCalcModal';
import ErrorTagger from '@/components/quiz/ErrorTagger';
import { Loader, ClinicalSkeleton, DrillLoadingState } from '@/components/loading';
import WellnessCheckModal from '@/components/wellness/WellnessCheckModal';

// Sprint 4: Enhanced session components (streamlined - removed janky popups)
import {
  SessionStatsOverlay,
  SessionEndSummary,
  SocraticTutorChat,
  QuestionTimer,
  MomentumBadge,
  StreakBadge,
} from '@/components/quiz';
import { sanitizeForRationale } from '@/lib/sanitizeHtml';
import { getAccuracyBarClass } from '@/lib/accuracyColorUtils';

// Sprint 10: Trust badges for question source indication
import { TrustBadge } from '@/components/ui/TrustBadge';
import { Progress } from '@/components/ui/progress';
import { OpenStaxAttributionFooter } from '@/components/ui/OpenStaxAttributionFooter';
import { SplitPaneDrillLayout } from '@/components/drill/SplitPaneDrillLayout';
import { NormalLabsPanel } from '@/components/session/NormalLabsPanel';

// Icons
import { CloseIcon } from '@/components/icons/CloseIcon';
import { FlagIcon } from '@/components/icons/FlagIcon';
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Calculator,
  MessageCircle,
  Clock,
  MoreHorizontal,
  ChevronDown,
  PenLine,
} from 'lucide-react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';
import { ClearHighlightIcon } from '@/components/icons/ClearHighlightIcon';

// Types
import type { Question, PerformanceRecord, SessionSettings, ErrorTag } from '@/types';
import type { SRSScheduleResult } from '@/lib/services/srsService';
import ExplanationPanel from '@/components/questions/ExplanationPanel';

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
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { useImplicitMetrics } from '@/hooks/useImplicitMetrics';
import { inferQuestionType } from '@/hooks/useTelemetryCollector';

// Other services (non-barrel)
import { feedback } from '@/services/core/feedbackService';
import { syncManager } from '@/lib/services/sync/syncManager';
import { deriveFsrsRating, deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { logger } from '@/src/lib/logger';

/** Regex to strip HTML tags (defined outside JSX to avoid TS1382 parse errors) */
const STRIP_HTML_TAGS_REGEX = /<[^>]*>/g;
/** Regex to match <br> and <br/> for normalizing line breaks */
const BR_TAG_REGEX = /<br\s*\/?>/gi;

const LOG_SCOPE = 'QuizView';

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
      } catch {
        // Highlighting failed - clear selection
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
        className="text-xl md:text-2xl leading-relaxed text-text-primary bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm space-y-4"
        style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
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
        className="text-xl md:text-2xl font-semibold text-text-primary whitespace-pre-wrap bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
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
      tabIndex={-1}
      className="text-xl md:text-2xl leading-relaxed text-text-primary bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
      style={{ fontSize: `calc(1em + var(--font-size-adj))` }}
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
        logger.error(
          LOG_SCOPE,
          `Required callback prop "${name}" is not a function`,
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
  const behavioralTracker = useBehavioralTracker();
  const microKinetics = useMicroKinetics();
  const fatigueTracking = useFatigueTracking(isExamSimulator);

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [localNote, setLocalNote] = useState<string>('');

  // Track eliminated answers (by index) for the current question
  const [eliminatedAnswers, setEliminatedAnswers] = useState<Set<number>>(new Set());
  const eliminationTimestampsRef = useRef<number[]>([]);

  // Track answer changes for analytics (using refs to avoid re-renders)
  const answerChangeCountRef = useRef<number>(0);
  const firstSelectedAnswerRef = useRef<number | null>(null);
  // Setters for session recovery (update refs without causing re-renders)
  const setAnswerChangeCount = (value: number) => { answerChangeCountRef.current = value; };
  const setFirstSelectedAnswer = (value: number | null) => { firstSelectedAnswerRef.current = value; };

  // Track if we're actively generating a question in the background
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);

  // Track replenishment attempts to prevent infinite loops
  const [replenishAttempts, setReplenishAttempts] = useState(0);
  const MAX_REPLENISH_ATTEMPTS = 3;

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
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const commuter = useCommuter();
  const showTimerVisible = showTimer && !commuter?.isCommuterMode;
  // Auto‑read question aloud when commuter mode is active
  useEffect(() => {
    if (!commuter?.isCommuterMode || !commuter.settings.autoReadQuestions || !currentQuestion) return;
    // Build readable text from question vignette and stem
    const vignette = currentQuestion.vignette ? currentQuestion.vignette + ' ' : '';
    const stem = currentQuestion.stem || '';
    const text = vignette + stem;
    if (text.trim()) {
      commuter.speak(text);
      // Start listening for voice answers after a short delay
      setTimeout(() => {
        if (commuter.settings.voiceEnabled) {
          commuter.startListening();
        }
      }, 2000);
    }
  }, [commuter, currentQuestion]);
  const [behavioralRefreshKey, setBehavioralRefreshKey] = useState(0);
  const [replenishmentError, setReplenishmentError] = useState<string | null>(null);

  // Fix #6a: Overflow menu for secondary header actions
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  // Fix #6b: Collapsible detailed explanation
  // Fix #6c: Notes textarea toggle
  const [showNotes, setShowNotes] = useState(false);
  // Normal Labs reference panel (slide-out from right)
  const [showNormalLabsPanel, setShowNormalLabsPanel] = useState(false);

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
          setCurrentQuestion(restored.queue[idx]);
        }
      }
      if (restored.selectedAnswerIndex !== undefined) setSelectedAnswerIndex(restored.selectedAnswerIndex);
      if (restored.isAnswered !== undefined) setIsAnswered(restored.isAnswered);
      if (restored.questionNumber !== undefined) setQuestionNumber(restored.questionNumber);
      if (restored.eliminatedAnswers) setEliminatedAnswers(new Set(restored.eliminatedAnswers));
      if (restored.localNote !== undefined) setLocalNote(restored.localNote);
      if (restored.answerChangeCount !== undefined) setAnswerChangeCount(restored.answerChangeCount);
      if (restored.firstSelectedAnswer !== undefined) setFirstSelectedAnswer(restored.firstSelectedAnswer);
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
    });
  }, [
    queue,
    currentQuestion,
    selectedAnswerIndex,
    isAnswered,
    questionNumber,
    eliminatedAnswers,
    localNote,
    answerChangeCountRef.current,
    firstSelectedAnswerRef.current,
    debouncedSave,
  ]);

  // Clear saved state when session ends
  useEffect(() => {
    if (showSessionEndSummary) {
      clearSavedState();
    }
  }, [showSessionEndSummary, clearSavedState]);

  const noteUpdateTimeout = useRef<number | null>(null);
  const optionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

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

  // Close overflow menu on click outside
  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverflowMenu]);

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
      } catch {
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
    setCurrentQuestion(queue[0] || null);
  }, [queue]);

  // ---- SHOULD WE REPLENISH ENDLESSLY? ----
  // 'review' and 'reviewFlagged' are finite (show specific questions)
  // 'due' is continuous - generates variant questions for concepts needing SRS review
  const shouldEndlesslyReplenish =
    sessionSettings.focus !== 'review' && sessionSettings.focus !== 'reviewFlagged';

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

  // Quick Wins: Time limit checking (auto-end session at limit)
  useEffect(() => {
    if (!sessionSettings.timeLimit) {
      setTimeRemainingMs(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime.current;
      const remaining = sessionSettings.timeLimit! - elapsed;

      if (remaining <= 0) {
        // Time's up - end session
        clearInterval(interval);
        setTimeRemainingMs(0);
        handleEndSession();
      } else {
        setTimeRemainingMs(remaining);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [sessionSettings.timeLimit, handleEndSession]);

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
    setReplenishmentError(null);
    // If we've already exceeded max attempts, don't try again
    if (replenishAttempts >= MAX_REPLENISH_ATTEMPTS) {
      setReplenishmentError('Unable to load questions after several attempts. Please try again later.');
      setIsGeneratingQuestion(false);
      return;
    }
    // Increment attempt counter
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
        // Fallback: fetch questions one at a time
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
        // Keep both queues in sync with batch update
        setParentQueue((prev) => [...prev, ...newQuestions]);
        setQueue((prev) => [...prev, ...newQuestions]);
        // Replenished questions successfully
        setReplenishAttempts(0);
      } else {
        logger.warn(LOG_SCOPE, 'No questions returned from batch fetch');
      }
    } catch (err: unknown) {
      logger.error(LOG_SCOPE, 'Failed to replenish queue', err);
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
      // Queue low - triggering replenishment
      void replenishQueue();
    }
  }, [queue.length, shouldEndlesslyReplenish, isGeneratingQuestion, replenishQueue]);

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    try {
      setIsAnswered(false);
      setIsSubmitting(false);
      setSelectedAnswerIndex(null);
      setShowRationale(false);
      setAlternateRationale(null);
      setShowSocraticTutor(false);
      setAnswerDistribution(null); // Reset peer selection stats for next question
      setIsExplainerLoading(false);
      setQuestionNumber((prev) => prev + 1);
      setEliminatedAnswers(new Set());
      eliminationTimestampsRef.current = [];
      setSrsResult(null); // Reset SRS result for new question
      setQuestionStartTime(Date.now()); // Track time for new question
      answerChangeCountRef.current = 0; // Reset answer change tracking
      firstSelectedAnswerRef.current = null; // Reset first selected answer

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
      logger.error(LOG_SCOPE, 'Error advancing to next question', error);
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

  // Initialize from incoming queue once
  useEffect(() => {
    if (!currentQuestion && initialQueue.length > 0) {
      setCurrentQuestion(initialQueue[0] ?? null);
    }
    setLocalNote(initialQueue[0]?.userNote || '');
    setEliminatedAnswers(new Set());
    eliminationTimestampsRef.current = [];

    // Start tracking implicit metrics, behavioral tracker, and micro-kinetics for the first question
    if (initialQueue.length > 0) {
      implicitMetrics.startQuestion();
      microKinetics.reset();
      const q = initialQueue[0];
      behavioralTracker.start(q ? inferQuestionType(questionToInferShape(q)) : 'unknown');
    }
  }, [initialQueue, currentQuestion, implicitMetrics, behavioralTracker, microKinetics]);

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
          eliminationTimestampsRef.current.push(Date.now());
        }
        return next;
      });
    },
    [isAnswered]
  );

  // Keyboard shortcuts
  const handleSubmitAnswer = useCallback(async () => {
    // Guard against submitting without selection or already submitting
    if (selectedAnswerIndex === null || !currentQuestion || isAnswered || isSubmitting) return;

    setIsSubmitting(true);

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
      logger.error(
        LOG_SCOPE,
        'CRITICAL: Undefined functions detected in handleSubmitAnswer',
        undefinedFunctions
      );
    }

    setIsAnswered(true);
    microKinetics.onAnswersRevealed();

    // Sprint 4: Calculate correctness IMMEDIATELY
    const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
    const timeToAnswer = Date.now() - questionStartTime;
    const questionId = currentQuestion.id || `temp-${questionNumber}`;

    const behavioralPayload = behavioralTracker.finalize();
    const microMetrics = microKinetics.getMetrics();
    const elimTimestamps = eliminationTimestampsRef.current;
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
            },
            eliminationVelocity
          )
        : undefined;

    // Derive FSRS rating from behavioral signals — fully implicit, no self-rating buttons.
    // When behavioral data is available, use the full pipeline (deriveContinuousRating +
    // Ghost Grader) that matches the server-side computation in drillReviewService.
    // Falls back to binary correct/incorrect only if the tracker was inactive.
    const parTimeForRating = calculateParTime(currentQuestion);
    const fsrsRating = behavioralPayload
      ? deriveFsrsRatingFromBehavior({
          isCorrect,
          timeToFirstClickMs: behavioralPayload.time_to_first_interaction_ms,
          totalDwellTimeMs: behavioralPayload.duration_ms,
          parTimeMs: parTimeForRating,
          answerSwitches: behavioralPayload.answer_change_count,
          cursorEntropy: microMetrics.cursorEntropy,
          hoverOscillations: microMetrics.oscillations,
          vignetteRegressions: microMetrics.vignetteRegressions,
          selectionDriftMs: microMetrics.selectionDriftMs,
          tremorScore: microMetrics.tremorScore,
        })
      : deriveFsrsRating(isCorrect, timeToAnswer);

    syncManager.queueAnswer({
      questionId,
      selectedAnswer: selectedAnswerIndex,
      isCorrect,
      timeSpentMs: timeToAnswer,
      system: currentQuestion.system ?? undefined,
      conditionId: currentQuestion.conditionId ?? undefined,
      isMainSession: sessionSettings.mode !== 'rapid_recall' && sessionSettings.mode !== 'cram_mode',
      rating: fsrsRating,
      telemetryJson: (telemetryForApi ?? undefined) as Record<string, unknown> | undefined,
      answerChangedCount: behavioralPayload?.answer_change_count ?? answerChangeCountRef.current,
      durationMs: behavioralPayload?.duration_ms ?? timeToAnswer,
    });
    // Fire-and-forget: metrics and review sync in background (or when back online).
    void implicitMetrics.submitAnswer(questionId, isCorrect, 'multiple_choice').catch((err) => {
      logger.warn(LOG_SCOPE, 'Implicit metrics submission failed (will retry when online)', err);
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
        logger.error(LOG_SCOPE, 'Failed to load clinical pearls', error);
      }
    }

    // Sprint 4: Calculate par time (isCorrect and timeToAnswer already calculated above for instant feedback)
    const parTime = calculateParTime(currentQuestion);

    // Sprint 4: Record behavioral confidence (auto-inferred, no manual input)
    const behaviorSignals: BehaviorSignals = {
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
      answerChangeCount: answerChangeCountRef.current,
      eliminatedCount: eliminatedAnswers.size,
      quickInitialSelection:
        firstSelectedAnswerRef.current !== null && Date.now() - questionStartTime < parTime * 0.5,
    };

    // Defensive calls - wrap analytics functions to prevent crashes
    try {
      if (typeof recordBehavioralConfidence === 'function') {
        recordBehavioralConfidence(behaviorSignals, isCorrect);
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordBehavioralConfidence failed', e);
    }

    // Sprint 4: Record momentum data
    try {
      if (typeof recordMomentumResult === 'function') {
        recordMomentumResult(isCorrect, timeToAnswer, parTime);
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordMomentumResult failed', e);
    }

    // Sprint 4: Record answer pattern for post-session analysis
    try {
      if (typeof recordAnswerPattern === 'function') {
        recordAnswerPattern({
          questionId: currentQuestion.id || `temp-${questionNumber}`,
          firstAnswer: firstSelectedAnswerRef.current ?? selectedAnswerIndex,
          finalAnswer: selectedAnswerIndex,
          correctAnswer: currentQuestion.correctAnswerIndex,
          timeSpentMs: timeToAnswer,
          parTimeMs: parTime,
          eliminatedCount: eliminatedAnswers.size,
          answerChangeCount: answerChangeCountRef.current,
          wasCorrect: isCorrect,
        });
      }
    } catch (e) {
      logger.warn(LOG_SCOPE, 'recordAnswerPattern failed', e);
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
      logger.warn(LOG_SCOPE, 'updatePerformancePrediction failed', e);
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
      logger.warn(LOG_SCOPE, 'recordPauseResult failed', e);
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
      logger.warn(LOG_SCOPE, 'recordQuestionResult failed', e);
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

    // Sprint 4: Record question for PANCE distribution tracking
    if (currentQuestion.system) {
      recordQuestion(currentQuestion.system, undefined);
    }

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

    // Queue review for offline sync (batch submission)
    if (user?.id && currentQuestion.id) {
      try {
        syncManager.queueReview({
          questionId: currentQuestion.id,
          selectedAnswer: selectedAnswerIndex,
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
          telemetry: telemetryForApi,
        });
      } catch (err) {
        logger.error(LOG_SCOPE, 'Failed to queue review for offline sync', err);
      }
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
      questionsAnsweredInSession.current > 0 &&
      questionsAnsweredInSession.current % LATE_NIGHT_CHECK_INTERVAL === 0
    ) {
      setWellnessReason('late_night');
      setShowWellnessModal(true);
    }

    // Clear submitting state
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

      // Use Edge streaming API (/api/gemini/stream) so user sees tokens immediately (latency masking)
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
        logger.error(LOG_SCOPE, 'Error generating alternate rationale', err);
        setAlternateRationale(
          "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
        );
        setIsExplainerLoading(false);
      }
    } catch (err) {
      // User-friendly error message instead of technical details
      logger.error(LOG_SCOPE, 'Error generating alternate rationale', err);
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

  const getBarColor = (score: number): string => getAccuracyBarClass(score);

  // NO CURRENT QUESTION - Show appropriate screen based on context
  if (!currentQuestion) {
    // In continuous mode, show loading while waiting for questions
    if (shouldEndlesslyReplenish) {
      // If we've already exceeded max attempts, show error
      if (replenishAttempts >= MAX_REPLENISH_ATTEMPTS) {
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
            <h2 className="text-2xl font-bold mb-2">{errorTitle}</h2>
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
                    setReplenishAttempts(0);
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
        <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
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
    <div className={`flex flex-col ${isExamSimulator ? 'exam-simulator-high-contrast' : ''}`}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4 mt-1">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Back to Practice */}
            {!isFullSitDownTest && (
              <BackLink to={ROUTES.PRACTICE} label="Back to Practice" className="rounded-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex-shrink-0" />
            )}
            {modeLabel && (
              <span className="text-sm text-[var(--color-text-muted)] truncate hidden sm:inline" aria-hidden>
                {modeLabel}
              </span>
            )}
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
                Question {questionNumber}
              </p>
              {/* Sprint 4: Momentum Badge (compact) */}
              {questionNumber > 3 && <MomentumBadge refreshKey={behavioralRefreshKey} />}
              {/* Sprint 4: Streak Badge */}
              {currentStreak >= 3 && <StreakBadge streak={currentStreak} />}
              {/* Sprint 4: Question Timer — hidden in Commuter Mode per audit */}
              {currentQuestion && !commuter?.isCommuterMode && (
                <QuestionTimer
                  startTime={questionStartTime}
                  parTimeMs={parTimeMs}
                  isAnswered={isAnswered}
                  isVisible={showTimerVisible}
                  compact
                />
              )}
              {/* Quick Wins: Time-box session timer — hidden in Commuter Mode */}
              {!commuter?.isCommuterMode && timeRemainingMs !== null && timeRemainingMs > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                  <Clock className="w-3.5 h-3.5 text-text-primary" />
                  <span className="text-xs font-semibold text-text-primary">
                    {Math.ceil(timeRemainingMs / 60000)} min
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Primary actions — always visible, with 44px touch targets */}

            {/* Session Stats Toggle */}
            <button
              onClick={() => setShowStatsOverlay((prev) => !prev)}
              title="Toggle session stats (S)"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
                showStatsOverlay
                  ? 'bg-[var(--color-accent)]/10 text-text-primary border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-accent)]/10 hover:text-text-primary hover:border-[var(--color-accent)]'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* Flag for personal review */}
            <button
              onClick={toggleFlag}
              title={isFlagged ? 'Unflag for review' : 'Flag for review'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
                isFlagged
                  ? 'bg-data-provisional/10 text-data-provisional border-data-provisional'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
              }`}
            >
              <FlagIcon className="w-5 h-5" />
            </button>

            {/* Normal Labs reference (slide-out panel) */}
            <button
              onClick={() => setShowNormalLabsPanel((prev) => !prev)}
              title="Normal Labs reference"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
                showNormalLabsPanel
                  ? 'bg-[var(--color-accent)]/10 text-text-primary border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
              }`}
              aria-label="Toggle Normal Labs reference"
            >
              <Beaker className="w-5 h-5" />
            </button>

            {/* Overflow menu — secondary actions collapsed behind "more" */}
            <div className="relative" ref={overflowMenuRef}>
              <button
                onClick={() => setShowOverflowMenu((prev) => !prev)}
                title="More actions"
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
                  showOverflowMenu
                    ? 'bg-[var(--color-accent)]/10 text-text-primary border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showOverflowMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                  {/* Report Issue */}
                  <button
                    onClick={() => {
                      setShowReportModal(true);
                      setShowOverflowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4 text-data-fail" />
                    Report Issue
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
                      setShowOverflowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <ClearHighlightIcon className="w-4 h-4" />
                    Clear Highlights
                  </button>
                  {/* Lab Calculators */}
                  <button
                    onClick={() => {
                      setShowLabCalcModal(true);
                      setShowOverflowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <Calculator className="w-4 h-4 text-text-primary" />
                    Lab Calculators
                  </button>
                  {/* Font size controls */}
                  <div className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <span className="text-[var(--color-text-muted)]">Font Size</span>
                    <div className="ml-auto flex items-center border border-[var(--color-border)] rounded-md bg-[var(--color-bg-secondary)]">
                      <button
                        onClick={() => setFontSizeAdjustment((prev) => prev - 1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-l-md text-sm font-medium"
                        aria-label="Decrease font size"
                      >
                        A−
                      </button>
                      <div className="w-px h-5 bg-border-subtle"></div>
                      <button
                        onClick={() => setFontSizeAdjustment((prev) => prev + 1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-r-md text-sm font-medium"
                        aria-label="Increase font size"
                      >
                        A+
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* End session */}
            {!isFullSitDownTest && (
              <button
                onClick={handleEndSession}
                title="End Session"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-data-fail/10 hover:border-data-fail hover:text-data-fail transition-colors"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        {isFullSitDownTest && (
          <div className="mt-4 mb-4">
            <Progress value={((questionNumber - 1) / (totalQuestions || 300)) * 100} />
            <div className="flex justify-between text-sm text-[var(--color-text-muted)] mt-1">
              <span>Question {questionNumber} of {totalQuestions || 300}</span>
              <span>{Math.round(((questionNumber - 1) / (totalQuestions || 300)) * 100)}%</span>
            </div>
          </div>
        )}
        {replenishmentError && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-data-provisional/50 bg-data-provisional/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            <span>{replenishmentError}</span>
            <button
              type="button"
              onClick={() => {
                setReplenishmentError(null);
                setError(null);
                void replenishQueue();
              }}
              className="flex-shrink-0 rounded-md px-3 py-1 font-medium text-text-primary hover:bg-[var(--color-accent)]/10"
            >
              Retry
            </button>
          </div>
        )}
        <SplitPaneDrillLayout
          vignette={useSplitPane ? currentQuestion.vignette : null}
          className="mb-6"
        >
          <div ref={microKinetics.registerMouseTrackingContainer}>
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
                const optionLabel = ['A', 'B', 'C', 'D'][index] ?? 'A';

                return (
                  <OptionHoverTracker
                    key={index}
                    optionIndex={index}
                    optionLabel={optionLabel}
                    className="block"
                    onHoverEnter={microKinetics.recordHoverEnter}
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

          {/* SUBMIT BUTTON - Sticky on mobile so it doesn't scroll off-screen */}
          {!isAnswered && selectedAnswerIndex !== null && (
            <div className="sticky bottom-0 z-10 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] mt-6 -mx-4 px-4 py-4 text-center animate-fade-in space-y-2 md:static md:border-t-0 md:bg-transparent md:mx-0 md:px-0 md:py-0 md:mt-6 md:space-y-4">
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={isSubmitting}
                className="btn-primary-cta px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Answer'
                )}
              </button>
              <p className="mt-2 text-sm text-[var(--color-text-muted)] hidden md:block">
                Press{' '}
                <kbd className="px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-xs font-mono">
                  Enter
                </kbd>{' '}
                to submit
              </p>
            </div>
          )}

          {/* FEEDBACK / RATIONALE */}
          {isAnswered && !isExamSimulator && (
            <div className="mt-6 animate-fade-in space-y-4">
              {topicStats && (
                <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
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

              <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg feedback-content">
                {/* Error Tagger - Only show when incorrect */}
                {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
                  <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
                    <ErrorTagger onTagError={updateLastPerformanceErrorTag} />
                  </div>
                )}

                {/* Peer selection stats: "42% of students also chose B" — Wisdom of the Crowds (especially when wrong) */}
                {selectedAnswerIndex !== null &&
                  answerDistribution &&
                  (() => {
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

                {/* Core PANCE: rationale – structured (5-section) or legacy, via ExplanationPanel */}
                <ExplanationPanel
                  rationale={(() => {
                    const r = currentQuestion.rationale;
                    if (typeof r === 'object' && r !== null && 'whyCorrect' in r) return r;
                    if (typeof r === 'string') {
                      try {
                        const parsed = JSON.parse(r) as unknown;
                        if (parsed && typeof parsed === 'object' && 'whyCorrect' in parsed)
                          return parsed;
                      } catch {
                        /* not JSON */
                      }
                      return r;
                    }
                    return '';
                  })()}
                  condition={currentQuestion.condition ?? 'Unknown'}
                  conditionSlug={currentQuestion.conditionId}
                  isCorrect={selectedAnswerIndex === currentQuestion.correctAnswerIndex}
                  correctAnswer={currentQuestion.options[currentQuestion.correctAnswerIndex] ?? ''}
                  userAnswer={
                    selectedAnswerIndex != null
                      ? (currentQuestion.options[selectedAnswerIndex] ?? '')
                      : ''
                  }
                  correctAnswerIndex={currentQuestion.correctAnswerIndex}
                  userAnswerIndex={selectedAnswerIndex ?? -1}
                  options={currentQuestion.options}
                  questionId={currentQuestion.id}
                  fontSizeAdjustment={fontSizeAdjustment}
                  contentSource={currentQuestion.contentSource}
                  contentSourceTitle={currentQuestion.contentSourceTitle}
                />


                {selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={handleExplainDifferently}
                      disabled={isExplainerLoading}
                      className="btn-glass px-4 py-2 text-sm"
                    >
                      {isExplainerLoading ? 'Thinking...' : 'Explain this differently'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSocraticTutor(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)]/10 text-text-primary font-medium text-sm hover:bg-[var(--color-accent)]/20 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Tutor Me
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
                    <h4 className="font-bold text-md mb-2 text-text-primary">
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
                    <h3 className="font-bold text-lg mb-2 text-text-primary">
                      Key Pearls: {currentQuestion.condition}
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                      {currentQuestion.pearls.map((pearl, index) => (
                        <li
                          key={index}
                          dangerouslySetInnerHTML={{ __html: sanitizeForRationale(pearl) }}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  {!showNotes && !localNote ? (
                    <button
                      onClick={() => setShowNotes(true)}
                      className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-text-primary transition-colors py-1"
                    >
                      <PenLine className="w-4 h-4" />
                      Add Note
                    </button>
                  ) : (
                    <>
                      <h3 className="font-bold text-lg mb-2 text-text-primary">
                        My Notes
                      </h3>
                      <textarea
                        value={localNote}
                        onChange={handleNoteChange}
                        placeholder="Type your notes here... They will be saved automatically."
                        className="w-full p-2 border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-text-primary rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        rows={3}
                        autoFocus={showNotes && !localNote}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {isAnswered && (
            <div className="sticky bottom-0 z-10 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] mt-4 -mx-4 px-4 py-4 text-center md:static md:border-t-0 md:bg-transparent md:mx-0 md:px-0 md:py-0 md:mt-4">
              <button
                ref={nextButtonRef}
                onClick={() => {
                  try {
                    showNextQuestion();
                  } catch (error) {
                    logger.error(LOG_SCOPE, 'Error in Next Question button click', error);
                    setError('Failed to proceed to next question. Please refresh the page.');
                  }
                }}
                className="px-8 py-3 btn-glass font-bold rounded-lg min-h-[44px]"
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
      {showLabCalcModal && <QuizLabCalcModal onClose={() => setShowLabCalcModal(false)} />}

      {/* Normal Labs reference panel (slide-out from right) */}
      <NormalLabsPanel
        isOpen={showNormalLabsPanel}
        onClose={() => setShowNormalLabsPanel(false)}
      />

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

      {/* Socratic Tutor: Tutor Me for incorrect answers */}
      <AnimatePresence>
        {showSocraticTutor &&
          currentQuestion &&
          selectedAnswerIndex !== null &&
          selectedAnswerIndex !== currentQuestion.correctAnswerIndex && (
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
          )}
      </AnimatePresence>
    </div>
  );
};

export { QuizView };
export default QuizView;
