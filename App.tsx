// App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import QuizView from "./components/QuizView";
import MenuView from "./components/MenuView";
import Loader from "./components/Loader";
import PhotoDrillSession from "./components/PhotoDrillSession";
import RapidRecallDrill from "./components/drill/recall/RapidRecallDrill";
import DDxCompareDrill from "./components/drill/ddx/DDxCompareDrill";
import MiniLabDrillSession from "./components/drill/MiniLabDrillSession";
import PharmDrillSession from "./components/drill/PharmDrillSession";
import FirstLineDrillSession from "./components/drill/FirstLineDrillSession";
import ConditionDrillSession from "./components/drill/ConditionDrillSession";
import GuidelineDrillSession from "./components/drill/GuidelineDrillSession";
import SettingsStatsModal from "./components/SettingsStatsModal";
import ThemeToggleButton from "./components/ThemeToggleButton";
import { prefetchQuestions } from "./services/geminiService";
import type {
  Question,
  PerformanceRecord,
  SessionSettings,
  SystemCode,
} from "./types";
import type { TrainingModeId } from "./config/training-modes";

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

type View = "menu" | "quiz" | "photo_drill" | "ecg_drill" | "derm_drill" | "imaging_drill" | "rapid_recall" | "ddx_compare" | "mini_lab" | "pharmacology" | "first_line_treatment" | "condition_drill" | "guideline_drill";

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
  const [view, setView] = useState<View>("menu");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionSettings, setSessionSettings] = useState<SessionSettings | null>(
    null
  );
  const [questionQueue, setQuestionQueue] = useState<Question[]>([]);

  const [performanceData, setPerformanceData] = useState<PerformanceRecord[]>(
    () => safeParse<PerformanceRecord[]>(
      window.localStorage.getItem(PERFORMANCE_KEY),
      []
    )
  );
  const [missedQuestions, setMissedQuestions] = useState<Question[]>(() =>
    safeParse<Question[]>(window.localStorage.getItem(MISSED_KEY), [])
  );
  const [flaggedQuestions, setFlaggedQuestions] = useState<Question[]>(() =>
    safeParse<Question[]>(window.localStorage.getItem(FLAGGED_KEY), [])
  );

  const [fontSizeAdjustment, setFontSizeAdjustment] = useState<number>(0);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // ---- persist to localStorage whenever these change ----
  useEffect(() => {
    window.localStorage.setItem(
      PERFORMANCE_KEY,
      JSON.stringify(performanceData)
    );
  }, [performanceData]);

  useEffect(() => {
    window.localStorage.setItem(MISSED_KEY, JSON.stringify(missedQuestions));
  }, [missedQuestions]);

  useEffect(() => {
    window.localStorage.setItem(FLAGGED_KEY, JSON.stringify(flaggedQuestions));
  }, [flaggedQuestions]);

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
    }
  };

  // Animation variants for page transitions
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  const pageTransition = {
    duration: 0.3,
    ease: "easeInOut"
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-300">
      {/* Header with theme toggle and settings */}
      <header className="sticky top-0 z-40 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border)] transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--color-accent)]">PANaCEa</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Settings and Stats"
            >
              <Settings className="w-5 h-5" />
            </button>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      {/* Settings/Stats Modal */}
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

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        {isLoading && <Loader />}
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
              <MenuView
                performanceData={heatmapPerformance}
                missedQuestions={missedQuestions}
                flaggedQuestions={flaggedQuestions}
                onBackToQuiz={handleBackToQuiz}
                hasActiveSession={hasActiveSession}
                clearPerformanceData={clearPerformanceData}
                clearMissedQuestionsData={clearMissedQuestionsData}
                clearFlaggedQuestionsData={clearFlaggedQuestionsData}
                setIsLoading={setIsLoading}
                setError={setError}
                onStartSession={handleStartSession}
                isModalOpen={isModalOpen}
                onCloseModal={() => setIsModalOpen(false)}
                onConfirmSession={handleConfirmSession}
                growthAreas={growthAreas}
                onNavigateToDrillMode={handleNavigateToDrillMode}
              />
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
              <QuizView
                initialQueue={questionQueue}
                setParentQueue={setQuestionQueue}
                addPerformanceRecord={addPerformanceRecord}
                addMissedQuestion={addMissedQuestion}
                updateReviewQuestion={updateReviewQuestion}
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
            </motion.div>
          )}

          {view === "photo_drill" && (
            <PhotoDrillSession onExit={() => setView("menu")} />
          )}

          {/* ECG, Derm, and Imaging drills use the same PhotoDrillSession component with different filters */}
          {view === "ecg_drill" && (
            <PhotoDrillSession onExit={() => setView("menu")} filterType="ecg" />
          )}

          {view === "derm_drill" && (
            <PhotoDrillSession onExit={() => setView("menu")} filterType="derm" />
          )}

          {view === "imaging_drill" && (
            <PhotoDrillSession onExit={() => setView("menu")} filterType="imaging" />
          )}

          {view === "rapid_recall" && (
            <RapidRecallDrill onExit={() => setView("menu")} />
          )}

          {view === "ddx_compare" && (
            <DDxCompareDrill onExit={() => setView("menu")} />
          )}

          {view === "mini_lab" && (
            <MiniLabDrillSession onExit={() => setView("menu")} />
          )}

          {view === "pharmacology" && (
            <PharmDrillSession onExit={() => setView("menu")} />
          )}

          {view === "first_line_treatment" && (
            <FirstLineDrillSession onExit={() => setView("menu")} />
          )}

          {view === "condition_drill" && (
            <ConditionDrillSession onExit={() => setView("menu")} />
          )}

          {view === "guideline_drill" && (
            <GuidelineDrillSession onExit={() => setView("menu")} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
