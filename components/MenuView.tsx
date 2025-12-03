// src/components/MenuView.tsx

import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  PerformanceRecord,
  SessionSettings,
  Question,
  TopicStats,
  SystemCode,
} from "../types";
import TrainingMenu from "./dashboard/TrainingMenu";
import ProgressRing from "./ProgressRing";
import TopicHeatmap from "./TopicHeatmap";
import SystemDrilldownModal from "./SystemDrilldownModal";
import { ABBREVIATION_TO_TOPIC_MAP } from "../constants";
import type { SystemDrilldownSelection } from "./SystemDrilldownModal";
import type { ConditionMeta } from "../conditionRegistry";
import ConditionDetailModal from "./ConditionDetailModal";
import DrugDetailModal from "./DrugDetailModal";
import { findConditionMetaById } from "../src/lib/conditionSearch";
import { findDrugByName } from "../src/lib/drugSearch";
import { unifiedSearch } from "../src/lib/unifiedSearch";
import type { DrugEntry } from "../pharm/drugTypes";
import { 
  WidgetGrid, 
  TimeScopeFilter, 
  HeatmapCalendar, 
  SystemComparison,
  DEFAULT_WIDGET_CONFIG,
  RootCauseAnalysis,
  DailyPrescription
} from "./ProgressDashboard";
import type { WidgetId, WidgetData, TimeScope, ProgressDayRecord, SystemMasterySummary, ErrorTagCount } from "./ProgressDashboard";
import { calculateAccuracy, calculateStreaks, loadWidgetPreferences } from "../lib/dashboardUtils";
import type { ErrorTag } from "../types";
import { AuthButton } from "./AuthButton";

// System names for dynamic welcome message
const SYSTEM_DISPLAY_NAMES: Record<string, string> = {
  CV: 'Cardiovascular',
  PULM: 'Pulmonary',
  GI: 'Gastrointestinal',
  NEURO: 'Neurology',
  MSK: 'Musculoskeletal',
  DERM: 'Dermatology',
  HEME: 'Hematology',
  ENDO: 'Endocrine',
  HEENT: 'Head & Neck',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  PSYCH: 'Psychiatry',
  ID: 'Infectious Disease',
  GU: 'Genitourinary',
  PRO: 'Professional Practice',
};

// Get time-based greeting
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface MenuViewProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  onBackToQuiz: () => void; // "Continue Session"
  hasActiveSession: boolean;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onStartSession: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onConfirmSession: (settings: SessionSettings) => void;
  growthAreas: string[];
  /** Callback for navigating to dedicated drill mode views */
  onNavigateToDrillMode?: (modeId: string) => void;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  syncError?: string | null;
}

// For the heatmap: one row per PANCE system
export interface SystemStats {
  system: SystemCode;
  label: string;
  score: number; // % correct
  correct: number; // # correct
  total: number; // # attempts
}

