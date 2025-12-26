// components/TopicDetailModal.tsx

import React, { useMemo, useState } from "react";
import { X } from 'lucide-react';
import type { TopicStats, PerformanceRecord } from "../types";
import { ABBREVIATION_TO_TOPIC_MAP } from "../src/constants";

interface TopicDetailModalProps {
  topicStats: TopicStats;                    // system-level stats from heatmap
  performanceData: PerformanceRecord[];      // full history
  onClose: () => void;
  onStartSession: (topicAbbr: string) => void;
}

interface SubcategoryStat {
  name: string;
  correct: number;
  total: number;
  score: number;
}

interface ConditionStat {
  key: string;        // conditionId or name
  name: string;       // human-readable condition name
  subcategory: string;
  correct: number;
  total: number;
  score: number;
}

const TopicDetailModal: React.FC<TopicDetailModalProps> = ({
  topicStats,
  performanceData,
  onClose,
  onStartSession,
}) => {
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);

  const systemCode = topicStats.topic; // e.g. "NEURO"
  const systemLabel =
    ABBREVIATION_TO_TOPIC_MAP[systemCode] || `${systemCode} System`;

  // PANCE-level ALL-sessions, filtered to this system
  const { subcategoryStats, conditionStats, systemTotals } = useMemo(() => {
    const filtered = performanceData.filter((r) => {
      // PANCE-level ALL sessions only
      if (r.focus !== "all") return false;

      // Match by system if present; fall back to topic for older records
      const matchesSystem =
        (r.system && r.system === systemCode) || r.topic === systemCode;

      return matchesSystem;
    });

    let systemCorrect = 0;
    let systemTotal = 0;

    const subMap = new Map<
      string,
      { correct: number; total: number }
    >();
    const condMap = new Map<
      string,
      { name: string; subcategory: string; correct: number; total: number }
    >();

    for (const rec of filtered) {
      systemTotal += 1;
      if (rec.isCorrect) systemCorrect += 1;

      const sub = rec.subcategory || "Uncategorized";

      // Subcategory buckets
      const subEntry = subMap.get(sub) || { correct: 0, total: 0 };
      subEntry.total += 1;
      if (rec.isCorrect) subEntry.correct += 1;
      subMap.set(sub, subEntry);

      // Condition buckets (skip if we have no condition)
      const condName = rec.condition || "Unspecified condition";
      const condKey = rec.conditionId || condName;

      const condEntry =
        condMap.get(condKey) || {
          name: condName,
          subcategory: sub,
          correct: 0,
          total: 0,
        };
      condEntry.total += 1;
      if (rec.isCorrect) condEntry.correct += 1;
      condMap.set(condKey, condEntry);
    }

    const subcategoryStats: SubcategoryStat[] = Array.from(
      subMap.entries()
    )
      .map(([name, { correct, total }]) => ({
        name,
        correct,
        total,
        score: total > 0 ? (correct / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const conditionStats: ConditionStat[] = Array.from(
      condMap.entries()
    )
      .map(([key, { name, subcategory, correct, total }]) => ({
        key,
        name,
        subcategory,
        correct,
        total,
        score: total > 0 ? (correct / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return {
      subcategoryStats,
      conditionStats,
      systemTotals: {
        correct: systemCorrect,
        total: systemTotal,
        score: systemTotal > 0 ? (systemCorrect / systemTotal) * 100 : 0,
      },
    };
  }, [performanceData, systemCode]);

  const getBarColor = (score: number) => {
    if (score < 50) return "bg-red-500";
    if (score < 80) return "bg-yellow-500";
    return "bg-green-600";
  };

  const displayedSystemScore =
    systemTotals.total > 0 ? systemTotals.score : topicStats.score;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <h2 className="text-xl font-bold text-[#3D1B0E] mb-2 text-center">
          {systemLabel}
        </h2>

        {/* System score */}
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-slate-900">
            {displayedSystemScore.toFixed(0)}%
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Based on {systemTotals.total || topicStats.total} questions (
            {systemTotals.correct || topicStats.correct}/
            {systemTotals.total || topicStats.total})
          </p>
        </div>

        {/* Subcategories */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Subcategory mastery
          </h3>
          {subcategoryStats.length === 0 ? (
            <p className="text-xs text-slate-500">
              No detailed data yet for this system. Answer a few more questions
              and come back.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {subcategoryStats.map((sub) => (
                <button
                  key={sub.name}
                  onClick={() =>
                    setActiveSubcategory(
                      activeSubcategory === sub.name ? null : sub.name
                    )
                  }
                  className={`w-full text-left p-2 rounded-md border ${
                    activeSubcategory === sub.name
                      ? "border-[#3D1B0E] bg-[#f4ece9]"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  } transition-colors`}
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-700">
                      {sub.name}
                    </span>
                    <span className="text-slate-600">
                      {sub.score.toFixed(0)}% ({sub.correct}/{sub.total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getBarColor(sub.score)}`}
                      style={{ width: `${sub.score}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conditions under selected subcategory */}
        {activeSubcategory && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Conditions in{" "}
              <span className="underline">{activeSubcategory}</span>
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {conditionStats
                .filter((c) => c.subcategory === activeSubcategory)
                .map((c) => (
                  <div
                    key={c.key}
                    className="p-2 bg-slate-50 rounded-md border border-slate-200"
                  >
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-medium text-slate-700">
                        {c.name}
                      </span>
                      <span className="text-slate-600">
                        {c.score.toFixed(0)}% ({c.correct}/{c.total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${getBarColor(
                          c.score
                        )}`}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Start session */}
        <button
          onClick={() => onStartSession(systemCode)}
          className="w-full mt-5 px-4 py-3 bg-[#3D1B0E] text-white font-semibold rounded-lg hover:bg-[#2b130a] transition-colors"
        >
          Start Session on {systemLabel}
        </button>
      </div>
    </div>
  );
};

export default TopicDetailModal;