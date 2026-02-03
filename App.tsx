// App.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Shield } from 'lucide-react';
import { ROUTES } from './config/routes';
import { NavRail } from './components/layout/NavRail';
import { type View, pageVariants, DRILL_MODE_IDS } from './config/appViews';
import {
  QuizView,
  MenuView,
  PhotoDrillSession,
  RapidRecallDrill,
  DDxCompareDrill,
  MiniLabDrillSession,
  FirstLineDrillSession,
  ConditionDrillSession,
  GuidelineDrillSession,
  SystemDrillSession,
  PharmacologyDrillSession,
  SubcategoryDrillSession,
  VentilatorDrillSession,
  PhysiologyDrillSession,
  AnatomyDrillSession,
  ECGDrillSession,
  DermDrillSession,
  ImagingDrillSession,
  FluidElectrolyteMode,
  AntibioticMode,
  PatientEncounterMode,
  CodeBlueSpeedMode,
  GrandRoundsMode,
  IntegrationsHub,
  SettingsStatsModal,
  KeyboardShortcutsModal,
  PANRELASimulator,
  CommandPalette,
  UserProfileModal,
  BaselineAssessment,
  OnboardingYourPlan,
  MediaApproval,
  StudyGroupDashboard,
  ToolkitHub,
  GapAnalysisDashboard,
  CommandCenterHub,
  TrainingMenu,
  SimulationPage,
  CommandCenterPage,
  ClinicalReferenceLibrary,
  MyLibraryPage,
  TutorChatPage,
  StudyCompanionPage,
  CustomStudyMode,
  ClinicalProfileDashboard,
  AdminDashboard,
  MyPearlsPanel,
  ClinicalEyePage,
  VisualizerPage,
} from './config/lazyComponents';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import Loader from './components/loading/Loader';
import { DrillLoadingState } from './components/drill/DrillLoadingState';
import ThemeToggleButton from './components/ui/ThemeToggleButton';
import { MasteryHeatmapToggle } from './components/ui/MasteryHeatmapToggle';
import { useTheme } from './hooks/useTheme';
import { LandingPage } from './pages/LandingPage';
import { LoadingProgress } from './components/loading/LoadingProgress';
import { getQuestionBatch } from './services/questionService';
import { initializeSession } from './services/core';
import { useUserStats } from './hooks/useUserStats';
import { preloadData } from './lib/utils/dataLoader';
import { useAccessibleTransition } from './hooks/useReducedMotion';
import { useViewTransition } from './hooks/useViewTransition';
import { flushPendingToLocalStorage } from './lib/services/sync/offlineSync';
import { WithGeminiErrorBoundary } from './components/hoc/withGeminiErrorBoundary';
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
import { OfflineSyncIndicator } from './components/offline/OfflineSyncIndicator';

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

// Batch fetch 10 questions initially to prevent session ending early
/** Commuter Mode: buffer for trains/buses/basements — prefetch 50 cards on Start Session */
const INITIAL_QUEUE_SIZE = 50;

