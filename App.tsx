// App.tsx — layout shell, provider composition, and view orchestration.
// Decomposition roadmap: see docs/architecture/APP_DECOMPOSITION.md
import React, { useEffect, useMemo, useState, useCallback, useRef, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Shield, User, HelpCircle } from 'lucide-react';
import { ROUTES } from './config/routes';
import { CANONICAL_PATHS } from './config/navigation';
import { runStorageKeyMigration } from './lib/storage/storageRegistry';
import { NavRail } from './components/layout/NavRail';
import { AppBrand } from './components/layout/AppBrand';
import { type View, pageVariants, DRILL_MODE_IDS } from './config/appViews';
import { TRAINING_MODES } from './config/training-modes';
import { useAppNavigation } from './hooks/useAppNavigation';
import { DrillViewRouter } from './components/layout/DrillViewRouter';
import { KeyboardAccessibilityAudit } from './components/shared/KeyboardAccessibilityAudit';
import { ContrastRatioAudit } from './components/shared/ContrastRatioAudit';
import PerformanceMonitor from './components/shared/PerformanceMonitor';
import PWAInstallPrompt from './components/shared/PWAInstallPrompt';
import {
  QuizViewWithErrorBoundary,
  SessionRunner,
  MenuView,
  SettingsStatsModal,
  KeyboardShortcutsModal,
  PANRELASimulator,
  CommandPalette,
  UserProfileModal,
  BaselineAssessment,
  OnboardingYourPlan,
  MediaApproval,
  ToolkitHub,
  GapAnalysisDashboard,
  StudyPathDashboard,
  CommandCenterHub,
  TrainingMenu,
  SimulationPage,
  CommandCenterPage,
  KnowledgeBaseHub,
  MyLibraryPage,
  TutorChatPage,
  StudyCompanionPage,
  SrsFlashcardView,
  CustomStudyMode,
  ClinicalProfileDashboard,
  AdminDashboard,
  TaxonomiesPage,
  SystemMappingsPage,
  QuestionGeneratorPage,
  RefineryPage,
  MyPearlsPanel,
  ClinicalEyePage,
  VisualizerPage,
  CrossSystemExplorer,
  MedicalDatabaseSearch,
  LiveStudySession,
  PracticePage,
  ProgressPage,
  DailyChallengesHub,
} from './config/lazyComponents';
import { BehavioralTrackerProvider } from '@/components/quiz/Tracker';
import { useUser, useAuth } from '@clerk/clerk-react';
import { setGeminiAuthProvider } from '@/services/ai/geminiService';
import { useFSRSOptimizationCheck } from './hooks/useFSRSOptimizationCheck';
import { useEnhancedAuth } from './hooks/useEnhancedAuth';
import { Toaster } from 'sonner';
import { Loader, CommandCenterSkeleton, DrillLoadingState, LoadingProgress } from './components/loading';
import { EnhancedErrorMessage } from './components/shared/EnhancedErrorMessage';
import { NotFoundPage } from './components/error/NotFoundPage';
import ThemeToggleButton from './components/ui/ThemeToggleButton';
import { MasteryHeatmapToggle } from './components/ui/MasteryHeatmapToggle';
import { useTheme } from './hooks/useTheme';
import { LandingPage } from './pages/LandingPage';
import { getQuestionBatch } from './services/questionService';
import { initializeSession, fetchSessionQuestions, prefetchQuestions } from './services/core';
import { inferTaskType } from './lib/taskTypes';
import { useUserStats } from './hooks/useUserStats';
import { preloadData } from './lib/utils/dataLoader';
import { useAccessibleTransition } from './hooks/useReducedMotion';
import { useViewTransition } from './hooks/useViewTransition';
import { flushPendingToLocalStorage } from './lib/services/sync/offlineSync';
import { WithGeminiErrorBoundary } from './components/hoc/withGeminiErrorBoundary';
import { useInitialLoadOptimization } from './services/initialLoadOptimizer';
import type {
  Question as QuizQuestion,
  PerformanceRecord,
  SessionSettings,
  ErrorTag,
  UserProfile,
} from './types';
import { hasCompletedOnboarding, saveUserProfile, getExamLabel } from './services/analytics';
import { CommuterProvider } from './contexts/CommuterContext';
import { ToastProvider } from './contexts/ToastContext';
import { SystemIntegrationProvider } from './contexts/SystemIntegrationContext';
import { OfflineSyncIndicator } from './components/offline/OfflineSyncIndicator';
import { ProductTour, useProductTourShouldShow } from './components/onboarding/ProductTour';

/** Session focus options for simulation / training menu */
type SimulationFocus = 'all' | 'growth' | 'flagged' | 'due';

// Aliases for backward compatibility in this file
const DRILL_MODE_PHOTO = DRILL_MODE_IDS.PHOTO;
const DRILL_MODE_ECG = DRILL_MODE_IDS.ECG;
const DRILL_MODE_DERM = DRILL_MODE_IDS.DERM;
const DRILL_MODE_IMAGING = DRILL_MODE_IDS.IMAGING;
const DRILL_MODE_RAPID_RECALL = DRILL_MODE_IDS.RAPID_RECALL;
const DRILL_MODE_DDX_COMPARE = DRILL_MODE_IDS.DDX_COMPARE;
const DRILL_MODE_MINI_LAB = DRILL_MODE_IDS.MINI_LAB;
const DRILL_MODE_PHARMACOLOGY = DRILL_MODE_IDS.PHARMACOLOGY;
const DRILL_MODE_FIRST_LINE = DRILL_MODE_IDS.FIRST_LINE;
const DRILL_MODE_CONDITION = DRILL_MODE_IDS.CONDITION;
const DRILL_MODE_SYSTEM = DRILL_MODE_IDS.SYSTEM;
const DRILL_MODE_SUBCATEGORY = DRILL_MODE_IDS.SUBCATEGORY;
const DRILL_MODE_GUIDELINE = DRILL_MODE_IDS.GUIDELINE;
const DRILL_MODE_FLUID_ELECTROLYTE = DRILL_MODE_IDS.FLUID_ELECTROLYTE;
const DRILL_MODE_ANTIBIOTIC = DRILL_MODE_IDS.ANTIBIOTIC;
const DRILL_MODE_PATIENT_ENCOUNTER = DRILL_MODE_IDS.PATIENT_ENCOUNTER;
const DRILL_MODE_CODE_BLUE = DRILL_MODE_IDS.CODE_BLUE;
const DRILL_MODE_GRAND_ROUNDS = DRILL_MODE_IDS.GRAND_ROUNDS;
const DRILL_MODE_VENTILATOR = DRILL_MODE_IDS.VENTILATOR;
const DRILL_MODE_PHYSIOLOGY = DRILL_MODE_IDS.PHYSIOLOGY;
const DRILL_MODE_ANATOMY = DRILL_MODE_IDS.ANATOMY;
const DRILL_MODE_CONTRASTIVE = DRILL_MODE_IDS.CONTRASTIVE;
const DRILL_MODE_CRAM = DRILL_MODE_IDS.CRAM;
const DRILL_MODE_COMMUTER = DRILL_MODE_IDS.COMMUTER;

// Batch fetch 10 questions initially to prevent session ending early
/** Commuter Mode: buffer for trains/buses/basements — prefetch 50 cards on Start Session */
const INITIAL_QUEUE_SIZE = 50;

