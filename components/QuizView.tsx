// components/QuizView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShortcut } from '../src/context/ShortcutContext';
import { useUser } from '@clerk/clerk-react';

// Core services
import { getQuestion, fetchPearlsForQuestion } from '@/services/core';
import {
  fetchSessionQuestions,
  recordSessionAnswer,
  initializeSession,
  getPoolStatus,
  checkAndReplenishPool,
  getSessionSummary as getMainSessionSummary,
} from '@/services/core';
import { recordQuestionAttempt } from '@/services/core';

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
import { FlagQuestionModal } from './FlagQuestionModal';
import AnswerChoice from './quiz/AnswerChoice';
import ErrorTagger from './quiz/ErrorTagger';
import Loader from './Loader';
import WellnessCheckModal from './wellness/WellnessCheckModal';
import { SRSFeedbackBadge } from './quiz/SRSFeedbackBadge';

// Sprint 4: Enhanced session components
import {
  SessionStatsOverlay,
  AnswerFeedback,
  SessionEndSummary,
  useAnswerFeedback,
  QuestionTimer,
  QuickStatsMiniBar,
  SessionInsightsPanel,
  MomentumBadge,
  StreakBadge,
  SmartPauseIndicator,
  EncouragementToast,
  CognitiveStateIndicator,
} from './quiz';
import { ClinicalSkeleton } from './ui/ClinicalSkeleton';

// Icons
import { CloseIcon } from './icons/CloseIcon';
import { FlagIcon } from './icons/FlagIcon';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ClearHighlightIcon } from './icons/ClearHighlightIcon';

// Types
import type { Question, PerformanceRecord, SessionSettings, ErrorTag } from '../types';
import type { SRSScheduleResult } from '../lib/services/srsService';

// Lib utils
import { updateReviewOutcome } from '../lib/services/srsService';
import { calculateParTime } from '../lib/utils/questionComplexity';
import {
  optimisticUpdateStats,
  optimisticUpdateSystemStats,
  createOptimisticPerformanceRecord,
  showOptimisticFeedback,
} from '../lib/utils/optimisticUI';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useAdvancedAnalytics } from '../hooks/useAdvancedAnalytics';
import { useImplicitMetrics } from '../hooks/useImplicitMetrics';