const MenuView: React.FC<MenuViewProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  onBackToQuiz,
  hasActiveSession,
  onStartSession,
  isModalOpen,
  onCloseModal,
  onConfirmSession,
  growthAreas,
  onNavigateToDrillMode,
  isSyncing,
  lastSyncTime,
  syncError,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(
    null
  );
  const [selectedDrug, setSelectedDrug] = useState<DrugEntry | null>(null);
  
  // Dashboard state
  const [timeScope, setTimeScope] = useState<TimeScope>('1wk');
  const defaultWidgets = DEFAULT_WIDGET_CONFIG.filter(w => w.enabled).map(w => w.id);
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(() => 
    loadWidgetPreferences<WidgetId>(defaultWidgets)
  );

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isModalOpen]);

  const stats = useMemo(() => {
    // Overall score = last 360 questions (any mode) as before
    const last360 = performanceData.slice(-360);
    const correct360 = last360.filter((q) => q.isCorrect).length;
    const overallScore =
      last360.length > 0 ? (correct360 / last360.length) * 100 : 0;

    // Heatmap: ONLY PANCE-level ALL-topics sessions
    const panceAllRecords = performanceData.filter(
      (r) =>
        r.focus === "all" &&
        r.difficulty === "same" &&
        r.system &&
        r.system !== "OTHER"
    ) as (PerformanceRecord & { system: SystemCode })[];

    const uniqueSystems = Array.from(
      new Set(panceAllRecords.map((r) => r.system))
    ) as SystemCode[];

    const systemStats: SystemStats[] = uniqueSystems
      .map((system) => {
        const rows = panceAllRecords.filter((r) => r.system === system);
        const correct = rows.filter((r) => r.isCorrect).length;
        const total = rows.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        const label =
          ABBREVIATION_TO_TOPIC_MAP[system] || (system as string).toString();
        return {
          system,
          label,
          score,
          correct,
          total,
        };
      })
      // Show systems with more data first
      .sort((a, b) => b.total - a.total);

    // Keep the old topicScores calc if you want it elsewhere later
    const topics: string[] = Array.from(
      new Set(performanceData.map((q) => q.topic))
    );
    const topicScores: TopicStats[] = topics
      .map((topic) => {
        const topicQuestions = performanceData
          .filter((q) => q.topic === topic)
          .slice(-100);
        const correct = topicQuestions.filter((q) => q.isCorrect).length;
        const total = topicQuestions.length;
        const score = total > 0 ? (correct / total) * 100 : 0;
        return { topic, score, correct, total };
      })
      .sort((a, b) => b.total - a.total);
    
    // Calculate widget data
    const totalQuestions = performanceData.length;
    const totalCorrect = performanceData.filter(r => r.isCorrect).length;
    
    // Calculate streaks using utility function
    const { current: currentStreak, best: bestStreak } = calculateStreaks(performanceData);
    
    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = performanceData.filter(r => 
      new Date(r.timestamp).toISOString().split('T')[0] === today
    );
    const todayQuestions = todayRecords.length;
    const todayCorrect = todayRecords.filter(r => r.isCorrect).length;
    
    // This week's stats
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekRecords = performanceData.filter(r => r.timestamp > weekAgo);
    const weekQuestions = weekRecords.length;
    const weekCorrect = weekRecords.filter(r => r.isCorrect).length;
    
    // This month's stats
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const monthRecords = performanceData.filter(r => r.timestamp > monthAgo);
    const monthQuestions = monthRecords.length;
    const monthCorrect = monthRecords.filter(r => r.isCorrect).length;
    
    // Recent trend (last 50 vs previous 50)
    const last50 = performanceData.slice(-50);
    const prev50 = performanceData.slice(-100, -50);
    const last50Accuracy = last50.length > 0 
      ? last50.filter(r => r.isCorrect).length / last50.length 
      : 0;
    const prev50Accuracy = prev50.length > 0 
      ? prev50.filter(r => r.isCorrect).length / prev50.length 
      : 0;
    const recentTrend = Math.round((last50Accuracy - prev50Accuracy) * 100);
    
    // Study days
    const uniqueDays = new Set(
      performanceData.map(r => new Date(r.timestamp).toISOString().split('T')[0])
    );
    const studyDays = uniqueDays.size;
    
    // Widget data
    const widgetData: WidgetData = {
      currentStreak,
      bestStreak,
      questionsAttempted: totalQuestions,
      overallAccuracy: calculateAccuracy(totalCorrect, totalQuestions),
      todayQuestions,
      todayCorrect,
      weekQuestions,
      weekCorrect,
      monthQuestions,
      monthCorrect,
      recentTrend,
      studyDays,
    };
    
    // Heatmap calendar data (last 90 days)
    const heatmapData: ProgressDayRecord[] = [];
    const dailyMap = new Map<string, { attempts: number; correct: number; system: string }>();
    for (const record of performanceData) {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { attempts: 0, correct: 0, system: '' };
      dailyMap.set(date, {
        attempts: existing.attempts + 1,
        correct: existing.correct + (record.isCorrect ? 1 : 0),
        system: record.system || existing.system || '',
      });
    }
    for (const [date, data] of dailyMap.entries()) {
      heatmapData.push({
        date,
        attempts: data.attempts,
        correct: data.correct,
        accuracy: calculateAccuracy(data.correct, data.attempts),
        system: data.system,
      });
    }
    
    // System comparison data with trend calculation
    const systemComparisonData: SystemMasterySummary[] = systemStats.map(s => {
      // Calculate change from last period (last 2 weeks vs 2 weeks before that)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
      
      const recentSystemRecords = performanceData.filter(
        r => r.system === s.system && r.timestamp > twoWeeksAgo
      );
      const previousSystemRecords = performanceData.filter(
        r => r.system === s.system && r.timestamp > fourWeeksAgo && r.timestamp <= twoWeeksAgo
      );
      
      const recentAccuracy = recentSystemRecords.length > 0
        ? recentSystemRecords.filter(r => r.isCorrect).length / recentSystemRecords.length
        : 0;
      const previousAccuracy = previousSystemRecords.length > 0
        ? previousSystemRecords.filter(r => r.isCorrect).length / previousSystemRecords.length
        : 0;
      
      const changeFromLastPeriod = previousSystemRecords.length >= 3 && recentSystemRecords.length >= 3
        ? Math.round((recentAccuracy - previousAccuracy) * 100)
        : undefined;
      
      return {
        system: s.system,
        questionsAnswered: s.total,
        masteryScore: s.score / 100, // normalize to 0-1
        changeFromLastPeriod,
      };
    });
    
    // Error taxonomy counts for Root Cause Analysis
    const errorCounts: ErrorTagCount[] = [
      { tag: 'knowledge_gap', count: performanceData.filter(r => !r.isCorrect && r.errorTag === 'knowledge_gap').length },
      { tag: 'misread_question', count: performanceData.filter(r => !r.isCorrect && r.errorTag === 'misread_question').length },
      { tag: 'guessing', count: performanceData.filter(r => !r.isCorrect && r.errorTag === 'guessing').length },
    ];
    const totalIncorrect = performanceData.filter(r => !r.isCorrect).length;
    
    // Vignette Stamina calculations
    const SHORT_THRESHOLD = 50;
    const LONG_THRESHOLD = 150;
    const shortQuestions = performanceData.filter(r => r.questionWordCount && r.questionWordCount < SHORT_THRESHOLD);
    const longQuestions = performanceData.filter(r => r.questionWordCount && r.questionWordCount > LONG_THRESHOLD);
    
    const shortQuestionAccuracy = shortQuestions.length >= 5 
      ? Math.round((shortQuestions.filter(r => r.isCorrect).length / shortQuestions.length) * 100)
      : undefined;
    const longQuestionAccuracy = longQuestions.length >= 5
      ? Math.round((longQuestions.filter(r => r.isCorrect).length / longQuestions.length) * 100)
      : undefined;
    
    // Add vignette stamina data to widget data
    widgetData.shortQuestionAccuracy = shortQuestionAccuracy ?? 0;
    widgetData.longQuestionAccuracy = longQuestionAccuracy ?? 0;

    return {
      overallScore,
      correct360,
      total360: last360.length,
      systemStats,
      topicScores,
      widgetData,
      heatmapData,
      systemComparisonData,
      errorCounts,
      totalIncorrect,
    };
  }, [performanceData]);

  const dueQuestionsCount = useMemo(() => {
    if (!missedQuestions) return 0;
    const today = new Date().toISOString().split("T")[0];
    return missedQuestions.filter(
      (q) => q.nextReviewDate && q.nextReviewDate <= today
    ).length;
  }, [missedQuestions]);

  const handleTopicSessionStart = (topicAbbr: string) => {
    onConfirmSession({
      focus: "topic",
      difficulty: "same",
      topic: topicAbbr,
    });
  };

  // Handler for starting a focused session from Daily Prescription
  const handleStartFocusSession = (system: SystemCode) => {
    onConfirmSession({
      focus: "topic",
      difficulty: "same",
      topic: system,
    });
  };

  // Unified search results with intelligent ranking
  const searchResults = useMemo(
    () => unifiedSearch(searchQuery),
    [searchQuery]
  );

  // Check if we have any search results
  const hasSearchResults = searchResults.length > 0;

  return (
    <>
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            onClick={onCloseModal}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Training Command Center</h2>
                <button
                  onClick={onCloseModal}
                  className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <TrainingMenu
                onStartSession={(modeId, focus) => {
                  // Map TrainingMenu focus to SessionSettings format
                  let sessionFocus: SessionSettings['focus'] = 'all';
                  if (focus === 'flagged') sessionFocus = 'reviewFlagged';
                  else if (focus === 'due') sessionFocus = 'review';
                  else if (focus === 'growth') sessionFocus = 'growth';
                  
                  onConfirmSession({
                    focus: sessionFocus,
                    difficulty: 'same',
                  });
                }}
                onNavigateToMode={(route, mode) => {
                  // Navigate to the dedicated drill mode view
                  if (onNavigateToDrillMode) {
                    onNavigateToDrillMode(mode.id);
                  }
                }}
                onClose={onCloseModal}
                dueQuestionsCount={dueQuestionsCount}
                flaggedQuestionsCount={flaggedQuestions.length}
                growthAreasCount={growthAreas.length}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedSystem && (
        <SystemDrilldownModal
          system={selectedSystem}
          performanceData={performanceData}
          onClose={() => setSelectedSystem(null)}
          onDrillSubcategory={({ system, subcategory }) => {
            if (!system) return;
            onConfirmSession({
              focus: "topic",
              difficulty: "same",
              topic: system,
              subcategoryName: subcategory,
            });
          }}
        />
      )}

      {selectedCondition && (
        <ConditionDetailModal
          condition={selectedCondition}
          onClose={() => setSelectedCondition(null)}
          onDrillCondition={(meta) => {
            onConfirmSession({
              focus: "topic",
              difficulty: "same",
              topic: meta.system,
              conditionName: meta.condition,
            });
            setSelectedCondition(null);
          }}
        />
      )}

      {selectedDrug && (
        <DrugDetailModal
          drug={selectedDrug}
          onClose={() => setSelectedDrug(null)}
        />
      )}

      <div className="flex flex-col max-w-5xl mx-auto px-4">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[var(--color-accent)] mb-3 text-center sr-only"
        >
          PANaCEa
        </motion.h1>

        {/* Premium Glass Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-2xl mx-auto mb-10 relative"
        >
          <div className="flex justify-center">
            <input
              id="condition-search"
              name="condition-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions or medications (e.g., ACS, Fluoxetine, DKA, Metoprolol)..."
              className="w-full px-5 py-3.5 border border-[var(--color-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl text-[var(--color-text-primary)] rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] focus:scale-[1.01] transition-all duration-300 placeholder:text-[var(--color-text-muted)]"
              autoComplete="off"
            />
          </div>
          <AnimatePresence>
            {hasSearchResults && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-30 mt-2 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl shadow-lg max-h-80 overflow-y-auto"
              >
                {/* Unified search results - intelligently ranked */}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      if (result.type === "condition" && result.conditionData) {
                        const meta = findConditionMetaById(result.id);
                        if (meta) {
                          setSelectedCondition(meta);
                        }
                      } else if (result.type === "drug" && result.drugData) {
                        const drug = findDrugByName(result.drugData.drugName);
                        if (drug) {
                          setSelectedDrug(drug);
                        }
                      }
                      setSearchQuery("");
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      {/* Icon badge */}
                      <span className="flex-shrink-0 mt-0.5 text-xs">
                        {result.type === "condition" ? "🏥" : "💊"}
                      </span>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {result.name}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                          {result.subtitle}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="space-y-10">
          {/* Daily Prescription - Smart Action Card */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <DailyPrescription 
              performanceData={performanceData}
              onStartFocusSession={handleStartFocusSession}
            />
          </motion.section>

          {/* Authentication Section */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className="flex justify-center"
          >
            <AuthButton 
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              syncError={syncError}
            />
          </motion.section>

          {/* Session controls */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-center space-y-3"
          >
            {hasActiveSession && (
              <motion.button
                onClick={onBackToQuiz}
                className="w-full px-6 py-3 btn-glass font-bold rounded-xl"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                Continue Study Session
              </motion.button>
            )}
            <motion.button
              onClick={onStartSession}
              className="w-full px-6 py-4 btn-glass text-lg font-bold tracking-tight rounded-xl"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
            >
              {hasActiveSession ? "Start New Session" : "Start Study Session"}
            </motion.button>
          </motion.section>

          {/* Analytics Dashboard with Smart Header */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2"
          >
            {/* Smart Header - Dynamic Welcome Block */}
            <div className="card-premium-glass card-noise-texture p-5 rounded-2xl mb-6">
              <h2 className="text-2xl font-light tracking-tight text-slate-900 dark:text-slate-100 mb-1">
                {getTimeBasedGreeting()}.
              </h2>
              {stats.systemComparisonData.length > 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your recommended focus is{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {SYSTEM_DISPLAY_NAMES[stats.systemComparisonData[0]?.system] || stats.systemComparisonData[0]?.system}
                  </span>
                  .
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Start studying to unlock personalized recommendations.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Analytics Dashboard
              </h2>
              <TimeScopeFilter value={timeScope} onChange={setTimeScope} />
            </div>
            
            {/* Widget Grid */}
            <WidgetGrid 
              data={stats.widgetData} 
              enabledWidgets={enabledWidgets}
              timeScope={timeScope}
            />
            
            {/* Root Cause Analysis Widget - shows breakdown of why questions are missed */}
            {stats.totalIncorrect > 0 && (
              <div className="mt-6">
                <RootCauseAnalysis 
                  errorCounts={stats.errorCounts}
                  totalIncorrect={stats.totalIncorrect}
                />
              </div>
            )}
          </motion.section>

          {/* Study Activity Heatmap */}
          {stats.heatmapData.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <HeatmapCalendar 
                records={stats.heatmapData} 
                metric="attempts"
                weeks={12}
              />
            </motion.section>
          )}

          {/* System Comparison */}
          {stats.systemComparisonData.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <SystemComparison 
                summary={stats.systemComparisonData}
                onSystemClick={(system) => setSelectedSystem(system as SystemCode)}
              />
            </motion.section>
          )}

          {/* System Mastery Grid – now by PANCE system */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-5">
              System Mastery Grid
            </h2>
            <TopicHeatmap
              topicScores={stats.topicScores || []}
              onTopicClick={(topicStats) => {
                // topicStats is a TopicStats object; its `.topic` is your "CV", "GI", etc.
                setSelectedSystem(topicStats.topic as SystemCode);
              }}
            />
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default MenuView;
