import React, { useEffect, useMemo, useState } from "react";
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

  /**
   * Optional callback to start a drill session from a condition card.
   * We keep it very generic: just hand back system, subcategory, and condition.
   */
  onDrillCondition?: (payload: {
    system: SystemCode | undefined;
    subcategory: string;
    condition: string;
  }) => void;
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

/**
 * Turn things like:
 *  - "GI__colon__diverticulitis" -> "Diverticulitis"
 *  - "GI__colon__irritable_bowel_syndrome" -> "Irritable Bowel Syndrome"
 * while preserving short acronyms like IBS/COPD/DVT/PE/HIV.
 */
const cleanConditionName = (raw: string | undefined): string => {
  if (!raw) return "Unspecified condition";

  // If it's already human-readable (no "__" and no "_"), just use it.
  if (!raw.includes("__") && !raw.includes("_")) return raw;

  let s = raw;

  // Strip any system/subcategory prefix like "GI__colon__"
  if (s.includes("__")) {
    const parts = s.split("__");
    s = parts[parts.length - 1];
  }

  const words = s.split("_").filter(Boolean);

  const formatted = words
    .map((word) => {
      const letters = word.replace(/[^A-Za-z]/g, "");
      if (!letters) return word;

      // Preserve acronyms up to length 4 (IBS, COPD, HIV, DVT, PE, STEMI, etc.)
      if (letters.length <= 4) {
        return letters.toUpperCase();
      }

      // Title-case normal words
      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    })
    .join(" ");

  return formatted || "Unspecified condition";
};

const SystemDrilldownModal: React.FC<SystemDrilldownModalProps> = (props) => {
  // Normalize inputs so this works no matter how MenuView is calling it
  const system: SystemCode | undefined =
    props.system || props.systemCode || props.selection?.system;

  const allRecords: PerformanceRecord[] =
    props.records || props.selection?.records || props.performanceData || [];

  // If system is provided, filter to that system; otherwise just use all records
  const systemRecords = useMemo(() => {
    if (!system) return allRecords;
    return allRecords.filter((r) => r.system === system);
  }, [allRecords, system]);

  // Aggregate a simple summary line for the header
  const systemSummary = useMemo(() => {
    const total = systemRecords.length;
    const correct = systemRecords.filter((r) => r.isCorrect).length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, percent };
  }, [systemRecords]);

  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null
  );
  const [sortMode, setSortMode] = useState<"weakest" | "alpha" | "most">(
    "weakest"
  );
  const [showWeakOnly, setShowWeakOnly] = useState(false);

  /* -------------------------- SUBCATEGORY STATS ------------------------- */

  const rawSubcategoryStats = useMemo(() => {
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

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      score: entry.total > 0 ? (entry.correct / entry.total) * 100 : 0,
    }));
  }, [systemRecords]);

  // Apply sort + "weak only" filter
  const subcategoryStats = useMemo(() => {
    let list = [...rawSubcategoryStats];

    if (showWeakOnly) {
      list = list.filter((s) => s.score < 80);
    }

    if (sortMode === "alpha") {
      list.sort((a, b) => a.subcategory.localeCompare(b.subcategory));
    } else if (sortMode === "most") {
      list.sort((a, b) => b.total - a.total);
    } else {
      // weakest first by default
      list.sort((a, b) => a.score - b.score);
    }

    return list;
  }, [rawSubcategoryStats, sortMode, showWeakOnly]);

  /* --------------------------- CONDITION STATS -------------------------- */

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
      const rawCond = r.condition || r.conditionId || "Unspecified";
      const condName = cleanConditionName(rawCond);

      const id = `${sub}__${condName}`;
      if (!map.has(id)) {
        map.set(id, {
          condition: condName,
          subcategory: sub,
          correct: 0,
          total: 0,
        });
      }
      const entry = map.get(id)!;
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

  /* --------------------- DEFAULT SUBCATEGORY SELECTION ------------------ */

  useEffect(() => {
    if (!activeSubcategory && subcategoryStats.length > 0) {
      setActiveSubcategory(subcategoryStats[0].subcategory);
    }
  }, [activeSubcategory, subcategoryStats]);

  const filteredConditionStats = useMemo(() => {
    if (!activeSubcategory) return [];
    return conditionStats.filter((c) => c.subcategory === activeSubcategory);
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
              {systemSummary.total > 0
                ? `Based on ${systemSummary.total} ${systemLabel.toLowerCase()} questions (${systemSummary.correct}/${systemSummary.total}, ${systemSummary.percent}% correct) from PANCE-level ALL-topics sessions.`
                : "No performance data yet for this system."}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
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
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Subcategories
                </h3>
                {subcategoryStats.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={showWeakOnly}
                        onChange={(e) => setShowWeakOnly(e.target.checked)}
                      />
                      <span>Weak only (&lt;80%)</span>
                    </label>
                    <select
                      className="border border-slate-200 rounded-md bg-white text-[11px] px-2 py-1 text-slate-600"
                      value={sortMode}
                      onChange={(e) =>
                        setSortMode(
                          e.target.value as "weakest" | "alpha" | "most"
                        )
                      }
                    >
                      <option value="weakest">Weakest first</option>
                      <option value="alpha">A–Z</option>
                      <option value="most">Most questions</option>
                    </select>
                  </div>
                )}
              </div>
              {subcategoryStats.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No performance data for this system yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {subcategoryStats.map((sub) => (
                    <button
                      key={sub.subcategory}
                      onClick={() => setActiveSubcategory(sub.subcategory)}
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
                      {sub.total < 3 && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          Low sample size
                        </span>
                      )}
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
                  Select a subcategory on the left to see condition-level
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
                      {cond.total < 3 && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          Low sample size
                        </span>
                      )}

                      {props.onDrillCondition && system && (
                        <button
                          onClick={() => {
                            props.onDrillCondition?.({
                              system,
                              subcategory: cond.subcategory,
                              condition: cond.condition,
                            });
                            // Close the modal after starting the drill
                            props.onClose();
                          }}
                          className="mt-2 inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border border-[#3D1B0E]/30 text-[#3D1B0E] hover:bg-[#3D1B0E]/5"
                        >
                          Drill this condition
                        </button>
                      )}
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