/** Minimal SRS schedule for manual review items: 1d → 3d → 7d → 14d */
function scheduleNextReview(level: number): string {
  const days = level <= 1 ? 1 : level === 2 ? 3 : level === 3 ? 7 : 14;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0] ?? '';
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check authentication status with enhanced timeout and error handling
  const { isSignedIn, isLoaded: authLoaded } = useUser();
  const { getToken } = useAuth();
  const {
    isLoading: authIsLoading,
    error: authError,
    hasTimedOut: authHasTimedOut,
    isGuestMode,
    retryAuth,
    enterGuestMode,
  } = useEnhancedAuth();

  // Register Clerk auth provider for Gemini API calls so all callGeminiText
  // requests automatically include the Authorization header
  useEffect(() => {
    if (getToken && !isGuestMode) {
      setGeminiAuthProvider(getToken);
    } else if (isGuestMode) {
      // Set a mock auth provider for guest mode
      setGeminiAuthProvider(async () => 'guest-mode-token');
    }
  }, [getToken, isGuestMode]);

  // Automated FSRS tuning: trigger optimization on sign-in if > 24h since last run
  useFSRSOptimizationCheck();

  // Initial load time optimization and performance monitoring
  const { report: performanceReport, optimize: optimizeInitialLoad } = useInitialLoadOptimization();

  // Theme state for passing to child components
  const [theme, setTheme] = useTheme();

  const { view, setView, showNotFound } = useAppNavigation();
  const startViewTransition = useViewTransition();

  // One-time migration from legacy panacea_* keys to panceai_* (see storageRegistry)
  useEffect(() => {
    runStorageKeyMigration();
  }, []);

  // URL-to-view routing, notFound detection, and accessibility focus
  // are handled by useAppNavigation (imported above).

  // NavRail Reference/Progress: sync ?tab= to CommandCenterHub Study Tools tab
  const commandCenterInitialTab = useMemo(():
    | 'training'
    | 'resources'
    | 'analytics'
    | undefined => {
    if (location.pathname !== '/study' && location.pathname !== '/study/') return undefined;
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'resources' || tab === 'analytics') return tab;
    return undefined;
  }, [location.pathname, location.search]);

  // Support ?modal=settings query param to open Settings modal (for nav links)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modal = params.get('modal');
    if (modal === 'settings') {
      setIsSettingsModalOpen(true);
    }
  }, [location.search]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [questionQueue, setQuestionQueue] = useState<QuizQuestion[]>([]);
  const [quizKey, setQuizKey] = useState(0);

  // Use the cloud-sync-enabled stats hook
  const {
    performanceData,
    missedQuestions,
    flaggedQuestions,
    setPerformanceData,
    setMissedQuestions,
    setFlaggedQuestions,
    isSyncing,
    isLoading: isStatsLoading,
    lastSyncTime,
    syncError,
  } = useUserStats();

  const [fontSizeAdjustment, setFontSizeAdjustment] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!isHelpModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsHelpModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isHelpModalOpen]);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  type OnboardingStep = 'profile' | 'baseline' | 'your_plan';
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
  const [onboardingWeakestSystems, setOnboardingWeakestSystems] = useState<string[]>([]);
  const [onboardingExamDate, setOnboardingExamDate] = useState<string | null>(null);
  const [showProductTour, setShowProductTour] = useState(false);
  const [showProTip, setShowProTip] = useState(false);
  const productTourShouldShow = useProductTourShouldShow();

  // Show product tour on first visit to command center (when not from onboarding)
  const hasScheduledTour = useRef(false);
  useEffect(() => {
    if (
      view === 'command_center' &&
      productTourShouldShow &&
      !showProductTour &&
      !isOnboardingModalOpen &&
      !hasScheduledTour.current
    ) {
      hasScheduledTour.current = true;
      const timer = setTimeout(() => setShowProductTour(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [view, productTourShouldShow, showProductTour, isOnboardingModalOpen]);

  // Get exam label based on user context (PANCE or PANRE)
  const examLabel = getExamLabel();

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const dueQuestionsCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0] ?? '';
    return missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today).length;
  }, [missedQuestions]);

  // ---- Preload large data files in background for better performance ----
  useEffect(() => {
    // Start preloading data after initial mount
    preloadData();
  }, []);

  // ---- Optimize initial load time with performance monitoring ----
  const performanceReportRef = React.useRef(performanceReport);
  performanceReportRef.current = performanceReport;
  useEffect(() => {
    optimizeInitialLoad();
    const timer = setTimeout(() => {
      const report = performanceReportRef.current;
      if (import.meta.env.DEV) {
        if (report.score < 70) {
          console.warn('[Performance] Initial load needs improvement:', report);
        } else {
          console.log('[Performance] Initial load optimized:', report);
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
    // Run once on mount; reportRef keeps latest for 5s callback
  }, []);

  // ---- Check if user needs onboarding on first sign-in ----
  // Hydrate hasCompletedOnboarding from server so cross-device / after clear-storage works
  useEffect(() => {
    if (!isSignedIn || !authLoaded) return;
    let cancelled = false;
    getToken()
      .then((token) => {
        if (!token || cancelled) return null;
        return fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((value: unknown) => {
        if (cancelled) return;
        const data = value as { data?: { profile?: { hasCompletedOnboarding?: boolean } } } | null;
        if (data?.data?.profile?.hasCompletedOnboarding === true)
          saveUserProfile({ hasCompletedOnboarding: true });
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        const completed = hasCompletedOnboarding();
        if (!completed) {
          setTimeout(() => {
            setIsOnboardingModalOpen(true);
            setOnboardingStep('profile');
            setOnboardingWeakestSystems([]);
            setOnboardingExamDate(null);
          }, 500);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, authLoaded, getToken]);

  // ---- Global keyboard shortcuts ----
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Cmd/Ctrl + / to open keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };

    globalThis.addEventListener('keydown', handleGlobalKeyDown);
    return () => globalThis.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ---- Safety net: flush pending sync data before browser closes ----
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Flush any pending debounced operations to localStorage queue
      // This ensures data isn't lost if user closes tab during debounce window
      flushPendingToLocalStorage();
    };

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    return () => globalThis.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ---- derived: "growth areas" and heatmap data ----
  // Heatmap and growth areas use synced performanceData filtered by focus === 'all'
  // (see docs/ANALYTICS_DATA_SOURCES.md). Analytics Dashboard uses server aggregation (/api/user/stats).
  const heatmapPerformance = useMemo(
    () => performanceData.filter((r) => r.focus === 'all'),
    [performanceData]
  );

  // Growth areas by topic, from the same filtered performance
  const growthAreas: string[] = useMemo(() => {
    if (heatmapPerformance.length === 0) return [];

    const byTopic = new Map<string, { correct: number; total: number }>();

    for (const rec of heatmapPerformance) {
      const bucket = byTopic.get(rec.topic) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (rec.isCorrect) bucket.correct += 1;
      byTopic.set(rec.topic, bucket);
    }

    const topicStats = Array.from(byTopic.entries())
      .map(([topic, { correct, total }]) => ({
        topic,
        total,
        score: total ? (correct / total) * 100 : 0,
      }))
      .filter((t) => t.total >= 3) // only topics you’ve actually seen
      .sort((a, b) => a.score - b.score); // weakest first

    return topicStats.slice(0, 5).map((t) => t.topic);
  }, [heatmapPerformance]);

  // ---- performance record hook passed into QuizView (memoized to avoid child re-renders) ----
  const addPerformanceRecord = useCallback(
    (record: PerformanceRecord) => {
      setPerformanceData((prev) => [...prev, record]);
    },
    [setPerformanceData]
  );

  const updateLastPerformanceErrorTag = useCallback(
    (tag: ErrorTag) => {
      setPerformanceData((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const lastRecord = updated.at(-1);
        if (!lastRecord) return prev;
        updated[updated.length - 1] = {
          ...lastRecord,
          errorTag: tag,
        };
        return updated;
      });
    },
    [setPerformanceData]
  );

  const addMissedQuestion = useCallback(
    (question: QuizQuestion) => {
      const now = new Date().toISOString().split('T')[0];
      const taskType = question.taskType ?? inferTaskType(question.question ?? '');
      const base: QuizQuestion = {
        ...question,
        taskType,
        repetitionLevel: question.repetitionLevel ?? 1,
        nextReviewDate: question.nextReviewDate ?? now,
      };
      setMissedQuestions((prev) => [...prev, base]);
    },
    [setMissedQuestions]
  );

  /** Remove a concept from the Due queue when user answers a sibling correctly (proves understanding). */
  const removeDueConcept = useCallback(
    (conditionId: string, taskType: string | null) => {
      if (!conditionId) return;
      setMissedQuestions((prev) =>
        prev.filter((q) => !(q.conditionId === conditionId && (q.taskType ?? null) === taskType))
      );
    },
    [setMissedQuestions]
  );

  const updateReviewQuestion = useCallback(
    (question: QuizQuestion, wasCorrect: boolean) => {
      setMissedQuestions((prev) =>
        prev.map((q) => {
          if (q.question !== question.question) return q;
          const currentLevel = q.repetitionLevel ?? 1;
          if (wasCorrect) {
            const newLevel = currentLevel + 1;
            return {
              ...q,
              repetitionLevel: newLevel,
              nextReviewDate: scheduleNextReview(newLevel),
            };
          }
          return {
            ...q,
            repetitionLevel: 1,
            nextReviewDate: scheduleNextReview(1),
          };
        })
      );
    },
    [setMissedQuestions]
  );

  const addFlaggedQuestion = useCallback(
    (question: QuizQuestion) => {
      setFlaggedQuestions((prev) => {
        if (prev.some((q) => q.question === question.question)) return prev;
        return [...prev, question];
      });
    },
    [setFlaggedQuestions]
  );

  const removeFlaggedQuestion = useCallback(
    (question: QuizQuestion) => {
      setFlaggedQuestions((prev) => prev.filter((q) => q.question !== question.question));
    },
    [setFlaggedQuestions]
  );

  const updateQuestionNote = useCallback(
    (question: QuizQuestion, note: string) => {
      const updater = (q: QuizQuestion) =>
        q.question === question.question ? { ...q, userNote: note } : q;
      setQuestionQueue((prev) => prev.map(updater));
      setMissedQuestions((prev) => prev.map(updater));
      setFlaggedQuestions((prev) => prev.map(updater));
    },
    [setQuestionQueue, setMissedQuestions, setFlaggedQuestions]
  );

  const handleRemoveBookmark = useCallback(
    (question: QuizQuestion) => {
      const updater = (q: QuizQuestion) =>
        q.question === question.question ? { ...q, isBookmarked: false } : q;
      setQuestionQueue((prev) => prev.map(updater));
      setMissedQuestions((prev) => prev.map(updater));
      setFlaggedQuestions((prev) => prev.map(updater));
    },
    [setQuestionQueue, setMissedQuestions, setFlaggedQuestions]
  );

  const clearPerformanceData = useCallback(() => setPerformanceData([]), [setPerformanceData]);
  const clearMissedQuestionsData = useCallback(() => setMissedQuestions([]), [setMissedQuestions]);
  const clearFlaggedQuestionsData = useCallback(
    () => setFlaggedQuestions([]),
    [setFlaggedQuestions]
  );

  const handleConfirmSession = useCallback(
    async (settings: SessionSettings, preloadedQueue?: QuizQuestion[]) => {
      setIsModalOpen(false);
      setSessionSettings(settings);
      setError(null);
      initializeSession();
      if (preloadedQueue && preloadedQueue.length > 0) {
        setQuestionQueue(preloadedQueue);
        setView('quiz');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        if (settings.focus === 'review' || settings.focus === 'due') {
          const today = new Date().toISOString().split('T')[0] ?? '';
          const due = missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today);
          if (due.length === 0) {
            setError(
              'No questions due for review right now. Check back later or start a general session.'
            );
            return;
          }
          const token = await getToken();
          try {
            const dueItems = due
              .map((q) => ({
                conditionId: q.conditionId ?? '',
                taskType: q.taskType ?? null,
                originalQuestionId: q.id ?? (q as { questionId?: string }).questionId ?? '',
              }))
              .filter((d) => d.conditionId);
            if (dueItems.length === 0) {
              setError(
                'Due review requires concept data for each item. No variants can be loaded.'
              );
              setQuestionQueue([]);
              return;
            }
            const res = token
              ? await fetch('/api/questions/due-siblings', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ dueItems }),
                })
              : null;
            const json: unknown = res?.ok ? await res.json().catch(() => null) : null;
            const data = json as { data?: { results?: unknown } } | null;
            const results = data?.data?.results as
              | Array<{
                  question: {
                    id: string;
                    question: string;
                    vignette?: string;
                    options: string[];
                    correctAnswerIndex: number;
                    rationale: string;
                    system: string;
                    conditionId?: string;
                    condition?: string;
                  } | null;
                  dueConceptKey: { conditionId: string; taskType: string | null };
                }>
              | undefined;
            // Variant-only: only add questions when we have a sibling/variant (never the original) to test retention, not recognition.
            const queue: QuizQuestion[] = (results ?? [])
              .filter(
                (r): r is typeof r & { question: NonNullable<typeof r.question> } =>
                  r.question != null
              )
              .map((r) => {
                const key = r.dueConceptKey;
                const q = r.question;
                return {
                  id: q.id,
                  question: q.vignette ? `${q.vignette}\n\n${q.question}` : q.question,
                  options: q.options,
                  correctAnswerIndex: q.correctAnswerIndex,
                  rationale: q.rationale,
                  system: q.system,
                  conditionId: key.conditionId,
                  condition: q.condition ?? '',
                  topic: q.system,
                  dueConceptKey: key,
                } as QuizQuestion;
              });
            if (queue.length === 0) {
              setError(
                'No variants available for your due concepts right now. Try a general session or come back later.'
              );
              setQuestionQueue([]);
              return;
            }
            setQuestionQueue(queue);
            setView('quiz');
          } catch {
            setError('Could not load due variants. Try again or start a general session.');
            setQuestionQueue([]);
            return;
          }
        } else if (settings.focus === 'reviewFlagged') {
          if (flaggedQuestions.length === 0) {
            setError(
              'You have no flagged questions. Flag questions during a session to review them here.'
            );
            return;
          }
          const token = await getToken();
          const dueItems = flaggedQuestions
            .map((q) => ({
              conditionId: q.conditionId ?? '',
              taskType: q.taskType ?? null,
              originalQuestionId: q.id ?? (q as { questionId?: string }).questionId ?? '',
            }))
            .filter((d) => d.conditionId && d.originalQuestionId);
          if (token && dueItems.length > 0) {
            try {
              const res = await fetch('/api/questions/due-siblings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ dueItems }),
              });
              const json = (await res.json().catch(() => null)) as {
                data?: {
                  results?: Array<{
                    question: {
                      id: string;
                      question: string;
                      vignette?: string;
                      options: string[];
                      correctAnswerIndex: number;
                      rationale: string;
                      system: string;
                      conditionId?: string;
                      condition?: string;
                    } | null;
                    dueConceptKey: { conditionId: string; taskType: string | null };
                  }>;
                };
              };
              const results = json?.data?.results ?? [];
              const resultByOriginalId = new Map<string, (typeof results)[0]>();
              dueItems.forEach((d, i) => {
                resultByOriginalId.set(d.originalQuestionId, results[i]);
              });
              const queue: QuizQuestion[] = flaggedQuestions.map((original) => {
                const r = resultByOriginalId.get(original.id ?? (original as { questionId?: string }).questionId ?? '');
                if (r?.question != null) {
                  const key = r.dueConceptKey;
                  const q = r.question;
                  return {
                    id: q.id,
                    question: q.vignette ? `${q.vignette}\n\n${q.question}` : q.question,
                    options: q.options,
                    correctAnswerIndex: q.correctAnswerIndex,
                    rationale: q.rationale,
                    system: q.system,
                    conditionId: key.conditionId,
                    condition: q.condition ?? '',
                    topic: q.system,
                    dueConceptKey: key,
                  } as QuizQuestion;
                }
                return {
                  ...original,
                  question: original.vignette
                    ? `${original.vignette}\n\n${original.question}`
                    : original.question,
                  correctAnswerIndex:
                    original.correctAnswerIndex ?? (original as { correctIndex?: number }).correctIndex ?? 0,
                } as QuizQuestion;
              });
              if (queue.length > 0) {
                setQuestionQueue(queue);
                setView('quiz');
                setIsLoading(false);
                return;
              }
            } catch {
              // Fall through to use originals
            }
          }
          setQuestionQueue(flaggedQuestions as QuizQuestion[]);
          setView('quiz');
        } else {
          const token = await getToken();
          let initialQuestions: QuizQuestion[];
          try {
            if (token) {
              const result = await fetchSessionQuestions(settings, token, INITIAL_QUEUE_SIZE);
              initialQuestions = result.questions as QuizQuestion[];
            } else {
              initialQuestions = await getQuestionBatch(
                settings,
                growthAreas,
                INITIAL_QUEUE_SIZE,
                getToken
              );
            }
          } catch {
            initialQuestions = await getQuestionBatch(
              settings,
              growthAreas,
              INITIAL_QUEUE_SIZE,
              getToken
            );
          }
          if (initialQuestions.length === 0) {
            setError(
              'No questions available for your selection. Try adjusting focus or try again later.'
            );
            return;
          }
          setQuestionQueue(initialQuestions);
          setView('quiz');
          // Prefetch next batch in background so replenishment is faster
          void prefetchQuestions(settings, token ?? null, 10).catch(() => {});
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to start session. Please try again in a moment.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [missedQuestions, flaggedQuestions, growthAreas, getToken]
  );

  const handleTrainingMenuStart = useCallback(
    (modeId: string, focus?: SimulationFocus) => {
      let sessionFocus: SessionSettings['focus'] = 'all';
      if (focus === 'flagged') sessionFocus = 'reviewFlagged';
      else if (focus === 'due') sessionFocus = 'review';
      else if (focus === 'growth') sessionFocus = 'growth';
      handleConfirmSession({
        focus: sessionFocus,
        count: INITIAL_QUEUE_SIZE,
      });
    },
    [handleConfirmSession]
  );

  const handleReviewMissed = useCallback(() => {
    handleConfirmSession({
      focus: 'review',
      mode: sessionSettings?.mode ?? 'core_adaptive',
    });
    setQuizKey((k) => k + 1);
  }, [handleConfirmSession, sessionSettings?.mode]);

  const handleStartSession = useCallback(
    (settings?: SessionSettings) => {
      if (settings && typeof settings === 'object' && 'focus' in settings) {
        handleConfirmSession(settings);
      } else {
        setIsModalOpen(true);
      }
    },
    [handleConfirmSession]
  );

  const handleEndSession = useCallback(() => {
    setView('command_center');
    setSessionSettings(null);
    setQuestionQueue([]);
  }, []);

  const handleBackToQuiz = useCallback(() => {
    if (questionQueue.length > 0 && sessionSettings) {
      setView('quiz');
    } else {
      setIsModalOpen(true);
    }
  }, [questionQueue.length, sessionSettings]);

  const hasActiveSession = !!sessionSettings && questionQueue && questionQueue.length > 0;

  const syncOnboardingCompleteToServer = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hasCompletedOnboarding: true }),
      });
    } catch {
      // Non-blocking: localStorage already set; server sync best-effort
    }
  }, [getToken]);

  const handleOnboardingComplete = useCallback(
    (profile: UserProfile) => {
      saveUserProfile(profile);
      void syncOnboardingCompleteToServer();
      setOnboardingStep('baseline');
    },
    [syncOnboardingCompleteToServer]
  );

  const handleOnboardingSkip = useCallback(() => {
    saveUserProfile({ hasCompletedOnboarding: true });
    void syncOnboardingCompleteToServer();
    setOnboardingWeakestSystems([]);
    setOnboardingStep('your_plan');
  }, [syncOnboardingCompleteToServer]);

  const handleBaselineComplete = useCallback((results: { weakestSystems: string[] }) => {
    setOnboardingWeakestSystems(results.weakestSystems ?? []);
    setOnboardingStep('your_plan');
  }, []);

  const handleBaselineSkip = useCallback(() => {
    setOnboardingWeakestSystems([]);
    setOnboardingStep('your_plan');
  }, []);

  const handleYourPlanStartSession = useCallback(() => {
    setIsOnboardingModalOpen(false);
    setOnboardingStep(null);
    setIsModalOpen(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem('hasSeenAIPrompt')) {
      setShowProTip(true);
    }
  }, []);

  const handleYourPlanSkip = useCallback(() => {
    setIsOnboardingModalOpen(false);
    setOnboardingStep(null);
    setShowProductTour(productTourShouldShow);
    if (typeof window !== 'undefined' && !window.localStorage.getItem('hasSeenAIPrompt')) {
      setShowProTip(true);
    }
  }, [productTourShouldShow]);

  // Fetch exam date when showing "Your plan" step
  useEffect(() => {
    if (onboardingStep !== 'your_plan') return;
    let cancelled = false;
    getToken()
      .then((token) => {
        if (!token || cancelled) return;
        return fetch('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((value: unknown) => {
        const data = value as { data?: { profile?: { examDate?: string | null } } } | null;
        if (!cancelled && data?.data?.profile?.examDate)
          setOnboardingExamDate(data.data.profile.examDate);
      })
      .catch((e) => {
        if (!cancelled) {
          console.warn('[Onboarding] Exam date fetch failed', e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onboardingStep, getToken]);

  // Handler for navigating to drill modes with dedicated routes
  // Memoized to prevent unnecessary child re-renders
  const handleNavigateToDrillMode = useCallback((modeId: string) => {
    // First, try dedicated route navigation so /practice cards actually change page
    const modeConfig = TRAINING_MODES.find((m) => m.id === modeId);
    if (modeConfig?.route && modeConfig.route.startsWith('/')) {
      navigate(modeConfig.route);
      return;
    }

    setInitialDrillSystem(null);
    const modeViewMap: Record<string, View> = {
      [DRILL_MODE_PHOTO]: 'photo_drill',
      [DRILL_MODE_ECG]: 'ecg_drill',
      [DRILL_MODE_DERM]: 'derm_drill',
      [DRILL_MODE_IMAGING]: 'imaging_drill',
      [DRILL_MODE_RAPID_RECALL]: 'rapid_recall',
      [DRILL_MODE_DDX_COMPARE]: 'ddx_compare',
      [DRILL_MODE_MINI_LAB]: 'mini_lab',
      [DRILL_MODE_PHARMACOLOGY]: 'pharmacology',
      [DRILL_MODE_FIRST_LINE]: 'first_line_treatment',
      [DRILL_MODE_CONDITION]: 'condition_drill',
      [DRILL_MODE_SYSTEM]: 'system_drill',
      [DRILL_MODE_SUBCATEGORY]: 'subcategory_drill',
      [DRILL_MODE_GUIDELINE]: 'guideline_drill',
      [DRILL_MODE_FLUID_ELECTROLYTE]: 'fluid_electrolyte',
      [DRILL_MODE_ANTIBIOTIC]: 'antibiotic_mode',
      [DRILL_MODE_PATIENT_ENCOUNTER]: 'patient_encounter',
      [DRILL_MODE_CODE_BLUE]: 'code_blue_speed',
      [DRILL_MODE_GRAND_ROUNDS]: 'grand_rounds',
      panre_la: 'panre_la',
      [DRILL_MODE_VENTILATOR]: 'ventilator_hero',
      [DRILL_MODE_PHYSIOLOGY]: 'physiology_drill',
      [DRILL_MODE_ANATOMY]: 'anatomy_review',
      [DRILL_MODE_CONTRASTIVE]: 'contrastive_drill',
      reasoning_tutor: 'reasoning_tutor',
      [DRILL_MODE_CRAM]: 'cram_mode',
      [DRILL_MODE_COMMUTER]: 'commuter_mode',
      polypharmacy_puzzle: 'polypharmacy_puzzle',
      medical_wordle: 'medical_wordle',
      diagnostic_puzzle: 'diagnostic_puzzle',
      admin_media: 'admin_media',
      toolkit: 'toolkit',
    };
    const targetView = modeViewMap[modeId];
    if (targetView) setView(targetView);
  }, []);

  const handleNavigateToModeRoute = useCallback(
    (route: string, modeId: string) => {
      // If route is a dedicated path (starts with '/'), navigate using React Router
      if (route.startsWith('/')) {
        navigate(route);
        return;
      }
      // Otherwise fall back to view-based navigation
      handleNavigateToDrillMode(modeId);
    },
    [navigate, handleNavigateToDrillMode]
  );

  const _handleNavigateToDrillWithSystem = useCallback((modeId: string, system: string) => {
    setInitialDrillSystem(system);
    const modeViewMap: Record<string, View> = {
      [DRILL_MODE_SYSTEM]: 'system_drill',
    };
    const targetView = modeViewMap[modeId];
    if (targetView) setView(targetView);
  }, []);

  // Navigate to simulation page - memoized
  const [simulationInitialFocus, setSimulationInitialFocus] = useState<SimulationFocus>('all');
  const [initialDrillSystem, setInitialDrillSystem] = useState<string | null>(null);

  const handleNavigateToSimulation = useCallback(
    (settings?: { initialFocus?: SimulationFocus }) => {
      if (settings?.initialFocus) {
        setSimulationInitialFocus(settings.initialFocus);
      } else {
        setSimulationInitialFocus('all');
      }
      setView('simulation_page');
    },
    []
  );

  // Navigate to command center page - memoized
  const _handleNavigateToCommandCenter = useCallback(() => {
    setView('command_center_page');
  }, []);

  // Navigate to custom study mode - memoized
  const handleNavigateToCustomStudy = useCallback(() => {
    setView('custom_study');
  }, []);

  // Navigate to study path dashboard - memoized
  const handleNavigateToStudyPathDashboard = useCallback(() => {
    setView('study_path_dashboard');
  }, []);

  const pageTransition = useAccessibleTransition({
    duration: 0.25,
    ease: [0.32, 0.72, 0, 1] as const, // Snappy ease-out
  });

  // Show loading state while checking auth (with timeout and guest mode)
  if (authIsLoading || (!authLoaded && !isGuestMode)) {
    return <Loader message="Authenticating..." />;
  }

  // Show landing page for unauthenticated users (not in guest mode)
  if (!isSignedIn && !isGuestMode) {
    return <LandingPage />;
  }

  // If we're in guest mode, show a guest mode banner
  const showGuestModeBanner = isGuestMode;

  // Main authenticated app (or guest mode)
  return (
    <SystemIntegrationProvider>
      <ToastProvider>
        <CommuterProvider>
          {/* Sonner toast notifications */}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
              className: 'sonner-toast',
            }}
          />
          <div className="min-h-screen bg-[var(--color-canvas,#F8FAFC)] dark:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
            {/* Guest mode banner */}
            {showGuestModeBanner && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-800 dark:text-amber-300">
                      You're in <strong>Guest Mode</strong>. Some features are limited.
                    </span>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline"
                  >
                    Try signing in again
                  </button>
                </div>
              </div>
            )}

            {/* Loading Progress Bar */}
            <LoadingProgress isLoading={isLoading} />

            <Routes>
              <Route
                path="/practice"
                element={
                  <Suspense fallback={<Loader message="Loading practice modes..." />}>
                    <PracticePage
                      onNavigateToDrillMode={handleNavigateToDrillMode}
                      onNavigateToDrillWithSystem={_handleNavigateToDrillWithSystem}
                    />
                  </Suspense>
                }
              />
              <Route
                path="/progress"
                element={
                  <Suspense fallback={<Loader message="Loading analytics..." />}>
                    <ProgressPage
                      performanceData={heatmapPerformance}
                      dueCount={dueQuestionsCount}
                    />
                  </Suspense>
                }
              />
              <Route
                path="/daily-challenges"
                element={
                  <Suspense fallback={<Loader message="Loading daily challenges..." />}>
                    <DailyChallengesHub />
                  </Suspense>
                }
              />
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<Loader message="Loading admin…" />}>
                    <AdminDashboard onClose={() => navigate('/')} />
                  </Suspense>
                }
              />
              <Route
                path="/admin/refinery"
                element={
                  <Suspense fallback={<Loader message="Loading refinery…" />}>
                    <RefineryPage onClose={() => navigate('/')} />
                  </Suspense>
                }
              />
              <Route
                path="/admin/taxonomies"
                element={
                  <Suspense fallback={<Loader message="Loading taxonomies…" />}>
                    <TaxonomiesPage />
                  </Suspense>
                }
              />
              <Route
                path="/admin/system-mappings"
                element={
                  <Suspense fallback={<Loader message="Loading system mappings…" />}>
                    <SystemMappingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/admin/question-generator"
                element={
                  <Suspense fallback={<Loader message="Loading question generator…" />}>
                    <QuestionGeneratorPage />
                  </Suspense>
                }
              />
              <Route
                path="/clinical-eye"
                element={
                  <Suspense fallback={<Loader message="Loading Clinical Eye…" />}>
                    <ClinicalEyePage onBack={() => navigate('/')} />
                  </Suspense>
                }
              />
              <Route
                path="/visualizer"
                element={
                  <Suspense fallback={<Loader message="Loading visualizer…" />}>
                    <VisualizerPage onBack={() => navigate('/')} />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <>
                    {showNotFound ? (
                      <React.Fragment key="not-found">
                        <NotFoundPage
                          currentPath={location.pathname}
                          onGoToDashboard={() => navigate(ROUTES.STUDY)}
                          onNavigateToPractice={() => navigate(ROUTES.PRACTICE)}
                          onNavigateToKnowledge={() => navigate(ROUTES.STUDY_KNOWLEDGE)}
                        />
                      </React.Fragment>
                    ) : (
                      <React.Fragment key="main">
                        {/* Skip to Main Content - hidden until focused via keyboard (screen reader + a11y) */}
                        <a
                          href="#main-content"
                          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-accent)] focus-visible:text-[var(--color-text-inverse)] focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
                        >
                          Skip to main content
                        </a>
                        {/* Header - fixed height so NavRail (sidebar) starts below it; z-50 above rail */}
                        <header
                          className="sticky top-0 z-50 h-16 shrink-0 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] transition-all duration-300 shadow-sm backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
                          style={{ height: 'var(--header-height, 4rem)' }}
                        >
                          <div className="h-full w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[100vw]">
                            <AppBrand
                              size="sm"
                              asLink
                              onClick={() => {
                                navigate(ROUTES.STUDY);
                                setView('command_center');
                              }}
                            >
                              <OfflineSyncIndicator />
                              <Link
                                to={ROUTES.ADMIN}
                                className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                                aria-label="Admin Dashboard"
                              >
                                <Shield className="w-5 h-5" />
                              </Link>
                              <motion.button
                                ref={settingsButtonRef}
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                                aria-label="Settings and Stats"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Settings className="w-5 h-5" />
                              </motion.button>
                              <MasteryHeatmapToggle compact className="hidden sm:inline-flex" />
                              <button
                                type="button"
                                onClick={() => setIsHelpModalOpen(true)}
                                className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 bg-[var(--color-bg-secondary)] hover:bg-slate-100 dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] border border-[var(--color-border)] dark:border-transparent dark:hover:border-[var(--color-border)] transition-colors duration-200 shadow-sm"
                                aria-label="Help and getting started"
                              >
                                <HelpCircle className="w-5 h-5" />
                              </button>
                              <ThemeToggleButton />
                            </AppBrand>
                          </div>
                        </header>

                        {/* Settings/Stats Modal */}
                        <Suspense fallback={null}>
                          <SettingsStatsModal
                            isOpen={isSettingsModalOpen}
                            onClose={() => {
                              setIsSettingsModalOpen(false);
                              requestAnimationFrame(() => {
                                settingsButtonRef.current?.focus?.();
                              });
                            }}
                            performanceData={performanceData}
                            clearPerformanceData={clearPerformanceData}
                            clearMissedQuestionsData={clearMissedQuestionsData}
                            clearFlaggedQuestionsData={clearFlaggedQuestionsData}
                            missedQuestionsCount={missedQuestions.length}
                            flaggedQuestionsCount={flaggedQuestions.length}
                            isSyncing={isSyncing}
                            lastSyncTime={lastSyncTime}
                            syncError={syncError}
                            isLoadingStats={isStatsLoading}
                            theme={theme}
                            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            onStartFirstSession={() => {
                              setIsSettingsModalOpen(false);
                              setIsModalOpen(true);
                            }}
                          />
                        </Suspense>

                        {/* Keyboard Shortcuts Modal */}
                        <Suspense fallback={null}>
                          <KeyboardShortcutsModal
                            isOpen={isShortcutsModalOpen}
                            onClose={() => setIsShortcutsModalOpen(false)}
                          />
                        </Suspense>

                        {/* Help / Getting started modal */}
                        {isHelpModalOpen && (
                          <div
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm"
                            onClick={() => setIsHelpModalOpen(false)}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="help-modal-title"
                          >
                            <div
                              className="bg-[var(--color-bg-primary)] rounded-2xl shadow-xl border border-[var(--color-border)] max-w-md w-full p-6"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <h2
                                  id="help-modal-title"
                                  className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2"
                                >
                                  <HelpCircle className="w-5 h-5 text-[var(--color-accent)]" />
                                  Getting started
                                </h2>
                                <button
                                  type="button"
                                  onClick={() => setIsHelpModalOpen(false)}
                                  className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                  aria-label="Close"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                              <ul className="space-y-3 text-[var(--color-text-secondary)] text-sm mb-6">
                                <li>
                                  <strong className="text-[var(--color-text-primary)]">Start a session</strong> — From the dashboard, click &quot;Start practice session&quot; or open the Practice tab to choose a mode.
                                </li>
                                <li>
                                  <strong className="text-[var(--color-text-primary)]">Command palette</strong> — Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-xs">⌘K</kbd> (or Ctrl+K) to jump to any mode or page.
                                </li>
                                <li>
                                  <strong className="text-[var(--color-text-primary)]">Grand Rounds</strong> — Try the daily challenge from Practice or the dashboard.
                                </li>
                                <li>
                                  <strong className="text-[var(--color-text-primary)]">Toolkit</strong> — Use the Tools tab for calculators, generators, and reference tools.
                                </li>
                              </ul>
                              <button
                                type="button"
                                onClick={() => setIsHelpModalOpen(false)}
                                className="w-full py-2.5 px-4 rounded-xl font-medium bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90 transition-opacity"
                              >
                                Got it
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Full-screen views that break out of max-w-4xl constraint */}
                        {view === 'reference_library' && (
                          <div
                            className="w-full min-w-0 overflow-hidden flex-1"
                            style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                          >
                            <Suspense fallback={<Loader message="Loading knowledge base…" />}>
                              <KnowledgeBaseHub
                                onClose={() => {
                                  setView('command_center');
                                  navigate('/study');
                                }}
                              />
                            </Suspense>
                          </div>
                        )}

                        {view === 'my_library' && (
                          <div
                            className="w-full min-w-0 overflow-hidden flex-1"
                            style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                          >
                            <Suspense fallback={<Loader message="Loading library…" />}>
                              <MyLibraryPage onExit={() => setView('command_center')} />
                            </Suspense>
                          </div>
                        )}

                        {view === 'pearl_deck' && (
                          <div
                            className="w-full min-w-0 overflow-hidden flex-1"
                            style={{ marginLeft: 'var(--nav-rail-width, 56px)' }}
                          >
                            <Suspense fallback={<Loader message="Loading pearl deck…" />}>
                              <MyPearlsPanel
                                onClose={() => setView('command_center')}
                                initialFilter="saved"
                              />
                            </Suspense>
                          </div>
                        )}

                        {/* Glassmorphism quick-actions rail (persists across study views) */}
                        <NavRail />

                        {/* Standard views with max-w-4xl constraint */}
                        {view !== 'reference_library' &&
                          view !== 'my_library' &&
                          view !== 'pearl_deck' && (
                            <main
                              id="main-content"
                              className="main-content-area min-h-screen min-w-0 max-w-full overflow-visible transition-all duration-300"
                              style={{
                                marginLeft: 'var(--nav-rail-width, 56px)',
                                paddingTop: 'var(--header-height, 4rem)',
                              }}
                            >
                              <div
                                className={`mx-auto min-w-0 max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8 ${view === 'command_center' || view === 'menu' ? 'max-w-6xl' : 'max-w-4xl'}`}
                              >
                                {isLoading &&
                                  (sessionSettings ? (
                                    <DrillLoadingState
                                      message="Loading questions…"
                                      variant="question"
                                      showTimer={false}
                                    />
                                  ) : (
                                    <Loader
                                      message="Loading questions…"
                                      forceDark={view === 'imaging_drill'}
                                    />
                                  ))}
                                {error && (
                                  <EnhancedErrorMessage
                                    title="Session Error"
                                    description={error}
                                    severity="error"
                                    category="system"
                                    dismissible
                                    onDismiss={() => setError(null)}
                                    showRetry={false}
                                    className="mb-4"
                                  />
                                )}

                                {/* Removed mode="wait" to allow overlapping transitions for faster perceived navigation */}
                                <AnimatePresence>
                                  {view === 'command_center' && (
                                    <motion.div
                                      key="command_center"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense fallback={<CommandCenterSkeleton />}>
                                        <CommandCenterHub
                                          performanceData={heatmapPerformance}
                                          missedQuestions={missedQuestions}
                                          flaggedQuestions={flaggedQuestions}
                                          dueCount={dueQuestionsCount}
                                          isLoadingStats={isStatsLoading}
                                          initialStudyToolsTab={commandCenterInitialTab}
                                          onOpenSettings={() => setIsSettingsModalOpen(true)}
                                          onStartSession={handleStartSession}
                                          onNavigateToDrillMode={handleNavigateToDrillMode}
                                          onNavigateToDrillWithSystem={
                                            _handleNavigateToDrillWithSystem
                                          }
                                          onNavigateToToolkit={() => navigate(ROUTES.STUDY_TOOLKIT)}
                                          onNavigateToGapAnalysis={() =>
                                            startViewTransition(() => setView('gap_analysis'))
                                          }
                                          onNavigateToClinicalProfile={() =>
                                            setView('clinical_profile')
                                          }
                                          onNavigateToIntegrations={() => setView('integrations')}
                                          onNavigateToSimulation={handleNavigateToSimulation}
                                          onNavigateToReference={() =>
                                            navigate(ROUTES.STUDY_REFERENCE)
                                          }
                                          onNavigateToMyLibrary={() => setView('my_library')}
                                          onNavigateToCustomStudy={handleNavigateToCustomStudy}
                                          onNavigateToTutorChat={() => setView('tutor_chat')}
                                          onNavigateToStudyCompanion={() =>
                                            setView('study_companion')
                                          }
                                          // Canonical FSRS flow is main session (QuizView) MC only; due = variants in same session. SRS Flashcards view hidden.
                                          onNavigateToPearlDeck={() => setView('pearl_deck')}
                                          onNavigateToStudyPathDashboard={handleNavigateToStudyPathDashboard}
                                          growthAreas={growthAreas}
                                          examLabel={examLabel ?? 'PANCE'}
                                          hasActiveSession={hasActiveSession}
                                          onResumeSession={handleBackToQuiz}
                                          resumeContext={
                                            hasActiveSession &&
                                            sessionSettings?.count != null &&
                                            sessionSettings.count > 0 &&
                                            questionQueue.length > 0
                                              ? {
                                                  remaining: questionQueue.length,
                                                  total: sessionSettings.count,
                                                  current: Math.max(
                                                    1,
                                                    sessionSettings.count - questionQueue.length + 1
                                                  ),
                                                }
                                              : undefined
                                          }
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}

                                  {view === 'menu' && (
                                    <motion.div
                                      key="menu"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense fallback={<Loader message="Loading menu…" />}>
                                        <MenuView
                                          performanceData={heatmapPerformance}
                                          missedQuestions={missedQuestions}
                                          flaggedQuestions={flaggedQuestions}
                                          onBackToQuiz={handleBackToQuiz}
                                          hasActiveSession={hasActiveSession}
                                          setIsLoading={setIsLoading}
                                          setError={setError}
                                          onStartSession={handleStartSession}
                                          onConfirmSession={handleConfirmSession}
                                          onRemoveBookmark={handleRemoveBookmark}
                                          growthAreas={growthAreas}
                                          onNavigateToDrillMode={handleNavigateToDrillMode}
                                          onNavigateToIntegrations={() => setView('integrations')}
                                          // HIDDEN: Social feature disabled until API implemented
                                          // onNavigateToSocial={() => setView('social_dashboard')}
                                          onNavigateToToolkit={() => navigate(ROUTES.STUDY_TOOLKIT)}
                                          onNavigateToGapAnalysis={() =>
                                            startViewTransition(() => setView('gap_analysis'))
                                          }
                                          onNavigateToSimulation={handleNavigateToSimulation}
                                          isSyncing={isSyncing}
                                          lastSyncTime={lastSyncTime}
                                          syncError={syncError}
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}

                                  {view === 'quiz' && sessionSettings && (
                                    <motion.div
                                      key={`quiz-${quizKey}`}
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="quiz"
                                        onRetry={() => setView('quiz')}
                                      >
                                        <Suspense fallback={<Loader message="Loading session…" />}>
                                          <BehavioralTrackerProvider>
                                            <QuizViewWithErrorBoundary
                                              modeLabel="Practice → Adaptive Questions"
                                              initialQueue={questionQueue}
                                              setParentQueue={setQuestionQueue}
                                              addPerformanceRecord={addPerformanceRecord}
                                              addMissedQuestion={addMissedQuestion}
                                              updateReviewQuestion={updateReviewQuestion}
                                              removeDueConcept={removeDueConcept}
                                              updateLastPerformanceErrorTag={
                                                updateLastPerformanceErrorTag
                                              }
                                              setIsLoading={setIsLoading}
                                              setError={setError}
                                              sessionSettings={sessionSettings}
                                              growthAreas={growthAreas}
                                              onEndSession={handleEndSession}
                                              onShowMenu={() => setView('command_center')}
                                              performanceData={performanceData}
                                              fontSizeAdjustment={fontSizeAdjustment}
                                              setFontSizeAdjustment={setFontSizeAdjustment}
                                              flaggedQuestions={flaggedQuestions}
                                              addFlaggedQuestion={addFlaggedQuestion}
                                              removeFlaggedQuestion={removeFlaggedQuestion}
                                              updateQuestionNote={updateQuestionNote}
                                              onReviewMissed={
                                                performanceData.some((p) => !p.isCorrect)
                                                  ? handleReviewMissed
                                                  : undefined
                                              }
                                            />
                                          </BehavioralTrackerProvider>
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'session_runner' && (
                                    <WithGeminiErrorBoundary
                                      viewName="session_runner"
                                      onRetry={() => setView('session_runner')}
                                    >
                                      <Suspense fallback={<Loader message="Loading session…" />}>
                                        <SessionRunner
                                          onExit={() => setView('command_center')}
                                          addPerformanceRecord={addPerformanceRecord}
                                          addMissedQuestion={addMissedQuestion}
                                          updateReviewQuestion={updateReviewQuestion}
                                          removeDueConcept={removeDueConcept}
                                          updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
                                          performanceData={performanceData}
                                          fontSizeAdjustment={fontSizeAdjustment}
                                          setFontSizeAdjustment={setFontSizeAdjustment}
                                          flaggedQuestions={flaggedQuestions}
                                          addFlaggedQuestion={addFlaggedQuestion}
                                          removeFlaggedQuestion={removeFlaggedQuestion}
                                          updateQuestionNote={updateQuestionNote}
                                        />
                                      </Suspense>
                                    </WithGeminiErrorBoundary>
                                  )}

                                  <DrillViewRouter
                                    view={view}
                                    setView={setView}
                                    addPerformanceRecord={addPerformanceRecord}
                                    addMissedQuestion={addMissedQuestion}
                                    updateReviewQuestion={updateReviewQuestion}
                                    updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
                                    performanceData={performanceData}
                                    fontSizeAdjustment={fontSizeAdjustment}
                                    setFontSizeAdjustment={setFontSizeAdjustment}
                                    flaggedQuestions={flaggedQuestions}
                                    addFlaggedQuestion={addFlaggedQuestion}
                                    removeFlaggedQuestion={removeFlaggedQuestion}
                                    updateQuestionNote={updateQuestionNote}
                                    initialDrillSystem={initialDrillSystem}
                                    missedQuestions={missedQuestions}
                                  />

                                  {view === 'toolkit' && (
                                    <motion.div
                                      key="toolkit"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="toolkit"
                                        onRetry={() => setView('toolkit')}
                                      >
                                        <Suspense fallback={<Loader message="Loading toolkit…" />}>
                                          <ToolkitHub
                                            onClose={() => {
                                              navigate(ROUTES.STUDY);
                                              setView('command_center');
                                            }}
                                            onNavigateToItem={handleNavigateToDrillMode}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'gap_analysis' && (
                                    <motion.div
                                      key="gap_analysis"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="gap_analysis"
                                        onRetry={() => setView('gap_analysis')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <GapAnalysisDashboard
                                            onStudySystem={(systemName: string) => {
                                              setView('command_center');
                                              handleConfirmSession({
                                                focus: 'topic',
                                                topic: systemName,
                                                count: INITIAL_QUEUE_SIZE,
                                              });
                                            }}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'clinical_profile' && (
                                    <motion.div
                                      key="clinical_profile"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="clinical_profile"
                                        onRetry={() => setView('clinical_profile')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <ClinicalProfileDashboard />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'training_menu' && (
                                    <motion.div
                                      key="training_menu"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="training_menu"
                                        onRetry={() => setView('training_menu')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <TrainingMenu
                                            onClose={() => setView('command_center')}
                                            onNavigateToMode={(route, mode) =>
                                              handleNavigateToModeRoute(route, mode.id)
                                            }
                                            onStartSession={handleTrainingMenuStart}
                                            dueQuestionsCount={dueQuestionsCount}
                                            flaggedQuestionsCount={flaggedQuestions.length}
                                            growthAreasCount={growthAreas.length}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'simulation_page' && (
                                    <motion.div
                                      key="simulation_page"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="simulation_page"
                                        onRetry={() => setView('simulation_page')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <SimulationPage
                                            onStartSession={handleConfirmSession}
                                            onBack={() => setView('command_center')}
                                            performanceData={heatmapPerformance}
                                            flaggedQuestions={flaggedQuestions}
                                            growthAreas={growthAreas}
                                            examLabel={examLabel ?? 'PANCE'}
                                            initialFocus={simulationInitialFocus}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'command_center_page' && (
                                    <motion.div
                                      key="command_center_page"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="command_center_page"
                                        onRetry={() => setView('command_center_page')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <CommandCenterPage
                                            performanceData={heatmapPerformance}
                                            missedQuestions={missedQuestions}
                                            flaggedQuestions={flaggedQuestions}
                                            growthAreas={growthAreas}
                                            dueCount={dueQuestionsCount}
                                            examLabel={examLabel ?? 'PANCE'}
                                            onStartSession={handleStartSession}
                                            onNavigateToDrillMode={handleNavigateToDrillMode}
                                            onNavigateToToolkit={() =>
                                              navigate(ROUTES.STUDY_TOOLKIT)
                                            }
                                            onNavigateToGapAnalysis={() =>
                                              startViewTransition(() => setView('gap_analysis'))
                                            }
                                            onNavigateToIntegrations={() => setView('integrations')}
                                            onNavigateToReference={() =>
                                              navigate(ROUTES.STUDY_REFERENCE)
                                            }
                                            onNavigateToMyLibrary={() => setView('my_library')}
                                            onNavigateToStudyCompanion={() =>
                                              setView('study_companion')
                                            }
                                            // Canonical FSRS flow is main session (QuizView) MC only; due = variants in same session. SRS Flashcards view hidden.
                                            onBack={() => setView('command_center')}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'custom_study' && (
                                    <motion.div
                                      key="custom_study"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="custom_study"
                                        onRetry={() => setView('custom_study')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <CustomStudyMode
                                            onBack={() => setView('command_center')}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'study_path_dashboard' && (
                                    <motion.div
                                      key="study_path_dashboard"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="study_path_dashboard"
                                        onRetry={() => setView('study_path_dashboard')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <StudyPathDashboard />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'tutor_chat' && (
                                    <motion.div
                                      key="tutor_chat"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="tutor_chat"
                                        onRetry={() => setView('tutor_chat')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <TutorChatPage onExit={() => setView('command_center')} />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'study_companion' && (
                                    <motion.div
                                      key="study_companion"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <WithGeminiErrorBoundary
                                        viewName="study_companion"
                                        onRetry={() => setView('study_companion')}
                                      >
                                        <Suspense fallback={<Loader />}>
                                          <StudyCompanionPage
                                            onExit={() => setView('command_center')}
                                          />
                                        </Suspense>
                                      </WithGeminiErrorBoundary>
                                    </motion.div>
                                  )}

                                  {view === 'srs_flashcards' && (
                                    <motion.div
                                      key="srs_flashcards"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense fallback={<Loader />}>
                                        <SrsFlashcardView
                                          onExit={() => setView('command_center')}
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}

                                  {view === 'medical_database' && (
                                    <motion.div
                                      key="medical_database"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense
                                        fallback={
                                          <Loader message="Loading medical database search..." />
                                        }
                                      >
                                        <MedicalDatabaseSearch
                                          onClose={() => setView('command_center')}
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}

                                  {view === 'live_collaboration' && (
                                    <motion.div
                                      key="live_collaboration"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense
                                        fallback={
                                          <Loader message="Loading live study session..." />
                                        }
                                      >
                                        <LiveStudySession
                                          onClose={() => setView('command_center')}
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}

                                  {view === 'cross_system_explorer' && (
                                    <motion.div
                                      key="cross_system_explorer"
                                      variants={pageVariants}
                                      initial="initial"
                                      animate="animate"
                                      exit="exit"
                                      transition={pageTransition}
                                    >
                                      <Suspense
                                        fallback={
                                          <Loader message="Loading cross‑system explorer..." />
                                        }
                                      >
                                        <CrossSystemExplorer
                                          onClose={() => setView('command_center')}
                                        />
                                      </Suspense>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </main>
                          )}

                        {/* Command Palette */}
                        <Suspense fallback={null}>
                          <CommandPalette
                            isOpen={isCommandPaletteOpen}
                            onClose={() => setIsCommandPaletteOpen(false)}
                            onNavigate={handleNavigateToDrillMode}
                            onNavigatePath={(path) => navigate(path)}
                          />
                        </Suspense>

                        {/* Global Session Setup Modal */}
                        <AnimatePresence>
                          {isModalOpen && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
                              onClick={() => setIsModalOpen(false)}
                            >
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ duration: 0.2 }}
                                className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] p-4 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between mb-6">
                                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                                    Training Command Center
                                  </h2>
                                  <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                                    aria-label="Close modal"
                                  >
                                    <X className="w-6 h-6" />
                                  </button>
                                </div>
                                <Suspense fallback={<Loader />}>
                                  <TrainingMenu
                                    onStartSession={handleTrainingMenuStart}
                                    onNavigateToMode={(route, mode) => {
                                      setIsModalOpen(false);
                                      handleNavigateToModeRoute(route, mode.id);
                                    }}
                                    onClose={() => setIsModalOpen(false)}
                                    dueQuestionsCount={dueQuestionsCount}
                                    flaggedQuestionsCount={flaggedQuestions.length}
                                    growthAreasCount={growthAreas.length}
                                  />
                                </Suspense>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Onboarding: Profile → Baseline (optional) → Your plan */}
                        <Suspense fallback={null}>
                          {isOnboardingModalOpen &&
                            (onboardingStep === 'profile' || onboardingStep === null) && (
                              <UserProfileModal
                                isOpen={true}
                                onComplete={handleOnboardingComplete}
                                onSkip={handleOnboardingSkip}
                                canSkip={true}
                              />
                            )}
                          {isOnboardingModalOpen && onboardingStep === 'baseline' && (
                            <BaselineAssessment
                              onComplete={handleBaselineComplete}
                              onSkip={handleBaselineSkip}
                            />
                          )}
                          {isOnboardingModalOpen && onboardingStep === 'your_plan' && (
                            <OnboardingYourPlan
                              weakestSystems={onboardingWeakestSystems}
                              examDate={onboardingExamDate ?? undefined}
                              onStartSession={handleYourPlanStartSession}
                              onSetExamDate={(date) => setOnboardingExamDate(date)}
                              onSkip={handleYourPlanSkip}
                            />
                          )}
                        </Suspense>

                        {/* Post-onboarding product tour */}
                        <ProductTour
                          isOpen={showProductTour}
                          onClose={() => setShowProductTour(false)}
                        />

                        {/* One-time pro tip after onboarding */}
                        {showProTip && (
                          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] max-w-md mx-4 px-4 py-3 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] shadow-lg flex items-center gap-3">
                            <p className="text-sm text-[var(--color-text-primary)]">
                              Pro tip: Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs">⌘K</kbd> to open the command palette and jump to any mode.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.localStorage.setItem('hasSeenAIPrompt', '1');
                                }
                                setShowProTip(false);
                              }}
                              className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] hover:opacity-90"
                            >
                              Got it
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    )}
                  </>
                }
              />
            </Routes>

            {/* Accessibility Audit Components (Development Tools) */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <KeyboardAccessibilityAudit defaultOpen={false} />
                <ContrastRatioAudit defaultOpen={false} />
                <PerformanceMonitor defaultOpen={false} />
              </>
            )}

            {/* PWA Install Prompt (Shows in production too) */}
            <PWAInstallPrompt
              delay={15000}
              minSessionDuration={30000}
              showOfflineFeatures={true}
              onInstall={() => import.meta.env.DEV && console.log('PWA installed successfully')}
              onDismiss={() => import.meta.env.DEV && console.log('PWA prompt dismissed')}
            />
          </div>
        </CommuterProvider>
      </ToastProvider>
    </SystemIntegrationProvider>
  );
};

export default App;
