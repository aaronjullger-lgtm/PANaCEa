// App.tsx — layout shell, provider composition, and view orchestration.
// Decomposition roadmap: see docs/architecture/APP_DECOMPOSITION.md
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { User } from 'lucide-react';
import { runStorageKeyMigration } from './lib/storage/storageRegistry';
import { type View, DRILL_MODE_IDS, springs } from './config/appViews';
import { TRAINING_MODES } from './config/training-modes';
import { isPrivateBetaModeVisible } from './lib/modes/privateBetaVisibility';
import { useAppNavigation } from './hooks/useAppNavigation';
import PerformanceMonitor from './components/shared/PerformanceMonitor';
import PWAInstallPrompt from './components/shared/PWAInstallPrompt';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useFSRSOptimizationCheck } from './hooks/useFSRSOptimizationCheck';
import { useEnhancedAuth } from './hooks/useEnhancedAuth';
import { Loader, LoadingProgress } from './components/loading';
import { useTheme } from './hooks/useTheme';
import { LandingPage } from './components/landing/LandingPage';
import { inferTaskType } from './lib/taskTypes';
import { resolveCorrectAnswerIndex } from './lib/answerLetterMap';
import { useUserStats } from './hooks/useUserStats';
import { preloadData } from './lib/utils/dataLoader';
import { useAccessibleTransition } from './hooks/useReducedMotion';
import { useViewTransition } from './hooks/useViewTransition';
import { flushPendingToLocalStorage } from './lib/services/sync/offlineSync';
import { ROUTES } from './config/routes';
import { buildMainSessionLaunchPath } from './lib/study/mainSessionLaunch';

import { useInitialLoadOptimization } from './services/initialLoadOptimizer';
import type {
  Question as QuizQuestion,
  PerformanceRecord,
  SessionSettings,
  ErrorTag,
  UserProfile,
} from './types';
import { hasCompletedOnboarding, saveUserProfile, getExamLabel } from './services/analytics';
import { useProductTourShouldShow } from './components/onboarding/ProductTour';
import { AppProviders } from './components/layout/AppProviders';
import { AppRoutes, type SimulationFocus } from './config/AppRoutes';
import { IncidentBanner } from './components/error/IncidentBanner';

