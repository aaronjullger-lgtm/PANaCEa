// src/components/MenuView.tsx

import React, { useMemo, useState } from "react";
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
import { findConditionMetaById, searchConditions } from "../src/lib/conditionSearch";

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

    return {
      overallScore,
      correct360,
      total360: last360.length,
      systemStats,
      topicScores,
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

  const searchResults = useMemo(
    () => {
      const results = searchConditions(searchQuery);
      return results;
    },
    [searchQuery]
  );

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

      <div className="flex flex-col max-w-5xl mx-auto px-4">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-[var(--color-accent)] mb-3 text-center sr-only"
        >
          PANaCEa
        </motion.h1>

        {/* Condition search */}
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
              placeholder="Search conditions (e.g., ACS, Diverticulitis, DKA)..."
              className="w-full px-4 py-3 border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)] rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] transition-all placeholder:text-[var(--color-text-muted)]"
            />
          </div>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-30 mt-2 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl shadow-lg max-h-64 overflow-y-auto"
              >
                {searchResults.map((result) => (
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
                    className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors"
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
                className="w-full px-6 py-3 bg-[var(--color-accent)] text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                Continue Study Session
              </motion.button>
            )}
            <motion.button
              onClick={onStartSession}
              className="w-full px-6 py-4 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] text-white text-lg font-bold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
            >
              {hasActiveSession ? "Start New Session" : "Start Study Session"}
            </motion.button>
          </motion.section>

          {/* Overall performance ring */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2"
          >
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-5 text-center">
              Overall Score
            </h2>
            <div className="flex flex-col items-center p-5 bg-[var(--color-card-bg)] rounded-xl shadow-sm gap-2 border border-[var(--color-border)]">
              <ProgressRing score={stats.overallScore} />
              <p className="text-sm font-normal text-[var(--color-text-muted)]">
                Based on the last {stats.total360} questions (
                {stats.correct360}/{stats.total360})
              </p>
            </div>
          </motion.section>

          {/* Knowledge map – now by PANCE system */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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
            transition={{ delay: 0.3 }}
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
