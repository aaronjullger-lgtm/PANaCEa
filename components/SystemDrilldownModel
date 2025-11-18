import React, { useMemo, useState } from "react";
import type { PerformanceRecord, SystemCode } from "../types";

export type SystemDrilldownSelection = {
  system: SystemCode;
  /** Optional pre-filtered records for this system */
  records?: PerformanceRecord[];
};

interface SystemDrilldownModalProps {
  /** 
   * Be flexible with prop names so we don't fight TypeScript:
   * MenuView might pass `system`, `systemCode`, or a `selection` object.
   */
  system?: SystemCode;
  systemCode?: SystemCode;
  selection?: SystemDrilldownSelection;
  records?: PerformanceRecord[];
  performanceData?: PerformanceRecord[];
  onClose: () => void;
}

const SYSTEM_LABELS: Record<SystemCode, string> = {
  CV: "Cardiovascular",
  DERM: "Dermatology",
  ENDO: "Endocrine",
  GI: "Gastrointestinal",
  GU: "Genitourinary",
  HEME: "Hematology",
  HEENT: "HEENT",
  ID: "Infectious Disease",
  MSK: "Musculoskeletal",
  NEURO: "Neurology",
  PRO: "Professional Practice",
  PSYCH: "Psychiatry",
  PULM: "Pulmonology",
  RENAL: "Renal",
  REPRO: "Reproductive",
  OTHER: "Other / Unmapped",
};

const SystemDrilldownModal: React.FC<SystemDrilldownModalProps> = (props) => {
  // Normalize inputs so this works no matter how MenuView is calling it
  const system: SystemCode | undefined =
    props.system ||
    props.systemCode ||
    props.selection?.system;

  const allRecords: PerformanceRecord[] =
    props.records ||
    props.selection?.records ||
    props.performanceData ||
    [];

  // If system is provided, filter to that system; otherwise just use all records
  const systemRecords = useMemo(() => {
    if (!system) return allRecords;
    return allRecords.filter((r) => r.system === system);
  }, [allRecords, system]);

  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null
  );

  // Aggregate subcategory-level stats
  const subcategoryStats = useMemo(() => {
    const map = new Map<
      string,
      { subcategory: string; correct: number; total: number }
    >();

    for (const r of systemRecords) {
      const key = r.subcategory || "Unspecified";
      if (!map.has(key)) {
        map.set(key, { subcategory: key, correct: 0, total: 0 });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (r.isCorrect) entry.correct += 1;
    }

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        score: entry.total > 0 ? (entry.correct / entry.total) * 100 : 0,
      }))
      .sort((a, b) => a.score - b.score); // weakest first
  }, [systemRecords]);

  // Aggregate condition-level stats (we’ll filter by activeSubcategory below)
  const conditionStats = useMemo(() => {
    const map = new Map<
      string,
      {
        condition: string;
        subcategory: string;
        correct: number;
        total: number;
      }
    >();

    for (const r of systemRecords) {
      const sub = r.subcategory || "Unspecified";
      const condKey = r.condition || "Unspecified condition";

      const key = `${sub}__${condKey}`;
      if (!map.has(key)) {
        map.set(key, {
          condition: condKey,
          subcategory: sub,
          correct: 0,
          total: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (r.isCorrect) entry.correct += 1;
    }

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        score: entry.total > 0 ? (entry.correct / entry.total) * 100 : 0,
      }))
      .sort((a, b) => a.score - b.score); // weakest first
  }, [systemRecords]);

  const filteredConditionStats = useMemo(() => {
    if (!activeSubcategory) return [];
    return conditionStats.filter(
      (c) => c.subcategory === activeSubcategory
    );
  }, [conditionStats, activeSubcategory]);

  const getBarColor = (score: number) => {
    if (score < 50) return "bg-red-500";
    if (score < 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const systemLabel = system ? SYSTEM_LABELS[system] : "System Details";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#3D1B0E]">
              {systemLabel} – Drilldown
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Click a subcategory to see condition-level performance.
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="px-3 py-1 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left: Subcategories */}
          <div className="md:w-1/2 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Subcategories
              </h3>
              {subcategoryStats.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No performance data for this system yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {subcategoryStats.map((sub) => (
                    <button
                      key={sub.subcategory}
                      onClick={() =>
                        setActiveSubcategory(
                          sub.subcategory === activeSubcategory
                            ? null
                            : sub.subcategory
                        )
                      }
                      className={`w-full text-left p-3 rounded-lg border ${
                        sub.subcategory === activeSubcategory
                          ? "border-[#3D1B0E] bg-[#FDF5F3]"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      } transition-colors`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-800">
                          {sub.subcategory}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {sub.score.toFixed(0)}% ({sub.correct}/{sub.total})
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${getBarColor(
                            sub.score
                          )}`}
                          style={{ width: `${sub.score}%` }}
                        ></div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Conditions */}
          <div className="md:w-1/2 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {activeSubcategory
                  ? `Conditions – ${activeSubcategory}`
                  : "Conditions"}
              </h3>

              {!activeSubcategory && (
                <p className="text-sm text-slate-500">
                  Select a subcategory on the left to see <b>condition-level</b>{" "}
                  mastery.
                </p>
              )}

              {activeSubcategory && filteredConditionStats.length === 0 && (
                <p className="text-sm text-slate-500">
                  No condition-level data yet for this subcategory.
                </p>
              )}

              {activeSubcategory && filteredConditionStats.length > 0 && (
                <div className="space-y-2">
                  {filteredConditionStats.map((cond) => (
                    <div
                      key={`${cond.subcategory}__${cond.condition}`}
                      className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-800">
                          {cond.condition}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {cond.score.toFixed(0)}% ({cond.correct}/{cond.total})
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${getBarColor(
                            cond.score
                          )}`}
                          style={{ width: `${cond.score}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-slate-200 text-xs text-slate-500">
          Heatmap drilldown currently uses only stored performance records
          (PANCE-level / ALL-topics sessions as you configured).
        </div>
      </div>
    </div>
  );
};

export default SystemDrilldownModal;
