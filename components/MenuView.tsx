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
import { findConditionMetaById, searchConditions } from "../src/lib/conditionSearch";
import { searchDrugs, findDrugByName } from "../src/lib/drugSearch";
import type { DrugEntry, DrugSearchResult } from "../pharm/drugTypes";
import { 
  WidgetGrid, 
  TimeScopeFilter, 
  HeatmapCalendar, 
  SystemComparison,
  DEFAULT_WIDGET_CONFIG 
} from "./ProgressDashboard";
import type { WidgetId, WidgetData, TimeScope, ProgressDayRecord, SystemMasterySummary } from "./ProgressDashboard";

interface MenuViewProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  onBackToQuiz: () => void; // "Continue Session"
  hasActiveSession: boolean;
  clearPerformanceData: () => void;
  clearMissedQuestionsData: () => void;
  clearFlaggedQuestionsData: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  onStartSession: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onConfirmSession: (settings: SessionSettings) => void;
  growthAreas: string[];
  /** Callback for navigating to dedicated drill mode views */
  onNavigateToDrillMode?: (modeId: string) => void;
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
  clearPerformanceData,
  clearMissedQuestionsData,
  clearFlaggedQuestionsData,
  onStartSession,
  isModalOpen,
  onCloseModal,
  onConfirmSession,
  growthAreas,
  onNavigateToDrillMode,
}) => {
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(
    null
  );
  const [selectedDrug, setSelectedDrug] = useState<DrugEntry | null>(null);
  
  // Dashboard state
  const [timeScope, setTimeScope] = useState<TimeScope>('1wk');
  const [enabledWidgets, setEnabledWidgets] = useState<WidgetId[]>(() => {
    try {
      const stored = localStorage.getItem('panacea_widget_preferences');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return DEFAULT_WIDGET_CONFIG.filter(w => w.enabled).map(w => w.id);
  });

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
    
    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    for (let i = performanceData.length - 1; i >= 0; i--) {
      if (performanceData[i].isCorrect) {
        tempStreak++;
        if (i === performanceData.length - 1 || 
            (i < performanceData.length - 1 && performanceData[i + 1].isCorrect)) {
          currentStreak = tempStreak;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
        if (i === performanceData.length - 1) {
          currentStreak = 0;
        }
      }
    }
    
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
      overallAccuracy: Math.round((totalCorrect / Math.max(totalQuestions, 1)) * 100),
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
        accuracy: data.attempts > 0 ? (data.correct / data.attempts) * 100 : 0,
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

    return {
      overallScore,
      correct360,
      total360: last360.length,
      systemStats,
      topicScores,
      widgetData,
      heatmapData,
      systemComparisonData,
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

  // Combined search results for conditions and drugs with weighted ordering
  // If a drug name closely matches the query, it should appear first (before conditions)
  const { conditionResults, drugResults, drugsFirst } = useMemo(
    () => {
      const conditions = searchConditions(searchQuery);
      const drugs = searchDrugs(searchQuery);
      
      // Determine if drugs should be shown first based on weighted matching
      // If any drug has a high score (exact or starts-with match on drug name), prioritize drugs
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const hasDrugNameMatch = drugs.some(drug => {
        const drugNameLower = drug.drugName.toLowerCase();
        // Exact match or starts-with match on drug name = high priority
        return drugNameLower === normalizedQuery || 
               drugNameLower.startsWith(normalizedQuery) ||
               drug.score >= 2.5; // Score >= 2.5 indicates exact or starts-with match
      });
      
      return { 
        conditionResults: conditions, 
        drugResults: drugs,
        drugsFirst: hasDrugNameMatch
      };
    },
    [searchQuery]
  );

  // Check if we have any search results
  const hasSearchResults = conditionResults.length > 0 || drugResults.length > 0;

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

        {/* Unified search for conditions and drugs */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-2xl mx-auto mb-10 relative"
        >
          <div className="flex justify-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions or medications (e.g., ACS, Fluoxetine, DKA, Metoprolol)..."
              className="w-full px-4 py-3 border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)] rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] transition-all placeholder:text-[var(--color-text-muted)]"
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
                {/* Weighted Search: Show Drugs first if query matches a drug name */}
                {drugsFirst && drugResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                        💊 Pharmacology
                      </span>
                    </div>
                    {drugResults.slice(0, 10).map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          const drug = findDrugByName(result.drugName);
                          if (drug) {
                            setSelectedDrug(drug);
                          }
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {result.drugName}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                            {result.drugClass}{result.subclass ? ` • ${result.subclass}` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Conditions section */}
                {conditionResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                        Conditions
                      </span>
                    </div>
                    {conditionResults.slice(0, 10).map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          const meta = findConditionMetaById(result.id);
                          if (meta) {
                            setSelectedCondition(meta);
                          }
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {result.condition}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                            {result.system} • {result.subcategory}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                
                {/* Drugs/Pharmacology section (shown after conditions if not drugsFirst) */}
                {!drugsFirst && drugResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                        💊 Pharmacology
                      </span>
                    </div>
                    {drugResults.slice(0, 10).map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          const drug = findDrugByName(result.drugName);
                          if (drug) {
                            setSelectedDrug(drug);
                          }
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {result.drugName}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                            {result.drugClass}{result.subclass ? ` • ${result.subclass}` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="space-y-10">
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
              className="w-full px-6 py-4 btn-glass text-lg font-bold rounded-xl"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
            >
              {hasActiveSession ? "Start New Session" : "Start Study Session"}
            </motion.button>
          </motion.section>

          {/* Analytics Dashboard */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
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
          </motion.section>

          {/* Study Activity Heatmap */}
          {stats.heatmapData.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
                Study Activity
              </h2>
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
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
                System Performance
              </h2>
              <SystemComparison 
                summary={stats.systemComparisonData}
                onSystemClick={(system) => setSelectedSystem(system as SystemCode)}
              />
            </motion.section>
          )}

          {/* Knowledge map – now by PANCE system */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-5">
              Knowledge Map (PANCE Systems)
            </h2>
            <TopicHeatmap
              topicScores={stats.topicScores || []}
              onTopicClick={(topicStats) => {
                // topicStats is a TopicStats object; its `.topic` is your "CV", "GI", etc.
                setSelectedSystem(topicStats.topic as SystemCode);
              }}
            />
          </motion.section>

          {/* Data management */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
              Manage Data
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={clearPerformanceData}
                className="px-4 py-2 bg-red-500/90 dark:bg-red-600/80 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-500 text-sm transition-colors"
              >
                Clear All Performance Data
              </button>
              <button
                onClick={clearMissedQuestionsData}
                disabled={missedQuestions.length === 0}
                className="px-4 py-2 bg-red-500/90 dark:bg-red-600/80 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-500 disabled:bg-[var(--color-text-muted)] disabled:cursor-not-allowed text-sm transition-colors"
                title={
                  missedQuestions.length === 0
                    ? "No missed questions to clear"
                    : "Clear missed questions bank"
                }
              >
                Clear Missed Qs ({missedQuestions.length})
              </button>
              <button
                onClick={clearFlaggedQuestionsData}
                disabled={flaggedQuestions.length === 0}
                className="px-4 py-2 bg-red-500/90 dark:bg-red-600/80 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-500 disabled:bg-[var(--color-text-muted)] disabled:cursor-not-allowed text-sm transition-colors"
                title={
                  flaggedQuestions.length === 0
                    ? "No flagged questions to clear"
                    : "Clear flagged questions"
                }
              >
                Clear Flagged Qs ({flaggedQuestions.length})
              </button>
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
};

export default MenuView;
