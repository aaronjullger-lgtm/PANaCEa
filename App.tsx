// App.tsx
import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Keyboard, X } from "lucide-react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { Toaster } from "sonner";
import Loader from "./components/Loader";
import ThemeToggleButton from "./components/ThemeToggleButton";
import { LandingPage } from "./components/LandingPage";
import { LoadingProgress } from "./components/LoadingProgress";
import { getQuestionBatch } from "./services/questionService";
import { useUserStats } from "./hooks/useUserStats";
import { preloadData } from "./lib/utils/dataLoader";
import { useAccessibleTransition } from "./hooks/useReducedMotion";
import { flushPendingToLocalStorage } from "./lib/services/sync/offlineSync";
import { WithGeminiErrorBoundary } from "./components/hoc/withGeminiErrorBoundary";
import type {
  Question,
  PerformanceRecord,
  SessionSettings,
  SystemCode,
  ErrorTag,
  UserProfile,
} from "./types";
import {
  hasCompletedOnboarding,
  saveUserProfile
} from "./services/userProfileService";
import { getExamLabel } from "./services/userContextService";
import type { TrainingModeId } from "./config/training-modes";
import { CommuterProvider } from "./contexts/CommuterContext";
import { ToastProvider } from "./contexts/ToastContext";
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from "./contexts/KeyboardShortcutsContext";