/** Session focus options for simulation / training menu — defined in AppRoutes, re-exported here for handler type safety */

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
    let cancelled = false;

    void import('@/services/ai/geminiService').then(({ setGeminiAuthProvider }) => {
      if (cancelled) return;

      if (getToken && !isGuestMode) {
        setGeminiAuthProvider(getToken);
      } else if (isGuestMode) {
        // Set a mock auth provider for guest mode
        setGeminiAuthProvider(async () => 'guest-mode-token');
      }
    });

    return () => {
      cancelled = true;
    };
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

  // Shell shortcuts for nav items that still resolve to view-state workflows.
  // Keeps Review in the primary rail without adding a production route or API.
  useEffect(() => {
    if (location.pathname !== '/study' && location.pathname !== '/study/') return;
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'review') {
      setView('srs_review');
      return;
    }
    if (view === 'srs_review') {
      setView('command_center');
    }
  }, [location.pathname, location.search, setView, view]);

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
  const isOnboardingOpenRef = useRef(isOnboardingModalOpen);
  isOnboardingOpenRef.current = isOnboardingModalOpen;
  useEffect(() => {
    if (
      view === 'command_center' &&
      productTourShouldShow &&
      !showProductTour &&
      !isOnboardingModalOpen &&
      !hasScheduledTour.current
    ) {
      hasScheduledTour.current = true;
      const timer = setTimeout(() => {
        // Re-check onboarding state at fire time to prevent race condition
        if (!isOnboardingOpenRef.current) {
          setShowProductTour(true);
        } else {
          // Onboarding opened while timer was pending — don't show tour
          hasScheduledTour.current = false;
        }
      }, 1500);
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
  const [canonicalDueQuestionsCount, setCanonicalDueQuestionsCount] = useState<number | null>(null);
  useEffect(() => {
    if (!isSignedIn || !authLoaded) {
      setCanonicalDueQuestionsCount(null);
      return;
    }
    let cancelled = false;
    getToken()
      .then((token) => {
        if (!token || cancelled) return null;
        return fetch('/api/srs/due?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
      })
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !payload || typeof payload !== 'object') return;
        const envelope = payload as { data?: { totalDue?: unknown }; totalDue?: unknown };
        const totalDue = envelope.data?.totalDue ?? envelope.totalDue;
        if (typeof totalDue === 'number' && Number.isFinite(totalDue)) {
          setCanonicalDueQuestionsCount(totalDue);
        }
      })
      .catch(() => {
        if (!cancelled) setCanonicalDueQuestionsCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoaded, getToken, isSignedIn]);
  const displayedDueQuestionsCount = canonicalDueQuestionsCount ?? dueQuestionsCount;

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
    // Track the deferred onboarding timer so we can cancel it if the effect
    // re-runs (e.g. sign-out) before the 500 ms delay fires.
    let onboardingTimer: ReturnType<typeof setTimeout> | undefined;

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
      .catch((err) => {
        // Silent by design — we fall back to local hasCompletedOnboarding() in
        // the .finally block, so the user still gets a correct prompt decision.
        // But log in dev so regressions in the /api/user/profile endpoint are
        // visible and don't look like a mysterious re-onboarding loop.
        if (import.meta.env.DEV) {
          console.warn('[App] onboarding profile hydration failed (falling back to local state):', err);
        }
      })
      .finally(() => {
        if (cancelled) return;
        const completed = hasCompletedOnboarding();
        if (!completed) {
          onboardingTimer = setTimeout(() => {
            // Re-check cancelled: the promise may resolve just as auth changes.
            if (cancelled) return;
            setIsOnboardingModalOpen(true);
            setOnboardingStep('profile');
            setOnboardingWeakestSystems([]);
            setOnboardingExamDate(null);
          }, 500);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(onboardingTimer);
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
    const handleOpenPalette = () => setIsCommandPaletteOpen(true);

    globalThis.addEventListener('keydown', handleGlobalKeyDown);
    globalThis.addEventListener('panacea:open-command-palette', handleOpenPalette);
    return () => {
      globalThis.removeEventListener('keydown', handleGlobalKeyDown);
      globalThis.removeEventListener('panacea:open-command-palette', handleOpenPalette);
    };
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
      const { initializeSession, fetchSessionQuestions, prefetchQuestions } = await import('./services/core');
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
          setQuestionQueue([]);
          setView('srs_review');
          navigate(`${ROUTES.STUDY}?mode=review`);
          return;
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
                      canonicalQuestionId?: string | null;
                      sourceQuestionId?: string | null;
                      questionSource?: 'question' | 'pre_generated' | 'staging' | 'seed' | 'generated';
                    } | null;
                    dueConceptKey: { conditionId: string; taskType: string | null };
                  }>;
                };
              };
              const results = json?.data?.results ?? [];
              const resultByOriginalId = new Map<string, (typeof results)[0]>();
              dueItems.forEach((d, i) => {
                const r = results[i];
                if (r !== undefined) {
                  resultByOriginalId.set(d.originalQuestionId, r);
                }
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
                    canonicalQuestionId: q.canonicalQuestionId ?? null,
                    sourceQuestionId: q.sourceQuestionId ?? q.id,
                    questionSource: q.questionSource ?? 'pre_generated',
                    dueConceptKey: key,
                  } as QuizQuestion;
                }
                // Patient safety: if the flagged question's stored
                // correctAnswerIndex is missing, try legacy `correctIndex`,
                // then resolve from the `correctAnswer` string against options,
                // and only then emit -1. Never silently fall back to 0.
                const originalIdx = original.correctAnswerIndex;
                const legacyIdx = (original as { correctIndex?: number }).correctIndex;
                const originalAns = (original as { correctAnswer?: string }).correctAnswer ?? '';
                const originalOpts = Array.isArray(original.options) ? original.options : [];
                let fallbackIdx: number;
                if (typeof originalIdx === 'number' && originalIdx >= 0 && originalIdx < originalOpts.length) {
                  fallbackIdx = originalIdx;
                } else if (typeof legacyIdx === 'number' && legacyIdx >= 0 && legacyIdx < originalOpts.length) {
                  fallbackIdx = legacyIdx;
                } else {
                  const resolved = resolveCorrectAnswerIndex(originalAns, originalOpts);
                  if (resolved === null && import.meta.env.DEV) {
                    console.error('[App] flagged question correctAnswerIndex unresolvable', {
                      questionId: original.id,
                      correctAnswer: originalAns,
                      optionCount: originalOpts.length,
                    });
                  }
                  fallbackIdx = resolved ?? -1;
                }
                return {
                  ...original,
                  question: original.vignette
                    ? `${original.vignette}\n\n${original.question}`
                    : original.question,
                  correctAnswerIndex: fallbackIdx,
                } as QuizQuestion;
              });
              if (queue.length > 0) {
                setQuestionQueue(queue);
                setView('quiz');
                setIsLoading(false);
                return;
              }
            } catch (enrichmentError) {
              // Fall through to use original flagged questions unenriched.
              // Log in dev — silent failure here means the student sees stale
              // versions of flagged items instead of the latest enriched copy,
              // which is recoverable but worth surfacing for debugging.
              if (import.meta.env.DEV) {
                console.warn(
                  '[App] flagged-question enrichment failed, falling back to originals:',
                  enrichmentError
                );
              }
            }
          }
          setQuestionQueue(flaggedQuestions as QuizQuestion[]);
          setView('quiz');
        } else {
          const token = await getToken();
          let initialQuestions: QuizQuestion[];
          let sessionEmptyMessage: string | null = null;
          try {
            if (token) {
              const result = await fetchSessionQuestions(settings, token, INITIAL_QUEUE_SIZE);
              initialQuestions = result.questions as QuizQuestion[];
              sessionEmptyMessage = result.emptyState?.message ?? null;
            } else {
              const { getQuestionBatch } = await import('./services/questionService');
              initialQuestions = await getQuestionBatch(
                settings,
                growthAreas,
                INITIAL_QUEUE_SIZE,
                getToken
              );
            }
          } catch (sessionFetchError) {
            if (settings.simulationStrict) {
              throw sessionFetchError;
            }
            const { getQuestionBatch } = await import('./services/questionService');
            initialQuestions = await getQuestionBatch(
              settings,
              growthAreas,
              INITIAL_QUEUE_SIZE,
              getToken
            );
          }
          if (initialQuestions.length === 0) {
            setError(
              sessionEmptyMessage ??
                'No questions available for your selection. Try adjusting focus or try again later.'
            );
            return;
          }
          setQuestionQueue(initialQuestions);
          setView('quiz');
          // Prefetch next batch in background so replenishment is faster. A failure
          // here is non-fatal (next legitimate fetch will retry), but we log it so
          // background staleness doesn't silently degrade the session experience.
          void prefetchQuestions(settings, token ?? null, 10).catch((prefetchErr) => {
            console.warn('[session] Background question prefetch failed', prefetchErr);
          });
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
      navigate(buildMainSessionLaunchPath({
        mode: sessionFocus === 'review' ? 'review' : 'standard',
        focus: sessionFocus,
        count: INITIAL_QUEUE_SIZE,
      }, { source: modeId === DRILL_MODE_SYSTEM ? 'mode-library' : 'training-menu' }));
    },
    [navigate]
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
        navigate(buildMainSessionLaunchPath(settings, { source: 'dashboard' }));
      } else {
        setIsModalOpen(true);
      }
    },
    [navigate]
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

  const syncOnboardingCompleteToServer = useCallback(async (profile?: Partial<UserProfile>) => {
    try {
      const token = await getToken();
      if (!token) return;
      const payload = {
        school: profile?.school,
        graduationDate: profile?.graduationDate,
        currentRotation: profile?.currentRotation,
        yearInProgram: profile?.yearInProgram,
        eorTestDate: profile?.eorTestDate,
        rotationStartDate: profile?.rotationStartDate,
        rotationEndDate: profile?.rotationEndDate,
        hasCompletedOnboarding: true,
      };
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-blocking: localStorage already set; server sync best-effort
    }
  }, [getToken]);

  const handleOnboardingComplete = useCallback(
    (profile: UserProfile) => {
      saveUserProfile(profile);
      void syncOnboardingCompleteToServer(profile);
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
  //
  // Strategy:
  // 1. First, prefer dedicated route navigation (e.g., /modes/ecg-drill)
  //    This ensures users always see the URL update when launching modes from Practice page
  // 2. Fallback to view-based navigation if no route exists (legacy or special modes)
  const handleNavigateToDrillMode = useCallback((modeId: string) => {
    if (!isPrivateBetaModeVisible(modeId)) {
      setError(
        'This private beta is focused on the core study loop. Start a focused practice block from Study or Practice.'
      );
      setView('command_center');
      navigate('/study');
      return;
    }

    // Look up mode config and navigate to dedicated route if available
    const modeConfig = TRAINING_MODES.find((m) => m.id === modeId);
    if (modeConfig?.route && modeConfig.route.startsWith('/')) {
      navigate(modeConfig.route);
      return;
    }

    // Fallback: view-based navigation (maps mode ID → internal view state)
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
  }, [navigate, setView]);

  const handleNavigateToModeRoute = useCallback(
    (route: string, modeId: string) => {
      if (!isPrivateBetaModeVisible(modeId)) {
        setError(
          'This private beta is focused on the core study loop. Start a focused practice block from Study or Practice.'
        );
        setView('command_center');
        navigate('/study');
        return;
      }

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
    if (!isPrivateBetaModeVisible(modeId)) {
      setError(
        'This private beta is focused on the core study loop. Start a focused practice block from Study or Practice.'
      );
      setInitialDrillSystem(null);
      setView('command_center');
      navigate('/study');
      return;
    }

    if (modeId === DRILL_MODE_SYSTEM) {
      setInitialDrillSystem(system);
      navigate(buildMainSessionLaunchPath(
        {
          mode: 'targeted',
          focus: 'topic',
          count: INITIAL_QUEUE_SIZE,
          questionCount: INITIAL_QUEUE_SIZE,
          systems: system ? [system] : undefined,
          topic: system || undefined,
        },
        { source: 'mode-library' }
      ));
      return;
    }

    setInitialDrillSystem(system);
    const modeConfig = TRAINING_MODES.find((mode) => mode.id === modeId);
    const modeViewMap: Record<string, View> = {
      [DRILL_MODE_SYSTEM]: 'system_drill',
    };
    const targetView = modeViewMap[modeId];
    if (targetView) setView(targetView);
    if (modeConfig?.route?.startsWith('/')) {
      navigate(modeConfig.route);
    }
  }, [navigate, setView]);

  // Navigate to simulation page - memoized
  const [simulationInitialFocus, setSimulationInitialFocus] = useState<SimulationFocus>('all');
  const [initialDrillSystem, setInitialDrillSystem] = useState<string | null>(null);

  // Consume cross-page system drill intent stored by ProgressPage "Practice Now" buttons
  useEffect(() => {
    try {
      const pendingSystem = sessionStorage.getItem('panceai_pending_system_drill');
      if (pendingSystem) {
        sessionStorage.removeItem('panceai_pending_system_drill');
        if (!isPrivateBetaModeVisible(DRILL_MODE_SYSTEM)) {
          setInitialDrillSystem(null);
          setError(
            'This private beta is focused on the core study loop. Start a focused practice block from Study or Practice.'
          );
          setView('command_center');
          navigate('/study');
          return;
        }

        setInitialDrillSystem(pendingSystem);
        setView('system_drill');
      }
    } catch {
      /* ignore storage errors */
    }
  }, [navigate, setView]);

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
    navigate(ROUTES.STUDY_PATH);
  }, [navigate]);

  const pageTransition = useAccessibleTransition(springs.snappy);

  // While Clerk is initializing, show the landing page immediately so FCP fires
  // on real content rather than a blank spinner. Signed-in users will see a
  // brief flash before transitioning to the dashboard (~1-3s) — acceptable
  // trade-off vs. 15s blank screen for unauthenticated/cold-start users.
  if (authIsLoading || (!authLoaded && !isGuestMode)) {
    return <LandingPage />;
  }

  // Show landing page for unauthenticated users (not in guest mode)
  if (!isSignedIn && !isGuestMode) {
    return <LandingPage />;
  }

  // If we're in guest mode, show a guest mode banner
  const showGuestModeBanner = isGuestMode;

  // Main authenticated app (or guest mode)
  const devAuditEnabled =
    process.env.NODE_ENV === 'development' &&
    new URLSearchParams(location.search).get('devAudit') === '1';

  return (
    <MotionConfig reducedMotion="user">
    <AppProviders>
      <div className="min-h-screen bg-[var(--color-canvas,#F8FAFC)] dark:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
        {/*
          System status ribbon — stays mounted at the top of every page so users
          see the heads-up regardless of route. Renders nothing while healthy;
          shows a dismissible warning when /api/health reports degraded or the
          backend is unreachable. Mounted above the guest banner so an outage
          message takes the top slot when both apply.
        */}
        <IncidentBanner />

        {/* Guest mode banner */}
        {showGuestModeBanner && (
          <div className="bg-[var(--color-data-provisional)]/10 border-b border-[var(--color-data-provisional)]/30">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-[var(--color-data-provisional)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  You're in <strong>Guest Mode</strong>. Some features are limited.
                </span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-[var(--color-data-provisional)] hover:text-[var(--color-text-primary)] underline"
              >
                Try signing in again
              </button>
            </div>
          </div>
        )}

        {/* Loading Progress Bar */}
        <LoadingProgress isLoading={isLoading} />

        <AppRoutes
          view={view}
          setView={setView}
          showNotFound={showNotFound}
          isLoading={isLoading}
          error={error}
          setError={setError}
          setIsLoading={setIsLoading}
          sessionSettings={sessionSettings}
          questionQueue={questionQueue}
          setQuestionQueue={setQuestionQueue}
          quizKey={quizKey}
          hasActiveSession={hasActiveSession}
          performanceData={performanceData}
          heatmapPerformance={heatmapPerformance}
          missedQuestions={missedQuestions}
          flaggedQuestions={flaggedQuestions}
          dueQuestionsCount={displayedDueQuestionsCount}
          growthAreas={growthAreas}
          isSyncing={isSyncing}
          isStatsLoading={isStatsLoading}
          lastSyncTime={lastSyncTime}
          syncError={syncError}
          fontSizeAdjustment={fontSizeAdjustment}
          setFontSizeAdjustment={setFontSizeAdjustment}
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          isSettingsModalOpen={isSettingsModalOpen}
          setIsSettingsModalOpen={setIsSettingsModalOpen}
          isShortcutsModalOpen={isShortcutsModalOpen}
          setIsShortcutsModalOpen={setIsShortcutsModalOpen}
          isHelpModalOpen={isHelpModalOpen}
          setIsHelpModalOpen={setIsHelpModalOpen}
          isCommandPaletteOpen={isCommandPaletteOpen}
          setIsCommandPaletteOpen={setIsCommandPaletteOpen}
          isOnboardingModalOpen={isOnboardingModalOpen}
          onboardingStep={onboardingStep}
          onboardingWeakestSystems={onboardingWeakestSystems}
          onboardingExamDate={onboardingExamDate}
          setOnboardingExamDate={setOnboardingExamDate}
          showProductTour={showProductTour}
          setShowProductTour={setShowProductTour}
          showProTip={showProTip}
          setShowProTip={setShowProTip}
          handleNavigateToDrillMode={handleNavigateToDrillMode}
          _handleNavigateToDrillWithSystem={_handleNavigateToDrillWithSystem}
          handleNavigateToSimulation={handleNavigateToSimulation}
          handleNavigateToModeRoute={handleNavigateToModeRoute}
          handleNavigateToCustomStudy={handleNavigateToCustomStudy}
          handleNavigateToStudyPathDashboard={handleNavigateToStudyPathDashboard}
          handleStartSession={handleStartSession}
          handleConfirmSession={handleConfirmSession}
          handleEndSession={handleEndSession}
          handleBackToQuiz={handleBackToQuiz}
          handleReviewMissed={handleReviewMissed}
          handleTrainingMenuStart={handleTrainingMenuStart}
          addPerformanceRecord={addPerformanceRecord}
          addMissedQuestion={addMissedQuestion}
          updateReviewQuestion={updateReviewQuestion}
          removeDueConcept={removeDueConcept}
          updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
          addFlaggedQuestion={addFlaggedQuestion}
          removeFlaggedQuestion={removeFlaggedQuestion}
          updateQuestionNote={updateQuestionNote}
          handleRemoveBookmark={handleRemoveBookmark}
          clearPerformanceData={clearPerformanceData}
          clearMissedQuestionsData={clearMissedQuestionsData}
          clearFlaggedQuestionsData={clearFlaggedQuestionsData}
          handleOnboardingComplete={handleOnboardingComplete}
          handleOnboardingSkip={handleOnboardingSkip}
          handleBaselineComplete={handleBaselineComplete}
          handleBaselineSkip={handleBaselineSkip}
          handleYourPlanStartSession={handleYourPlanStartSession}
          handleYourPlanSkip={handleYourPlanSkip}
          theme={theme}
          setTheme={(t: string) => setTheme(t as typeof theme)}
          examLabel={examLabel}
          commandCenterInitialTab={commandCenterInitialTab}
          simulationInitialFocus={simulationInitialFocus}
          initialDrillSystem={initialDrillSystem}
          pageTransition={pageTransition}
          startViewTransition={startViewTransition}
          showGuestModeBanner={showGuestModeBanner}
        />
        {/* Accessibility Audit Components (Development Tools) */}
        {devAuditEnabled && (
          <>
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
    </AppProviders>
    </MotionConfig>
  );
};

export default App;