// ---- helpers: localStorage ----
function _safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// very small SRS schedule: 1d → 3d → 7d → 14d
function scheduleNextReview(level: number): string {
  let days: number;
  if (level <= 1) days = 1;
  else if (level === 2) days = 3;
  else if (level === 3) days = 7;
  else days = 14;

  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0] ?? '';
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check authentication status
  const { isSignedIn, isLoaded: authLoaded } = useUser();
  const { getToken } = useAuth();

  // Theme state for passing to child components
  const [theme, setTheme] = useTheme();

  const [view, setView] = useState<View>('command_center');
  const startViewTransition = useViewTransition();

  // Sync URL to view: when path is / show command center; /menu shows menu
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      setView('command_center');
    } else if (location.pathname === '/menu') {
      setView('menu');
    }
  }, [location.pathname]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(null);
  const [questionQueue, setQuestionQueue] = useState<QuizQuestion[]>([]);

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
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  type OnboardingStep = 'profile' | 'baseline' | 'your_plan';
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
  const [onboardingWeakestSystems, setOnboardingWeakestSystems] = useState<string[]>([]);
  const [onboardingExamDate, setOnboardingExamDate] = useState<string | null>(null);

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
      .then((data: { data?: { profile?: { hasCompletedOnboarding?: boolean } } } | null) => {
        if (cancelled) return;
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
  // Heatmap uses all-topics sessions (all questions are PANCE-level)
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
      const base: QuizQuestion = {
        ...question,
        repetitionLevel: question.repetitionLevel ?? 1,
        nextReviewDate: question.nextReviewDate ?? now,
      };
      setMissedQuestions((prev) => [...prev, base]);
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

  const clearPerformanceData = useCallback(() => setPerformanceData([]), [setPerformanceData]);
  const clearMissedQuestionsData = useCallback(() => setMissedQuestions([]), [setMissedQuestions]);
  const clearFlaggedQuestionsData = useCallback(
    () => setFlaggedQuestions([]),
    [setFlaggedQuestions]
  );

  const handleConfirmSession = useCallback(
    async (settings: SessionSettings) => {
      setIsModalOpen(false);
      setSessionSettings(settings);
      setError(null);
      initializeSession();
      try {
        setIsLoading(true);
        if (settings.focus === 'review') {
          const today = new Date().toISOString().split('T')[0] ?? '';
          const due = missedQuestions.filter((q) => q.nextReviewDate && q.nextReviewDate <= today);
          setQuestionQueue(due);
          setView('quiz');
        } else if (settings.focus === 'reviewFlagged') {
          setQuestionQueue(flaggedQuestions);
          setView('quiz');
        } else {
          const initialQuestions = await getQuestionBatch(
            settings,
            growthAreas,
            INITIAL_QUEUE_SIZE,
            getToken
          );
          setQuestionQueue(initialQuestions);
          setView('quiz');
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
      handleConfirmSession({ focus: sessionFocus });
    },
    [handleConfirmSession]
  );

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

  const handleBaselineComplete = useCallback(
    (results: { weakestSystems: string[] }) => {
      setOnboardingWeakestSystems(results.weakestSystems ?? []);
      setOnboardingStep('your_plan');
    },
    []
  );

  const handleBaselineSkip = useCallback(() => {
    setOnboardingWeakestSystems([]);
    setOnboardingStep('your_plan');
  }, []);

  const handleYourPlanStartSession = useCallback(() => {
    setIsOnboardingModalOpen(false);
    setOnboardingStep(null);
    setIsModalOpen(true);
  }, []);

  const handleYourPlanSkip = useCallback(() => {
    setIsOnboardingModalOpen(false);
    setOnboardingStep(null);
  }, []);

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
      .then((data: { data?: { profile?: { examDate?: string | null } } } | null) => {
        if (!cancelled && data?.data?.profile?.examDate)
          setOnboardingExamDate(data.data.profile.examDate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onboardingStep, getToken]);

  // Handler for navigating to drill modes with dedicated routes
  // Memoized to prevent unnecessary child re-renders
  const handleNavigateToDrillMode = useCallback((modeId: string) => {
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
      admin_media: 'admin_media',
      toolkit: 'toolkit',
    };
    const targetView = modeViewMap[modeId];
    if (targetView) setView(targetView);
  }, []);

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

  const pageTransition = useAccessibleTransition({
    duration: 0.2, // Reduced from 0.35 for snappier navigation
    ease: [0.4, 0, 0.2, 1] as const,
  });

  // Show loading state while checking auth
  if (!authLoaded) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isSignedIn) {
    return <LandingPage />;
  }

  // Main authenticated app
  return (
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
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
          {/* Loading Progress Bar */}
          <LoadingProgress isLoading={isLoading} />

          <Routes>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<Loader />}>
                  <AdminDashboard onClose={() => navigate('/')} />
                </Suspense>
              }
            />
            <Route
              path="/clinical-eye"
              element={
                <Suspense fallback={<Loader />}>
                  <ClinicalEyePage onBack={() => navigate('/')} />
                </Suspense>
              }
            />
            <Route
              path="/visualizer"
              element={
                <Suspense fallback={<Loader />}>
                  <VisualizerPage onBack={() => navigate('/')} />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <>
                  {/* Skip to Main Content - hidden until focused via keyboard (screen reader + a11y) */}
                  <a
                    href="#main-content"
                    className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-[var(--color-accent)] focus-visible:text-white focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    Skip to main content
                  </a>
                  {/* Premium Glass Header - Elegant and professional */}
                  <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                      <motion.button
                        onClick={() => {
                          navigate('/');
                          setView('command_center');
                        }}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        aria-label="Return to Dashboard"
                      >
                        {/* Favicon icons - opposites for light/dark mode */}
                        <motion.img
                          src="/Favicon.svg"
                          alt="PANaCEa Icon"
                          className="h-10 sm:h-12 w-auto dark:hidden"
                          transition={{ duration: 0.2 }}
                        />
                        <motion.img
                          src="/favicondarkmodeTP.svg"
                          alt="PANaCEa Icon"
                          className="h-10 sm:h-12 w-auto hidden dark:block"
                          transition={{ duration: 0.2 }}
                        />
                        {/* PANaCEa text – Poppins Bold via Tailwind font-poppins */}
                        <span className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] font-poppins">
                          PANaCEa
                        </span>
                      </motion.button>
                      <div className="flex items-center gap-2">
                        {/* Offline Sync Status Indicator */}
                        <OfflineSyncIndicator />
                        <Link
                          to={ROUTES.ADMIN}
                          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-200 flex items-center justify-center"
                          aria-label="Admin Dashboard"
                        >
                          <Shield className="w-5 h-5" />
                        </Link>
                        <motion.button
                          ref={settingsButtonRef}
                          onClick={() => setIsSettingsModalOpen(true)}
                          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200"
                          aria-label="Settings and Stats"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Settings className="w-5 h-5" />
                        </motion.button>
                        <MasteryHeatmapToggle compact className="hidden sm:inline-flex" />
                        <ThemeToggleButton />
                      </div>
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

                  {/* Full-screen views that break out of max-w-4xl constraint */}
                  {view === 'reference_library' && (
                    <div className="w-full">
                      <WithGeminiErrorBoundary
                        viewName="reference_library"
                        onRetry={() => setView('reference_library')}
                      >
                        <Suspense fallback={<Loader />}>
                          <ClinicalReferenceLibrary onExit={() => setView('command_center')} />
                        </Suspense>
                      </WithGeminiErrorBoundary>
                    </div>
                  )}

                  {view === 'my_library' && (
                    <div className="w-full">
                      <Suspense fallback={<Loader />}>
                        <MyLibraryPage onExit={() => setView('command_center')} />
                      </Suspense>
                    </div>
                  )}

                  {view === 'pearl_deck' && (
                    <div className="w-full">
                      <Suspense fallback={<Loader />}>
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
                      className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-10 pb-20 sm:pb-24"
                      style={{ marginLeft: 'var(--nav-rail-width, 3.5rem)' }}
                    >
                      {isLoading &&
                        (sessionSettings ? (
                          <DrillLoadingState
                            message="Preparing your question..."
                            variant="question"
                            showTimer={false}
                          />
                        ) : (
                          <Loader forceDark={view === 'imaging_drill'} />
                        ))}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-4 p-3 rounded-md bg-data-fail/10 text-data-fail text-sm border border-data-fail/30"
                        >
                          {error}
                        </motion.div>
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
                            <Suspense fallback={<Loader />}>
                              <CommandCenterHub
                                performanceData={heatmapPerformance}
                                missedQuestions={missedQuestions}
                                flaggedQuestions={flaggedQuestions}
                                dueCount={dueQuestionsCount}
                                isLoadingStats={isStatsLoading}
                                onOpenSettings={() => setIsSettingsModalOpen(true)}
                                onStartSession={handleStartSession}
                                onNavigateToDrillMode={handleNavigateToDrillMode}
                                onNavigateToToolkit={() => setView('toolkit')}
                                onNavigateToGapAnalysis={() => startViewTransition(() => setView('gap_analysis'))}
                                onNavigateToClinicalProfile={() => setView('clinical_profile')}
                                onNavigateToIntegrations={() => setView('integrations')}
                                onNavigateToSimulation={handleNavigateToSimulation}
                                onNavigateToReference={() => setView('reference_library')}
                                onNavigateToMyLibrary={() => setView('my_library')}
                                onNavigateToCustomStudy={handleNavigateToCustomStudy}
                                onNavigateToTutorChat={() => setView('tutor_chat')}
                                onNavigateToStudyCompanion={() => setView('study_companion')}
                                onNavigateToPearlDeck={() => setView('pearl_deck')}
                                growthAreas={growthAreas}
                                examLabel={examLabel ?? 'PANCE'}
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
                            <Suspense fallback={<Loader />}>
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
                                growthAreas={growthAreas}
                                onNavigateToDrillMode={handleNavigateToDrillMode}
                                onNavigateToIntegrations={() => setView('integrations')}
                                onNavigateToSocial={() => setView('social_dashboard')}
                                onNavigateToToolkit={() => setView('toolkit')}
                                onNavigateToGapAnalysis={() => startViewTransition(() => setView('gap_analysis'))}
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
                            key="quiz"
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
                              <Suspense fallback={<Loader />}>
                                <QuizView
                                  initialQueue={questionQueue}
                                  setParentQueue={setQuestionQueue}
                                  addPerformanceRecord={addPerformanceRecord}
                                  addMissedQuestion={addMissedQuestion}
                                  updateReviewQuestion={updateReviewQuestion}
                                  updateLastPerformanceErrorTag={updateLastPerformanceErrorTag}
                                  setIsLoading={setIsLoading}
                                  setError={setError}
                                  sessionSettings={sessionSettings}
                                  growthAreas={growthAreas}
                                  onEndSession={handleEndSession}
                                  onShowMenu={() => setView('command_center')}
                                  performanceData={heatmapPerformance}
                                  fontSizeAdjustment={fontSizeAdjustment}
                                  setFontSizeAdjustment={setFontSizeAdjustment}
                                  flaggedQuestions={flaggedQuestions}
                                  addFlaggedQuestion={addFlaggedQuestion}
                                  removeFlaggedQuestion={removeFlaggedQuestion}
                                  updateQuestionNote={updateQuestionNote}
                                />
                              </Suspense>
                            </WithGeminiErrorBoundary>
                          </motion.div>
                        )}

                        {view === 'photo_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="photo_drill"
                            onRetry={() => setView('photo_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <PhotoDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {/* ECG, Derm, and Imaging drills use the same PhotoDrillSession component with different filters */}
                        {view === 'ecg_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="ecg_drill"
                            onRetry={() => setView('ecg_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <ECGDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'derm_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="derm_drill"
                            onRetry={() => setView('derm_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <DermDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'imaging_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="imaging_drill"
                            onRetry={() => setView('imaging_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <ImagingDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'rapid_recall' && (
                          <WithGeminiErrorBoundary
                            viewName="rapid_recall"
                            onRetry={() => setView('rapid_recall')}
                          >
                            <Suspense fallback={<Loader />}>
                              <RapidRecallDrill onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'ddx_compare' && (
                          <WithGeminiErrorBoundary
                            viewName="ddx_compare"
                            onRetry={() => setView('ddx_compare')}
                          >
                            <Suspense fallback={<Loader />}>
                              <DDxCompareDrill onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'mini_lab' && (
                          <WithGeminiErrorBoundary
                            viewName="mini_lab"
                            onRetry={() => setView('mini_lab')}
                          >
                            <Suspense fallback={<Loader />}>
                              <MiniLabDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'pharmacology' && (
                          <WithGeminiErrorBoundary
                            viewName="pharmacology"
                            onRetry={() => setView('pharmacology')}
                          >
                            <Suspense fallback={<Loader />}>
                              <PharmacologyDrillSession
                                onExit={() => setView('command_center')}
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
                              />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'first_line_treatment' && (
                          <WithGeminiErrorBoundary
                            viewName="first_line_treatment"
                            onRetry={() => setView('first_line_treatment')}
                          >
                            <Suspense fallback={<Loader />}>
                              <FirstLineDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'condition_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="condition_drill"
                            onRetry={() => setView('condition_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <ConditionDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'system_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="system_drill"
                            onRetry={() => setView('system_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <SystemDrillSession
                                onExit={() => setView('command_center')}
                                initialSystem={initialDrillSystem ?? undefined}
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
                              />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'subcategory_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="subcategory_drill"
                            onRetry={() => setView('subcategory_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <SubcategoryDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'guideline_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="guideline_drill"
                            onRetry={() => setView('guideline_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <GuidelineDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'ventilator_hero' && (
                          <WithGeminiErrorBoundary
                            viewName="ventilator_hero"
                            onRetry={() => setView('ventilator_hero')}
                          >
                            <Suspense fallback={<Loader />}>
                              <VentilatorDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'physiology_drill' && (
                          <WithGeminiErrorBoundary
                            viewName="physiology_drill"
                            onRetry={() => setView('physiology_drill')}
                          >
                            <Suspense fallback={<Loader />}>
                              <PhysiologyDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'anatomy_review' && (
                          <WithGeminiErrorBoundary
                            viewName="anatomy_review"
                            onRetry={() => setView('anatomy_review')}
                          >
                            <Suspense fallback={<Loader />}>
                              <AnatomyDrillSession onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'fluid_electrolyte' && (
                          <WithGeminiErrorBoundary
                            viewName="fluid_electrolyte"
                            onRetry={() => setView('fluid_electrolyte')}
                          >
                            <Suspense fallback={<Loader />}>
                              <FluidElectrolyteMode onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'antibiotic_mode' && (
                          <WithGeminiErrorBoundary
                            viewName="antibiotic_mode"
                            onRetry={() => setView('antibiotic_mode')}
                          >
                            <Suspense fallback={<Loader />}>
                              <AntibioticMode onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'patient_encounter' && (
                          <WithGeminiErrorBoundary
                            viewName="patient_encounter"
                            onRetry={() => setView('patient_encounter')}
                          >
                            <Suspense fallback={<Loader />}>
                              <PatientEncounterMode onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'integrations' && (
                          <WithGeminiErrorBoundary
                            viewName="integrations"
                            onRetry={() => setView('integrations')}
                          >
                            <Suspense fallback={<Loader />}>
                              <IntegrationsHub
                                performanceData={performanceData}
                                missedQuestions={missedQuestions}
                                onBack={() => setView('command_center')}
                              />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'panre_la' && (
                          <WithGeminiErrorBoundary
                            viewName="panre_la"
                            onRetry={() => setView('panre_la')}
                          >
                            <Suspense fallback={<Loader />}>
                              <PANRELASimulator onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'code_blue_speed' && (
                          <WithGeminiErrorBoundary
                            viewName="code_blue_speed"
                            onRetry={() => setView('code_blue_speed')}
                          >
                            <Suspense fallback={<Loader />}>
                              <CodeBlueSpeedMode onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'grand_rounds' && (
                          <WithGeminiErrorBoundary
                            viewName="grand_rounds"
                            onRetry={() => setView('grand_rounds')}
                          >
                            <Suspense fallback={<Loader />}>
                              <GrandRoundsMode onExit={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'social_dashboard' && (
                          <WithGeminiErrorBoundary
                            viewName="social_dashboard"
                            onRetry={() => setView('social_dashboard')}
                          >
                            <Suspense fallback={<Loader />}>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setView('command_center')}
                                  className="absolute top-4 left-4 z-10 p-2 bg-[var(--color-bg-primary)] rounded-full shadow-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                  aria-label="Go back to dashboard"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-5 h-5 text-[var(--color-text-muted)]"
                                  >
                                    <path d="m15 18-6-6 6-6" />
                                  </svg>
                                </button>
                                <StudyGroupDashboard />
                              </div>
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

                        {view === 'admin_media' && (
                          <WithGeminiErrorBoundary
                            viewName="admin_media"
                            onRetry={() => setView('admin_media')}
                          >
                            <Suspense fallback={<Loader />}>
                              <MediaApproval onClose={() => setView('command_center')} />
                            </Suspense>
                          </WithGeminiErrorBoundary>
                        )}

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
                              <Suspense fallback={<Loader />}>
                                <ToolkitHub
                                  onClose={() => setView('command_center')}
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
                                <GapAnalysisDashboard />
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
                                    handleNavigateToDrillMode(mode.id)
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
                                  onNavigateToToolkit={() => setView('toolkit')}
                                  onNavigateToGapAnalysis={() => startViewTransition(() => setView('gap_analysis'))}
                                  onNavigateToIntegrations={() => setView('integrations')}
                                  onNavigateToReference={() => setView('reference_library')}
                                  onNavigateToMyLibrary={() => setView('my_library')}
                                  onNavigateToStudyCompanion={() => setView('study_companion')}
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
                                <CustomStudyMode onBack={() => setView('command_center')} />
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
                                <StudyCompanionPage onExit={() => setView('command_center')} />
                              </Suspense>
                            </WithGeminiErrorBoundary>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </main>
                  )}

                  {/* Command Palette */}
                  <Suspense fallback={null}>
                    <CommandPalette
                      isOpen={isCommandPaletteOpen}
                      onClose={() => setIsCommandPaletteOpen(false)}
                      onNavigate={handleNavigateToDrillMode}
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
                          className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl p-4 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
                              Training Command Center
                            </h2>
                            <button
                              onClick={() => setIsModalOpen(false)}
                              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
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
                                handleNavigateToDrillMode(mode.id);
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
                    {isOnboardingModalOpen && (onboardingStep === 'profile' || onboardingStep === null) && (
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
                </>
              }
            />
          </Routes>
        </div>
      </CommuterProvider>
    </ToastProvider>
  );
};

export default App;
