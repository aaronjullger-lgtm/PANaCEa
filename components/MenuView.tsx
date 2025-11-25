// src/components/MenuView.tsx

import React, { useMemo, useState } from "react";
import type {
  PerformanceRecord,
  SessionSettings,
  Question,
  TopicStats,
  SystemCode,
} from "../types";
import SessionSetupModal from "./SessionSetupModal";
import ProgressRing from "./ProgressRing";
import TopicHeatmap from "./TopicHeatmap";
import SystemDrilldownModal from "./SystemDrilldownModal";
import { ABBREVIATION_TO_TOPIC_MAP } from "../constants";
import type { SystemDrilldownSelection } from "./SystemDrilldownModal";
import type { ConditionMeta } from "../conditionRegistry";
import ConditionDetailModal from "./ConditionDetailModal";
import {
  findConditionMetaById,
  searchConditions,
  type SearchResult,
} from "../src/lib/conditionSearch";
import DrugModal from "../src/components/modals/DrugModal";
import { findPharmacologyEntryById } from "../src/services/pharmacologyRegistry";

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
}) => {
  const [selectedSystem, setSelectedSystem] = useState<SystemCode | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<ConditionMeta | null>(
    null
  );
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);

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

  const openConditionModal = (conditionId: string) => {
    const meta = findConditionMetaById(conditionId);
    if (meta) {
      setSelectedCondition(meta);
    }
  };

  const openDrugModal = (drugId: string) => {
    const entry = findPharmacologyEntryById(drugId);
    if (entry) {
      setSelectedDrugId(entry.id);
    }
  };

  const searchResults: SearchResult[] = useMemo(
    () => {
      const results = searchConditions(searchQuery);
      return results;
    },
    [searchQuery]
  );

  return (
    <>
      {isModalOpen && (
        <SessionSetupModal
          onClose={onCloseModal}
          onStart={onConfirmSession}
          growthAreas={growthAreas}
          dueQuestionsCount={dueQuestionsCount}
          flaggedQuestionsCount={flaggedQuestions.length}
        />
      )}

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

      {selectedDrugId && (
        <DrugModal
          drugId={selectedDrugId}
          onClose={() => setSelectedDrugId(null)}
        />
      )}

      <div className="flex flex-col max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-[#3D1B0E] mb-3 text-center">
          PANaCEa
        </h1>

        {/* Condition search */}
        <div className="w-full max-w-2xl mx-auto mb-10 relative">
          <div className="flex justify-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conditions or drugs (e.g., ACS, metformin)..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3D1B0E]/70 focus:border-[#3D1B0E]"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    if (result.type === "condition") {
                      openConditionModal(result.id);
                    } else {
                      openDrugModal(result.id);
                    }
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-800">
                      {result.term}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      {result.type === "condition"
                        ? `${result.system} • ${result.subcategory}`
                        : `${result.class}${result.subclass ? ` • ${result.subclass}` : ""}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-10">
          {/* Session controls */}
          <section className="text-center space-y-3">
            {hasActiveSession && (
              <button
                onClick={onBackToQuiz}
                className="w-full px-6 py-3 bg-[#3D1B0E] text-white font-bold rounded-lg hover:bg-[#2b130a] transition-colors shadow-md"
              >
                Continue Study Session
              </button>
            )}
            <button
              onClick={onStartSession}
              className="w-full px-6 py-4 bg-[#3D1B0E] text-white text-lg font-bold rounded-lg hover:bg-[#2b130a] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {hasActiveSession ? "Start New Session" : "Start Study Session"}
            </button>
          </section>

          {/* Overall performance ring */}
          <section className="pt-2">
            <h2 className="text-xl font-bold text-[#3D1B0E] mb-5 text-center">
              Overall Score
            </h2>
            <div className="flex flex-col items-center p-5 bg-slate-50 rounded-xl shadow-sm gap-2">
              <ProgressRing score={stats.overallScore} />
              <p className="text-sm font-normal text-slate-500">
                Based on the last {stats.total360} questions (
                {stats.correct360}/{stats.total360})
              </p>
            </div>
          </section>

          {/* Knowledge map – now by PANCE system */}
          <section>
            <h2 className="text-xl font-bold text-[#3D1B0E] mb-5">
              Knowledge Map (PANCE Systems)
            </h2>
            <TopicHeatmap
              topicScores={stats.topicScores || []}
              onTopicClick={(topicStats) => {
                // topicStats is a TopicStats object; its `.topic` is your "CV", "GI", etc.
                setSelectedSystem(topicStats.topic as SystemCode);
              }}
            />
          </section>

          {/* Data management */}
          <section>
            <h2 className="text-xl font-bold text-[#3D1B0E] mb-3">
              Manage Data
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={clearPerformanceData}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
              >
                Clear All Performance Data
              </button>
              <button
                onClick={clearMissedQuestionsData}
                disabled={missedQuestions.length === 0}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-sm"
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
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-sm"
                title={
                  flaggedQuestions.length === 0
                    ? "No flagged questions to clear"
                    : "Clear flagged questions"
                }
              >
                Clear Flagged Qs ({flaggedQuestions.length})
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default MenuView;