// Other services (non-barrel)
import { feedback } from '../services/feedbackService';

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
        <div className="my-2" dangerouslySetInnerHTML={{ __html: tableHTML }} />

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
  const answerFeedback = useAnswerFeedback();
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

  // Keep current question synced with queue[0]
  useEffect(() => {
    setCurrentQuestion(queue[0] || null);
  }, [queue]);

  // ---- SHOULD WE REPLENISH ENDLESSLY? ----
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

  // ---- REPLENISH QUEUE (ALL / GROWTH / TOPIC) ----
  const replenishQueue = useCallback(async () => {
    // Do NOT show the global loader here – this is background work
    if (!shouldEndlesslyReplenish) return;

    setIsGeneratingQuestion(true);
    try {
      // Use questionService for single question fetch (pool + Gemini fallback)
      // The mainSessionService is used for batch fetches and analytics
      const newQuestion = await getQuestion(sessionSettings, growthAreas, getToken);

      if (newQuestion) {
        // keep both queues in sync
        setParentQueue((prev) => [...prev, newQuestion]);
        setQueue((prev) => [...prev, newQuestion]);
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
  }, [shouldEndlesslyReplenish, sessionSettings, growthAreas, setParentQueue, setError]);

  // ---- ADVANCE TO NEXT QUESTION ----
  const showNextQuestion = useCallback(() => {
    try {
      setIsAnswered(false);
      setSelectedAnswerIndex(null);
      setShowRationale(false);
      setAlternateRationale(null);
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

        // Finite sessions: REVIEW / REVIEW FLAGGED - show summary instead of direct end
        if (!shouldEndlesslyReplenish && newQueue.length === 0) {
          handleEndSession();
        }

        return newQueue;
      });

      // Endless sessions: ALL + SAME, ALL + other difficulties, topic, growth
      if (shouldEndlesslyReplenish) {
        void replenishQueue();
      }
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
      setCurrentQuestion(initialQueue[0]);
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

    setIsAnswered(true);

    // Sprint 4: Calculate correctness IMMEDIATELY
    const isCorrect = selectedAnswerIndex === currentQuestion.correctAnswerIndex;
    const timeToAnswer = Date.now() - questionStartTime;

    // Sprint C: Submit implicit metrics to backend
    const questionId = currentQuestion.id || `temp-${questionNumber}`;
    await implicitMetrics.submitAnswer(questionId, isCorrect, 'multiple_choice').catch((err) => {
      // Don't block UI if metrics submission fails
      console.warn('Implicit metrics submission failed:', err);
    });

    // Sprint 4: Show optimistic feedback INSTANTLY (no server wait)
    showOptimisticFeedback(isCorrect);

    // Load pearls from medical content if not already loaded
    if (!currentQuestion.pearls && currentQuestion.conditionId) {
      try {
        const token = await getToken();
        const pearls = await fetchPearlsForQuestion(currentQuestion.conditionId, token);
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
    recordBehavioralConfidence(behaviorSignals, isCorrect);

    // Sprint 4: Record momentum data
    recordMomentumResult(isCorrect, timeToAnswer, parTime);

    // Sprint 4: Record answer pattern for post-session analysis
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

    // Sprint 4: Update performance prediction
    const confidenceResult = inferConfidence(behaviorSignals);
    updatePerformancePrediction({
      correct: isCorrect,
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
      system: currentQuestion.system,
      questionNumber,
      inferredConfidence: typeof confidenceResult === 'number' ? confidenceResult : confidenceResult.score,
    });

    // Sprint 4: Record for smart pause detection
    recordPauseResult({
      correct: isCorrect,
      timeSpentMs: timeToAnswer,
      parTimeMs: parTime,
    });

    // Advanced analytics: Record comprehensive question result
    recordQuestionResult?.({
      questionId: currentQuestion.id || `temp-${questionNumber}`,
      responseTimeMs: timeToAnswer,
      wasCorrect: isCorrect,
      difficulty: (currentQuestion.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      answerChanges: behaviorSignals.answerChangeCount,
      eliminationsUsed: behaviorSignals.eliminatedCount,
      system: currentQuestion.system || 'Unknown',
    });

    setBehavioralRefreshKey((k) => k + 1);

    // Trigger sensory feedback (haptic + optional sound)
    if (isCorrect) {
      feedback.correct();
      // Sprint 4: Trigger answer feedback animation and update streak
      answerFeedback.triggerCorrect(currentStreak + 1);
      setCurrentStreak((prev) => prev + 1);
    } else {
      feedback.incorrect();
      // Sprint 4: Trigger incorrect animation and reset streak
      answerFeedback.triggerIncorrect();
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
      difficulty: sessionSettings.difficulty,
      questionWordCount,
      timeSpentMs: timeToAnswer,
    });

    // Record attempt to database (non-blocking)
    if (currentQuestion.id) {
      getToken().then((token) => {
        recordQuestionAttempt(
          {
            questionId: currentQuestion.id!,
            wasCorrect: isCorrect,
            system: currentQuestion.system || currentQuestion.topic,
            conditionId: currentQuestion.conditionId,
            mode: 'session',
            timeSpentMs: timeToAnswer,
            answerChangedCount: answerChangeCount,
          },
          token
        ).catch((err) => {
          console.warn('[QuizView] Failed to record attempt to database:', err);
        });
      });
    }

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
      // Calculate complexity-aware par time based on word count, images, and labs
      const baselineTime = calculateParTime(currentQuestion);
      const performanceRatio = timeToAnswer / baselineTime;

      // Calculate quality score (0-5 scale) using FSRS v5 adaptive logic
      // Quality accounts for both correctness AND time relative to question complexity
      let quality: number;
      if (isCorrect) {
        // Correct answers: quality depends on speed relative to question complexity
        if (performanceRatio < 0.75) {
          quality = 5; // Easy - significantly faster than par (mastery)
        } else if (performanceRatio < 1.25) {
          quality = 4; // Good - within normal range
        } else {
          quality = 3; // Hard - slower than expected but still correct
        }
      } else {
        // Incorrect answers: quality depends on whether it was rushed or thoughtful
        if (performanceRatio < 0.5) {
          quality = 1; // Failed - incorrect AND rushed (likely guessing/anchoring bias)
        } else {
          quality = 2; // Again - incorrect but took time (knowledge gap, not careless)
        }
      }

      // Check if in red zone (performance < 75%)
      const topicPerformance = performanceData
        .filter((p) => p.topic === currentQuestion.topic)
        .slice(-20);
      const recentCorrect = topicPerformance.filter((p) => p.isCorrect).length;
      const isInRedZone =
        topicPerformance.length > 0 && recentCorrect / topicPerformance.length < 0.75;

      // Update SRS schedule asynchronously (non-blocking)
      // FSRS v5 will apply additional modifiers based on quality, time, and red zone status
      updateReviewOutcome(user.id, currentQuestion.id, {
        quality,
        timeToAnswer,
        baselineTime,
        isInRedZone,
      })
        .then((result) => {
          setSrsResult(result);
        })
        .catch((err) => {
          console.error('Failed to update SRS schedule:', err);
          // Silent failure - don't block the user
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
    answerFeedback,
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
    setAlternateRationale(null);

    try {
      const userAnswer = currentQuestion.options[selectedAnswerIndex];
      const correctAnswer = currentQuestion.options[currentQuestion.correctAnswerIndex];
      const explanation = await generateAlternateRationale(
        currentQuestion,
        userAnswer,
        correctAnswer
      );
      setAlternateRationale(explanation);
    } catch (err) {
      // User-friendly error message instead of technical details
      console.error('Error generating alternate rationale:', err);
      setAlternateRationale(
        "Sorry, we couldn't generate a new explanation right now. The AI service may be temporarily busy. Please try again in a moment."
      );
    } finally {
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

  const getBarColor = (score: number): string => {
    if (score < 50) return 'bg-red-500';
    if (score < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // NO CURRENT QUESTION - Show appropriate screen based on context
  if (!currentQuestion) {
    // In continuous mode, if we're actively generating, show loading screen
    if (shouldEndlesslyReplenish && isGeneratingQuestion) {
      return (
        <div className="bg-[var(--color-bg-primary)] min-h-screen px-4 sm:px-6 py-10">
          <div className="max-w-5xl mx-auto space-y-4">
            <ClinicalSkeleton />
            <div className="grid gap-3 sm:grid-cols-2">
              <ClinicalSkeleton variant="compact" className="min-h-[72px]" lines={2} />
              <ClinicalSkeleton variant="compact" className="min-h-[72px]" lines={2} />
              <ClinicalSkeleton variant="compact" className="min-h-[72px]" lines={2} />
              <ClinicalSkeleton variant="compact" className="min-h-[72px]" lines={2} />
            </div>
          </div>
        </div>
      );
    }

    // Otherwise, show session complete (for finite modes or when truly done)
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
                  isVisible={showTimer}
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
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-[var(--color-card-bg)] text-slate-600 border-[var(--color-border)] hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* Report Issue - for reporting bad questions to admins */}
            <button
              onClick={() => setShowReportModal(true)}
              title="Report an issue with this question"
              className="p-1.5 rounded-full transition-colors border bg-[var(--color-card-bg)] text-slate-600 border-[var(--color-border)] hover:bg-red-50 hover:text-red-600 hover:border-red-300"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>

            {/* Flag for personal review */}
            <button
              onClick={toggleFlag}
              title={isFlagged ? 'Unflag for review' : 'Flag for review'}
              className={`p-1.5 rounded-full transition-colors border ${
                isFlagged
                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                  : 'bg-[var(--color-card-bg)] text-slate-600 border-[var(--color-border)] hover:bg-white hover:border-[var(--color-accent)]'
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
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-slate-600 hover:bg-white hover:border-[var(--color-accent)] transition-colors"
            >
              <ClearHighlightIcon className="w-5 h-5" />
            </button>

            {/* Font size controls */}
            <div className="flex items-center border border-[var(--color-border)] rounded-md bg-[var(--color-card-bg)]">
              <button
                onClick={() => setFontSizeAdjustment((prev) => prev - 1)}
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-white rounded-l-md text-sm"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <div className="w-px h-4 bg-[#D0C7BF]"></div>
              <button
                onClick={() => setFontSizeAdjustment((prev) => prev + 1)}
                className="px-2 py-0.5 text-[var(--color-text-secondary)] hover:bg-white rounded-r-md text-sm"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* End session */}
            <button
              onClick={handleEndSession}
              title="End Session"
              className="p-1.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-border)] text-slate-600 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id ?? `${currentQuestion.question}-${questionNumber}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <QuestionDisplay text={currentQuestion.question} />
          </motion.div>
        </AnimatePresence>
      </div>

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
          {/* SRS Feedback Badge */}
          {srsResult && (
            <div className="flex justify-center mb-4">
              <SRSFeedbackBadge
                result={srsResult}
                isCorrect={selectedAnswerIndex === currentQuestion.correctAnswerIndex}
              />
            </div>
          )}

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
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <ErrorTagger onTagError={updateLastPerformanceErrorTag} />
              </div>
            )}

            <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">Rationale</h3>
            <div
              className="text-[var(--color-text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: currentQuestion.rationale }}
            />

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
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                ></div>
                <span className="text-sm">Generating new explanation...</span>
              </div>
            )}

            {alternateRationale && !isExplainerLoading && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
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
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">
                  Key Pearls: {currentQuestion.condition}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
                  {currentQuestion.pearls.map((pearl, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: pearl }} />
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">My Notes</h3>
              <textarea
                value={localNote}
                onChange={handleNoteChange}
                placeholder="Type your notes here... They will be saved automatically."
                className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
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

      {/* Sprint 4: Quick Stats Mini-bar (when full overlay is closed) */}
      {!showStatsOverlay && performanceData.length > 0 && (
        <div className="mt-6">
          <QuickStatsMiniBar
            performanceData={performanceData}
            currentQuestionNumber={questionNumber}
            sessionStartTime={sessionStartTime.current}
          />
        </div>
      )}

      {/* Sprint 4: Session Insights Panel (behavioral analytics) */}
      {performanceData.length >= 3 && (
        <div className="mt-4">
          <SessionInsightsPanel refreshKey={behavioralRefreshKey} />
        </div>
      )}

      {/* Sprint 4: Smart Pause Indicator */}
      {performanceData.length >= 5 && <SmartPauseIndicator refreshKey={behavioralRefreshKey} />}

      {/* Advanced Analytics: Cognitive State Indicator */}
      {performanceData.length >= 3 && cognitiveState && (
        <div className="fixed bottom-4 right-4 z-40">
          <CognitiveStateIndicator cognitiveState={cognitiveState} compact />
        </div>
      )}

      {/* Sprint 4: Encouragement Toast */}
      <EncouragementToast refreshKey={behavioralRefreshKey} />

      {/* Wellness Check Modal */}
      <WellnessCheckModal
        isOpen={showWellnessModal}
        onClose={() => setShowWellnessModal(false)}
        reason={wellnessReason}
      />

      {/* Report Question Issue Modal */}
      {currentQuestion && (
        <FlagQuestionModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          questionId={currentQuestion.id || `temp-${Date.now()}`}
          questionText={currentQuestion.question}
          correctAnswer={currentQuestion.answers?.[currentQuestion.correctIndex]}
          topic={currentQuestion.topic}
          system={currentQuestion.system || undefined}
          userId={user?.id || 'anonymous'}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userFirstName={user?.firstName || undefined}
        />
      )}

      {/* Sprint 4: Answer Feedback Animation */}
      <AnswerFeedback
        isCorrect={answerFeedback.isCorrect}
        showFeedback={answerFeedback.showFeedback}
        streak={currentStreak}
      />

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