// Lazy load components for better performance
const QuizView = lazy(() => import("./components/QuizView"));
const MenuView = lazy(() => import("./components/MenuView"));
const PhotoDrillSession = lazy(() => import("./components/PhotoDrillSession"));
const RapidRecallDrill = lazy(() => import("./components/drill/recall/RapidRecallDrill"));
const DDxCompareDrill = lazy(() => import("./components/drill/ddx/DDxCompareDrill"));
const MiniLabDrillSession = lazy(() => import("./components/drill/MiniLabDrillSession"));
const PharmDrillSession = lazy(() => import("./components/drill/PharmDrillSession"));
const FirstLineDrillSession = lazy(() => import("./components/drill/FirstLineDrillSession"));
const ConditionDrillSession = lazy(() => import("./components/drill/ConditionDrillSession"));
const GuidelineDrillSession = lazy(() => import("./components/drill/GuidelineDrillSession"));
const SystemDrillSession = lazy(() => import("./components/drill/SystemDrillSession"));
const PharmacologyDrillSession = lazy(() => import("./components/drill/PharmacologyDrillSession"));
const SubcategoryDrillSession = lazy(() => import("./components/drill/SubcategoryDrillSession"));
const VentilatorDrillSession = lazy(() => import("./components/drill/VentilatorDrillSession"));
const PhysiologyDrillSession = lazy(() => import("./components/drill/PhysiologyDrillSession"));
const AnatomyDrillSession = lazy(() => import("./components/drill/AnatomyDrillSession"));
const ECGDrillSession = lazy(() => import("./components/drill/ECGDrillSession"));
const DermDrillSession = lazy(() => import("./components/drill/DermDrillSession"));
const ImagingDrillSession = lazy(() => import("./components/drill/ImagingDrillSession"));
const FluidElectrolyteMode = lazy(() => import("./components/modes/FluidElectrolyteMode"));
const AntibioticMode = lazy(() => import("./components/modes/AntibioticMode"));
const PatientEncounterMode = lazy(() => import("./components/modes/PatientEncounterMode"));
const CodeBlueSpeedMode = lazy(() => import("./components/modes/CodeBlueSpeedMode"));
const GrandRoundsMode = lazy(() => import("./components/modes/GrandRoundsMode"));
const IntegrationsHub = lazy(() => import("./components/integrations/IntegrationsHub"));
const SettingsStatsModal = lazy(() => import("./components/SettingsStatsModal"));
const KeyboardShortcutsModal = lazy(() => import("./components/KeyboardShortcutsModal"));
const PANRELASimulator = lazy(() => import("./components/lifelong-learning/PANRELASimulator"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const UserProfileModal = lazy(() => import("./components/onboarding/UserProfileModal"));
const MediaApproval = lazy(() => import("./pages/admin/MediaApproval"));
const StudyGroupDashboard = lazy(() => import("./components/social/StudyGroupDashboard"));
const ToolkitHub = lazy(() => import("./components/toolkit/ToolkitHub"));
const GapAnalysisDashboard = lazy(() => import("./components/dashboard/GapAnalysisDashboard"));
const CommandCenterHub = lazy(() => import("./components/CommandCenterHub"));
const TrainingMenu = lazy(() => import("./components/dashboard/TrainingMenu"));
const SimulationPage = lazy(() => import("./pages/SimulationPage").then(m => ({ default: m.SimulationPage })));
const CommandCenterPage = lazy(() => import("./pages/CommandCenterPage").then(m => ({ default: m.CommandCenterPage })));
const ClinicalReferenceLibrary = lazy(() => import("./components/library/ClinicalReferenceLibrary"));
const QuestionCurationPanel = lazy(() => import("./components/admin/QuestionCurationPanel"));
const ClinicalProfileDashboard = lazy(() => import("./components/dashboard/ClinicalProfile/ClinicalProfileDashboard"));

// Non-lazy components that should always be available
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";

const PERFORMANCE_KEY = "panceai_performance_v2";
const MISSED_KEY = "panceai_missed_v2";
const FLAGGED_KEY = "panceai_flagged_v2";

/** Drill mode IDs that have dedicated view implementations */
const DRILL_MODE_PHOTO: TrainingModeId = 'photo_drill';
const DRILL_MODE_ECG: TrainingModeId = 'ecg_drill';
const DRILL_MODE_DERM: TrainingModeId = 'derm_drill';
const DRILL_MODE_IMAGING: TrainingModeId = 'imaging_drill';
const DRILL_MODE_RAPID_RECALL: TrainingModeId = 'rapid_recall';
const DRILL_MODE_DDX_COMPARE: TrainingModeId = 'ddx_compare';
const DRILL_MODE_MINI_LAB: TrainingModeId = 'mini_lab';
const DRILL_MODE_PHARMACOLOGY: TrainingModeId = 'pharmacology';
const DRILL_MODE_FIRST_LINE: TrainingModeId = 'first_line_treatment';
const DRILL_MODE_CONDITION: TrainingModeId = 'condition_drill';
const DRILL_MODE_SYSTEM: TrainingModeId = 'system_drill';
const DRILL_MODE_SUBCATEGORY: TrainingModeId = 'subcategory_drill';
const DRILL_MODE_GUIDELINE: TrainingModeId = 'guideline_drill';
const DRILL_MODE_FLUID_ELECTROLYTE: TrainingModeId = 'fluid_electrolyte';
const DRILL_MODE_ANTIBIOTIC: TrainingModeId = 'antibiotic_mode';
const DRILL_MODE_PATIENT_ENCOUNTER: TrainingModeId = 'patient_encounter';
const DRILL_MODE_CODE_BLUE: TrainingModeId = 'code_blue_speed';
const DRILL_MODE_GRAND_ROUNDS: TrainingModeId = 'grand_rounds';
const DRILL_MODE_VENTILATOR: TrainingModeId = 'ventilator_hero';
const DRILL_MODE_PHYSIOLOGY: TrainingModeId = 'physiology_drill';
const DRILL_MODE_ANATOMY: TrainingModeId = 'anatomy_review';

type View = "menu" | "command_center" | "quiz" | "integrations" | "photo_drill" | "ecg_drill" | "derm_drill" | "imaging_drill" | "rapid_recall" | "ddx_compare" | "mini_lab" | "pharmacology" | "first_line_treatment" | "condition_drill" | "system_drill" | "subcategory_drill" | "guideline_drill" | "fluid_electrolyte" | "antibiotic_mode" | "patient_encounter" | "panre_la" | "code_blue_speed" | "grand_rounds" | "ventilator_hero" | "physiology_drill" | "anatomy_review" | "admin_media" | "social_dashboard" | "toolkit" | "gap_analysis" | "clinical_profile" | "training_menu" | "simulation_page" | "command_center_page" | "reference_library";

const INITIAL_QUEUE_SIZE = 3;

// ---- helpers: localStorage ----
function safeParse<T>(raw: string | null, fallback: T): T {
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
  return d.toISOString().split("T")[0];
}

const App: React.FC = () => {
  // Check authentication status
  const { isSignedIn, isLoaded: authLoaded } = useUser();
  const { getToken } = useAuth();

  const [view, setView] = useState<View>("command_center");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(
    null
  );
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);

  // Use the cloud-sync-enabled stats hook
  const {
    performanceData,
    missedQuestions,
    flaggedQuestions,
    setPerformanceData,
    setMissedQuestions,
    setFlaggedQuestions,
    isSyncing,
    lastSyncTime,
    syncError,
  } = useUserStats();

  const [fontSizeAdjustment, setFontSizeAdjustment] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);

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
    const today = new Date().toISOString().split("T")[0];
    return missedQuestions.filter(q => q.nextReviewDate && q.nextReviewDate <= today).length;
  }, [missedQuestions]);

  // ---- Preload large data files in background for better performance ----
  useEffect(() => {
    // Start preloading data after initial mount
    preloadData();
  }, []);

  // ---- Check if user needs onboarding on first sign-in ----
  useEffect(() => {
    if (isSignedIn && authLoaded) {
      const completed = hasCompletedOnboarding();
      if (!completed) {
        // Show onboarding modal after a short delay for better UX
        setTimeout(() => {
          setIsOnboardingModalOpen(true);
        }, 500);
      }
    }
  }, [isSignedIn, authLoaded]);

  // ---- Global keyboard shortcuts ----
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      // Cmd/Ctrl + / to open keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ---- Safety net: flush pending sync data before browser closes ----
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Flush any pending debounced operations to localStorage queue
      // This ensures data isn't lost if user closes tab during debounce window
      flushPendingToLocalStorage();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ---- derived: "growth areas" and heatmap data ----
  // Heatmap must ONLY use PANCE-level all-topics sessions
  const heatmapPerformance = useMemo(
    () =>
      performanceData.filter(
        (r) => r.focus === "all" && r.difficulty === "same"
      ),
    [performanceData]
  );

  // Growth areas by topic, from the same filtered performance
  const growthAreas: string[] = useMemo(() => {
    if (heatmapPerformance.length === 0) return [];

    const byTopic = new Map<
      string,
      { correct: number; total: number }
    >();

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

  // ---- performance record hook passed into QuizView ----
  const addPerformanceRecord = (record: PerformanceRecord) => {
    setPerformanceData((prev) => [...prev, record]);
  };

  // ---- update last performance record with error tag (for meta-cognition) ----
  const updateLastPerformanceErrorTag = (tag: ErrorTag) => {
    setPerformanceData((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        errorTag: tag,
      };
      return updated;
    });
  };

  // ---- missed-question handling ----
  const addMissedQuestion = (question: Question) => {
    // When you miss during a normal session, seed its SRS metadata
    const now = new Date().toISOString().split("T")[0];
    const base: Question = {
      ...question,
      repetitionLevel: question.repetitionLevel ?? 1,
      nextReviewDate: question.nextReviewDate ?? now,
    };

    setMissedQuestions((prev) => [...prev, base]);
  };

  const updateReviewQuestion = (question: Question, wasCorrect: boolean) => {
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
        } else {
          // reset if incorrect in review mode
          const newLevel = 1;
          return {
            ...q,
            repetitionLevel: newLevel,
            nextReviewDate: scheduleNextReview(newLevel),
          };
        }
      })
    );
  };

  // ---- flagged-question helpers ----
  const addFlaggedQuestion = (question: Question) => {
    setFlaggedQuestions((prev) => {
      if (prev.some((q) => q.question === question.question)) return prev;
      return [...prev, question];
    });
  };

  const removeFlaggedQuestion = (question: Question) => {
    setFlaggedQuestions((prev) =>
      prev.filter((q) => q.question !== question.question)
    );
  };

  // ---- notes: keep notes in all places a question might live ----
  const updateQuestionNote = (question: Question, note: string) => {
    const updater = (q: Question) =>
      q.question === question.question ? { ...q, userNote: note } : q;

    setQuestionQueue((prev) => prev.map(updater));
    setMissedQuestions((prev) => prev.map(updater));
    setFlaggedQuestions((prev) => prev.map(updater));
  };

  // ---- clearing data from MenuView buttons ----
  const clearPerformanceData = () => {
    setPerformanceData([]);
  };

  const clearMissedQuestionsData = () => {
    setMissedQuestions([]);
  };

  const clearFlaggedQuestionsData = () => {
    setFlaggedQuestions([]);
  };

  const handleConfirmSession = async (settings: SessionSettings) => {
    setIsModalOpen(false);
    setSessionSettings(settings);
    setError(null);

    // DUE + FLAGGED are finite; no background stream. Other modes:
    // - Only ALL + SAME should be endless (handled in QuizView via replenishQueue)
    try {
      setIsLoading(true);

      if (settings.focus === "review") {
        const today = new Date().toISOString().split("T")[0];
        const due = missedQuestions.filter(
          (q) => q.nextReviewDate && q.nextReviewDate <= today
        );
        setQuestionQueue(due);
        setView("quiz");
      } else if (settings.focus === "reviewFlagged") {
        setQuestionQueue(flaggedQuestions);
        setView("quiz");
      } else {
        // Use questionService which tries database pool first, then Gemini
        const initialQuestions = await getQuestionBatch(
          settings,
          growthAreas,
          INITIAL_QUEUE_SIZE,
          getToken
        );
        setQuestionQueue(initialQuestions);
        setView("quiz");
      }
    } catch (err: any) {
      console.error("Error starting session:", err);
      setError(
        err?.message || "Failed to start session. Please try again in a moment."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainingMenuStart = (modeId: string, focus?: 'all' | 'growth' | 'flagged' | 'due') => {
    let sessionFocus: SessionSettings['focus'] = 'all';
    if (focus === 'flagged') sessionFocus = 'reviewFlagged';
    else if (focus === 'due') sessionFocus = 'review';
    else if (focus === 'growth') sessionFocus = 'growth';

    handleConfirmSession({
      focus: sessionFocus,
      difficulty: 'same',
    });
  };

  // ---- starting a session ----
  const handleStartSession = (settings?: SessionSettings) => {
    if (settings && typeof settings === 'object' && 'focus' in settings) {
      handleConfirmSession(settings);
    } else {
      setIsModalOpen(true);
    }
  };

  const handleEndSession = () => {
    // Just go back to command center; keep performance/missed/flagged
    setView("command_center");
    setSessionSettings(null);
    setQuestionQueue([]);
  };

  const handleBackToQuiz = () => {
    if (questionQueue.length > 0 && sessionSettings) {
      setView("quiz");
    } else {
      // no active session → open setup
      setIsModalOpen(true);
    }
  };

  const hasActiveSession =
    !!sessionSettings && questionQueue && questionQueue.length > 0;

  // Handle onboarding completion
  const handleOnboardingComplete = (profile: UserProfile) => {
    saveUserProfile(profile);
    setIsOnboardingModalOpen(false);
  };

  // Handle onboarding skip
  const handleOnboardingSkip = () => {
    saveUserProfile({ hasCompletedOnboarding: true });
    setIsOnboardingModalOpen(false);
  };

  // Handler for navigating to drill modes with dedicated routes
  // Memoized to prevent unnecessary child re-renders
  const handleNavigateToDrillMode = useCallback((modeId: string) => {
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
      'panre_la': 'panre_la',
      [DRILL_MODE_VENTILATOR]: 'ventilator_hero',
      [DRILL_MODE_PHYSIOLOGY]: 'physiology_drill',
      [DRILL_MODE_ANATOMY]: 'anatomy_review',
      'admin_media': 'admin_media',
      'toolkit': 'toolkit',
    };
    const targetView = modeViewMap[modeId];
    if (targetView) setView(targetView);
  }, []);

  // Navigate to simulation page - memoized
  const handleNavigateToSimulation = useCallback(() => {
    setView('simulation_page');
  }, []);

  // Navigate to command center page - memoized
  const handleNavigateToCommandCenter = useCallback(() => {
    setView('command_center_page');
  }, []);

  // Animation variants for page transitions
  // Optimized for faster navigation with reduced motion preference support
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 }
  };

  const pageTransition = useAccessibleTransition({
    duration: 0.2, // Reduced from 0.35 for snappier navigation
    ease: [0.4, 0, 0.2, 1]
  }) as any;

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

          {/* Premium Glass Header - Elegant and professional */}
          <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <motion.button
                onClick={() => setView("command_center")}
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
                {/* PANaCEa text with Poppins Bold font */}
                <span
                  className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  PANaCEa
                </span>
              </motion.button>
              <div className="flex items-center gap-2">
                {/* Offline Sync Status Indicator */}
                <OfflineSyncIndicator />
                <motion.button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200"
                  aria-label="Settings and Stats"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Settings className="w-5 h-5" />
                </motion.button>
                <ThemeToggleButton />
              </div>
            </div>
          </header>

          {/* Settings/Stats Modal */}
          <Suspense fallback={null}>
            <SettingsStatsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              performanceData={performanceData}
              clearPerformanceData={clearPerformanceData}
              clearMissedQuestionsData={clearMissedQuestionsData}
              clearFlaggedQuestionsData={clearFlaggedQuestionsData}
              missedQuestionsCount={missedQuestions.length}
              flaggedQuestionsCount={flaggedQuestions.length}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              syncError={syncError}
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
          {view === "reference_library" && (
            <div className="w-full">
              <WithGeminiErrorBoundary viewName="reference_library" onRetry={() => setView("reference_library")}>
                <Suspense fallback={<Loader />}>
                  <ClinicalReferenceLibrary
                    onExit={() => setView("command_center")}
                  />
                </Suspense>
              </WithGeminiErrorBoundary>
            </div>
          )}

          {/* Standard views with max-w-4xl constraint */}
          {view !== "reference_library" && (
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-10 pb-20 sm:pb-24">
              {isLoading && <Loader forceDark={view === "imaging_drill"} />}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm border border-red-200 dark:border-red-800"
                >
                  {error}
                </motion.div>
              )}

              {/* Removed mode="wait" to allow overlapping transitions for faster perceived navigation */}
              <AnimatePresence>
                {view === "command_center" && (
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
                        onStartSession={handleStartSession}
                        onNavigateToDrillMode={handleNavigateToDrillMode}
                        onNavigateToToolkit={() => setView("toolkit")}
                        onNavigateToGapAnalysis={() => setView("gap_analysis")}
                        onNavigateToClinicalProfile={() => setView("clinical_profile")}
                        onNavigateToIntegrations={() => setView("integrations")}
                        onNavigateToSimulation={handleNavigateToSimulation}
                        onNavigateToReference={() => setView("reference_library")}
                        growthAreas={growthAreas}
                        examLabel={examLabel}
                      />
                    </Suspense>
                  </motion.div>
                )}

                {view === "menu" && (
                  <motion.div
                    key="menu"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <Suspense fallback={< Loader />}>
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
                        onNavigateToIntegrations={() => setView("integrations")}
                        onNavigateToSocial={() => setView("social_dashboard")}
                        onNavigateToToolkit={() => setView("toolkit")}
                        onNavigateToGapAnalysis={() => setView("gap_analysis")}
                        onNavigateToSimulation={handleNavigateToSimulation}
                        isSyncing={isSyncing}
                        lastSyncTime={lastSyncTime}
                        syncError={syncError}
                      />
                    </Suspense>
                  </motion.div>
                )}

                {view === "quiz" && sessionSettings && (
                  <motion.div
                    key="quiz"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="quiz" onRetry={() => setView("quiz")}>
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
                          onShowMenu={() => setView("command_center")}
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

                {view === "photo_drill" && (
                  <WithGeminiErrorBoundary viewName="photo_drill" onRetry={() => setView("photo_drill")}>
                    <Suspense fallback={<Loader />}>
                      <PhotoDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {/* ECG, Derm, and Imaging drills use the same PhotoDrillSession component with different filters */}
                {view === "ecg_drill" && (
                  <WithGeminiErrorBoundary viewName="ecg_drill" onRetry={() => setView("ecg_drill")}>
                    <Suspense fallback={<Loader />}>
                      <ECGDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "derm_drill" && (
                  <WithGeminiErrorBoundary viewName="derm_drill" onRetry={() => setView("derm_drill")}>
                    <Suspense fallback={<Loader />}>
                      <DermDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "imaging_drill" && (
                  <WithGeminiErrorBoundary viewName="imaging_drill" onRetry={() => setView("imaging_drill")}>
                    <Suspense fallback={<Loader />}>
                      <ImagingDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "rapid_recall" && (
                  <WithGeminiErrorBoundary viewName="rapid_recall" onRetry={() => setView("rapid_recall")}>
                    <Suspense fallback={<Loader />}>
                      <RapidRecallDrill onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "ddx_compare" && (
                  <WithGeminiErrorBoundary viewName="ddx_compare" onRetry={() => setView("ddx_compare")}>
                    <Suspense fallback={<Loader />}>
                      <DDxCompareDrill onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "mini_lab" && (
                  <WithGeminiErrorBoundary viewName="mini_lab" onRetry={() => setView("mini_lab")}>
                    <Suspense fallback={<Loader />}>
                      <MiniLabDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "pharmacology" && (
                  <WithGeminiErrorBoundary viewName="pharmacology" onRetry={() => setView("pharmacology")}>
                    <Suspense fallback={<Loader />}>
                      <PharmacologyDrillSession
                        onExit={() => setView("command_center")}
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

                {view === "first_line_treatment" && (
                  <WithGeminiErrorBoundary viewName="first_line_treatment" onRetry={() => setView("first_line_treatment")}>
                    <Suspense fallback={<Loader />}>
                      <FirstLineDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "condition_drill" && (
                  <WithGeminiErrorBoundary viewName="condition_drill" onRetry={() => setView("condition_drill")}>
                    <Suspense fallback={<Loader />}>
                      <ConditionDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "system_drill" && (
                  <WithGeminiErrorBoundary viewName="system_drill" onRetry={() => setView("system_drill")}>
                    <Suspense fallback={<Loader />}>
                      <SystemDrillSession
                        onExit={() => setView("command_center")}
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

                {view === "subcategory_drill" && (
                  <WithGeminiErrorBoundary viewName="subcategory_drill" onRetry={() => setView("subcategory_drill")}>
                    <Suspense fallback={<Loader />}>
                      <SubcategoryDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "guideline_drill" && (
                  <WithGeminiErrorBoundary viewName="guideline_drill" onRetry={() => setView("guideline_drill")}>
                    <Suspense fallback={<Loader />}>
                      <GuidelineDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "ventilator_hero" && (
                  <WithGeminiErrorBoundary viewName="ventilator_hero" onRetry={() => setView("ventilator_hero")}>
                    <Suspense fallback={<Loader />}>
                      <VentilatorDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "physiology_drill" && (
                  <WithGeminiErrorBoundary viewName="physiology_drill" onRetry={() => setView("physiology_drill")}>
                    <Suspense fallback={<Loader />}>
                      <PhysiologyDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "anatomy_review" && (
                  <WithGeminiErrorBoundary viewName="anatomy_review" onRetry={() => setView("anatomy_review")}>
                    <Suspense fallback={<Loader />}>
                      <AnatomyDrillSession onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "fluid_electrolyte" && (
                  <WithGeminiErrorBoundary viewName="fluid_electrolyte" onRetry={() => setView("fluid_electrolyte")}>
                    <Suspense fallback={<Loader />}>
                      <FluidElectrolyteMode onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "antibiotic_mode" && (
                  <WithGeminiErrorBoundary viewName="antibiotic_mode" onRetry={() => setView("antibiotic_mode")}>
                    <Suspense fallback={<Loader />}>
                      <AntibioticMode onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "patient_encounter" && (
                  <WithGeminiErrorBoundary viewName="patient_encounter" onRetry={() => setView("patient_encounter")}>
                    <Suspense fallback={<Loader />}>
                      <PatientEncounterMode onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "integrations" && (
                  <WithGeminiErrorBoundary viewName="integrations" onRetry={() => setView("integrations")}>
                    <Suspense fallback={<Loader />}>
                      <IntegrationsHub
                        performanceData={performanceData}
                        missedQuestions={missedQuestions}
                        onBack={() => setView("command_center")}
                      />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "panre_la" && (
                  <WithGeminiErrorBoundary viewName="panre_la" onRetry={() => setView("panre_la")}>
                    <Suspense fallback={<Loader />}>
                      <PANRELASimulator onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "code_blue_speed" && (
                  <WithGeminiErrorBoundary viewName="code_blue_speed" onRetry={() => setView("code_blue_speed")}>
                    <Suspense fallback={<Loader />}>
                      <CodeBlueSpeedMode onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "grand_rounds" && (
                  <WithGeminiErrorBoundary viewName="grand_rounds" onRetry={() => setView("grand_rounds")}>
                    <Suspense fallback={<Loader />}>
                      <GrandRoundsMode onExit={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "social_dashboard" && (
                  <WithGeminiErrorBoundary viewName="social_dashboard" onRetry={() => setView("social_dashboard")}>
                    <Suspense fallback={<Loader />}>
                      <div className="relative">
                        <button
                          onClick={() => setView("command_center")}
                          className="absolute top-4 left-4 z-10 p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-slate-600 dark:text-slate-400"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <StudyGroupDashboard />
                      </div>
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "admin_media" && (
                  <WithGeminiErrorBoundary viewName="admin_media" onRetry={() => setView("admin_media")}>
                    <Suspense fallback={<Loader />}>
                      <MediaApproval onClose={() => setView("command_center")} />
                    </Suspense>
                  </WithGeminiErrorBoundary>
                )}

                {view === "toolkit" && (
                  <motion.div
                    key="toolkit"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="toolkit" onRetry={() => setView("toolkit")}>
                      <Suspense fallback={<Loader />}>
                        <ToolkitHub
                          onClose={() => setView("command_center")}
                          onNavigateToItem={handleNavigateToDrillMode}
                        />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

                {view === "gap_analysis" && (
                  <motion.div
                    key="gap_analysis"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="gap_analysis" onRetry={() => setView("gap_analysis")}>
                      <Suspense fallback={<Loader />}>
                        <GapAnalysisDashboard />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

                {view === "clinical_profile" && (
                  <motion.div
                    key="clinical_profile"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="clinical_profile" onRetry={() => setView("clinical_profile")}>
                      <Suspense fallback={<Loader />}>
                        <ClinicalProfileDashboard />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

                {view === "training_menu" && (
                  <motion.div
                    key="training_menu"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="training_menu" onRetry={() => setView("training_menu")}>
                      <Suspense fallback={<Loader />}>
                        <TrainingMenu
                          onClose={() => setView("command_center")}
                          onNavigateToMode={(route, mode) => handleNavigateToDrillMode(mode.id)}
                          onStartSession={handleTrainingMenuStart}
                          dueQuestionsCount={dueQuestionsCount}
                          flaggedQuestionsCount={flaggedQuestions.length}
                          growthAreasCount={growthAreas.length}
                        />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

                {view === "simulation_page" && (
                  <motion.div
                    key="simulation_page"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="simulation_page" onRetry={() => setView("simulation_page")}>
                      <Suspense fallback={<Loader />}>
                        <SimulationPage
                          onStartSession={handleConfirmSession}
                          onBack={() => setView("command_center")}
                          performanceData={heatmapPerformance}
                          flaggedQuestions={flaggedQuestions}
                          growthAreas={growthAreas}
                          examLabel={examLabel}
                        />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

                {view === "command_center_page" && (
                  <motion.div
                    key="command_center_page"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <WithGeminiErrorBoundary viewName="command_center_page" onRetry={() => setView("command_center_page")}>
                      <Suspense fallback={<Loader />}>
                        <CommandCenterPage
                          performanceData={heatmapPerformance}
                          missedQuestions={missedQuestions}
                          flaggedQuestions={flaggedQuestions}
                          growthAreas={growthAreas}
                          dueCount={dueQuestionsCount}
                          examLabel={examLabel}
                          onStartSession={handleConfirmSession}
                          onNavigateToDrillMode={handleNavigateToDrillMode}
                          onNavigateToToolkit={() => setView("toolkit")}
                          onNavigateToGapAnalysis={() => setView("gap_analysis")}
                          onNavigateToIntegrations={() => setView("integrations")}
                          onNavigateToReference={() => setView("reference_library")}
                          onBack={() => setView("command_center")}
                        />
                      </Suspense>
                    </WithGeminiErrorBoundary>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
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
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Training Command Center</h2>
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

          {/* User Profile Onboarding Modal */}
          <Suspense fallback={null}>
            <UserProfileModal
              isOpen={isOnboardingModalOpen}
              onComplete={handleOnboardingComplete}
              onSkip={handleOnboardingSkip}
              canSkip={true}
            />
          </Suspense>
        </div>
      </CommuterProvider>
    </ToastProvider>
  );
};

export default App;
