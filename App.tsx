// App.tsx
import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Keyboard } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import Loader from "./components/Loader";
import ThemeToggleButton from "./components/ThemeToggleButton";
import { LandingPage } from "./components/LandingPage";
import { AccountFooter } from "./components/AccountFooter";
import { LoadingProgress } from "./components/LoadingProgress";
import { prefetchQuestions } from "./services/geminiService";
import { useUserStats } from "./hooks/useUserStats";
import { preloadData } from "./lib/utils/dataLoader";
import { useAccessibleTransition } from "./hooks/useReducedMotion";
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
import type { TrainingModeId } from "./config/training-modes";

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
const FluidElectrolyteMode = lazy(() => import("./components/modes/FluidElectrolyteMode"));
const AntibioticMode = lazy(() => import("./components/modes/AntibioticMode"));
const PatientEncounterMode = lazy(() => import("./components/modes/PatientEncounterMode"));
const IntegrationsHub = lazy(() => import("./components/integrations/IntegrationsHub"));
const SettingsStatsModal = lazy(() => import("./components/SettingsStatsModal"));
const KeyboardShortcutsModal = lazy(() => import("./components/KeyboardShortcutsModal"));
const ARAnatomyMode = lazy(() => import("./components/ar/ARAnatomyMode"));
const PANRELASimulator = lazy(() => import("./components/lifelong-learning/PANRELASimulator"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const UserProfileModal = lazy(() => import("./components/onboarding/UserProfileModal"));

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
const DRILL_MODE_GUIDELINE: TrainingModeId = 'guideline_drill';
const DRILL_MODE_FLUID_ELECTROLYTE: TrainingModeId = 'fluid_electrolyte';
const DRILL_MODE_ANTIBIOTIC: TrainingModeId = 'antibiotic_mode';
const DRILL_MODE_PATIENT_ENCOUNTER: TrainingModeId = 'patient_encounter';

type View = "menu" | "quiz" | "integrations" | "photo_drill" | "ecg_drill" | "derm_drill" | "imaging_drill" | "rapid_recall" | "ddx_compare" | "mini_lab" | "pharmacology" | "first_line_treatment" | "condition_drill" | "guideline_drill" | "fluid_electrolyte" | "antibiotic_mode" | "patient_encounter" | "ar_anatomy" | "panre_la";

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

  const [view, setView] = useState<View>("menu");
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

  // ---- derived: “growth areas” and heatmap data ----
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

  // ---- starting a session ----
  const handleStartSession = () => {
    setIsModalOpen(true);
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
        const initialQuestions = await prefetchQuestions(
          INITIAL_QUEUE_SIZE,
          settings,
          growthAreas
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

  const handleEndSession = () => {
    // Just go back to menu; keep performance/missed/flagged
    setView("menu");
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
  const handleNavigateToDrillMode = (modeId: string) => {
    if (modeId === DRILL_MODE_PHOTO) {
      setView('photo_drill');
    } else if (modeId === DRILL_MODE_ECG) {
      setView('ecg_drill');
    } else if (modeId === DRILL_MODE_DERM) {
      setView('derm_drill');
    } else if (modeId === DRILL_MODE_IMAGING) {
      setView('imaging_drill');
    } else if (modeId === DRILL_MODE_RAPID_RECALL) {
      setView('rapid_recall');
    } else if (modeId === DRILL_MODE_DDX_COMPARE) {
      setView('ddx_compare');
    } else if (modeId === DRILL_MODE_MINI_LAB) {
      setView('mini_lab');
    } else if (modeId === DRILL_MODE_PHARMACOLOGY) {
      setView('pharmacology');
    } else if (modeId === DRILL_MODE_FIRST_LINE) {
      setView('first_line_treatment');
    } else if (modeId === DRILL_MODE_CONDITION) {
      setView('condition_drill');
    } else if (modeId === DRILL_MODE_GUIDELINE) {
      setView('guideline_drill');
    } else if (modeId === DRILL_MODE_FLUID_ELECTROLYTE) {
      setView('fluid_electrolyte');
    } else if (modeId === DRILL_MODE_ANTIBIOTIC) {
      setView('antibiotic_mode');
    } else if (modeId === DRILL_MODE_PATIENT_ENCOUNTER) {
      setView('patient_encounter');
    } else if (modeId === 'ar_anatomy') {
      setView('ar_anatomy');
    } else if (modeId === 'panre_la') {
      setView('panre_la');
    }
  };

  // Animation variants for page transitions
  // Elegant page transition animations - smooth and fluid, respects reduced motion preference
  const pageVariants = {
    initial: { opacity: 0, y: 15, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -15, scale: 0.98 }
  };

  const pageTransition = useAccessibleTransition({
    duration: 0.35,
    ease: [0.4, 0, 0.2, 1] // Custom cubic-bezier for smooth feel
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
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      {/* Loading Progress Bar */}
      <LoadingProgress isLoading={isLoading} />
      
      {/* Premium Glass Header - Elegant and professional */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/85 backdrop-blur-xl border-b border-[var(--color-border)] transition-all duration-300 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <motion.button
            onClick={() => setView("menu")}
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
            <motion.button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200"
              aria-label="Keyboard Shortcuts (Ctrl+K)"
              title="Keyboard Shortcuts (Ctrl+K)"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Keyboard className="w-5 h-5" />
            </motion.button>
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
        />
      </Suspense>

      {/* Keyboard Shortcuts Modal */}
      <Suspense fallback={null}>
        <KeyboardShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
        />
      </Suspense>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 pb-24">
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

        <AnimatePresence mode="wait">
          {view === "menu" && (
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
                  isModalOpen={isModalOpen}
                  onCloseModal={() => setIsModalOpen(false)}
                  onConfirmSession={handleConfirmSession}
                  growthAreas={growthAreas}
                  onNavigateToDrillMode={handleNavigateToDrillMode}
                  onNavigateToIntegrations={() => setView("integrations")}
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
                  onShowMenu={() => setView("menu")}
                  performanceData={heatmapPerformance}
                  fontSizeAdjustment={fontSizeAdjustment}
                  setFontSizeAdjustment={setFontSizeAdjustment}
                  flaggedQuestions={flaggedQuestions}
                  addFlaggedQuestion={addFlaggedQuestion}
                  removeFlaggedQuestion={removeFlaggedQuestion}
                  updateQuestionNote={updateQuestionNote}
                />
              </Suspense>
            </motion.div>
          )}

          {view === "photo_drill" && (
            <Suspense fallback={<Loader />}>
              <PhotoDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {/* ECG, Derm, and Imaging drills use the same PhotoDrillSession component with different filters */}
          {view === "ecg_drill" && (
            <Suspense fallback={<Loader />}>
              <PhotoDrillSession onExit={() => setView("menu")} filterType="ecg" />
            </Suspense>
          )}

          {view === "derm_drill" && (
            <Suspense fallback={<Loader />}>
              <PhotoDrillSession onExit={() => setView("menu")} filterType="derm" />
            </Suspense>
          )}

          {view === "imaging_drill" && (
            <Suspense fallback={<Loader />}>
              <PhotoDrillSession onExit={() => setView("menu")} filterType="imaging" />
            </Suspense>
          )}

          {view === "rapid_recall" && (
            <Suspense fallback={<Loader />}>
              <RapidRecallDrill onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "ddx_compare" && (
            <Suspense fallback={<Loader />}>
              <DDxCompareDrill onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "mini_lab" && (
            <Suspense fallback={<Loader />}>
              <MiniLabDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "pharmacology" && (
            <Suspense fallback={<Loader />}>
              <PharmDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "first_line_treatment" && (
            <Suspense fallback={<Loader />}>
              <FirstLineDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "condition_drill" && (
            <Suspense fallback={<Loader />}>
              <ConditionDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "guideline_drill" && (
            <Suspense fallback={<Loader />}>
              <GuidelineDrillSession onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "fluid_electrolyte" && (
            <Suspense fallback={<Loader />}>
              <FluidElectrolyteMode onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "antibiotic_mode" && (
            <Suspense fallback={<Loader />}>
              <AntibioticMode onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "patient_encounter" && (
            <Suspense fallback={<Loader />}>
              <PatientEncounterMode onExit={() => setView("menu")} />
            </Suspense>
          )}

          {view === "integrations" && (
            <Suspense fallback={<Loader />}>
              <IntegrationsHub
                performanceData={performanceData}
                missedQuestions={missedQuestions}
                onBack={() => setView("menu")}
              />
            </Suspense>
          )}

          {view === "ar_anatomy" && (
            <Suspense fallback={<Loader />}>
              <ARAnatomyMode onClose={() => setView("menu")} />
            </Suspense>
          )}

          {view === "panre_la" && (
            <Suspense fallback={<Loader />}>
              <PANRELASimulator onExit={() => setView("menu")} />
            </Suspense>
          )}
        </AnimatePresence>
      </div>

      {/* Account Footer - Persistent bottom bar */}
      <AccountFooter
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        syncError={syncError}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Command Palette */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={handleNavigateToDrillMode}
        />
      </Suspense>

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
  );
};

export default App;
