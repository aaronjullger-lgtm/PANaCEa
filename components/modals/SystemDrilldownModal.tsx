import React, { useEffect, useMemo, useState } from 'react';
import type { PerformanceRecord, SystemCode } from '@/types';

export type SystemDrilldownSelection = {
  system: SystemCode;
  records?: PerformanceRecord[];
};

interface SystemDrilldownModalProps {
  system?: SystemCode;
  systemCode?: SystemCode;
  selection?: SystemDrilldownSelection;
  records?: PerformanceRecord[];
  performanceData?: PerformanceRecord[];
  onClose: () => void;

  onDrillSubcategory?: (payload: { system: SystemCode | undefined; subcategory: string }) => void;
}

const SYSTEM_LABELS: Record<SystemCode, string> = {
  CV: 'Cardiovascular',
  DERM: 'Dermatology',
  ENDO: 'Endocrine',
  GI: 'Gastrointestinal',
  GU: 'Genitourinary',
  HEME: 'Hematology',
  HEENT: 'HEENT',
  ID: 'Infectious Disease',
  MSK: 'Musculoskeletal',
  NEURO: 'Neurology',
  PRO: 'Professional Practice',
  PSYCH: 'Psychiatry',
  PULM: 'Pulmonology',
  RENAL: 'Renal',
  REPRO: 'Reproductive',
  OTHER: 'Other / Unmapped',
};

/**
 * Clean up condition ids into display names while preserving acronyms.
 * Examples:
 * - "GI__colon__diverticulitis" -> "Diverticulitis"
 * - "GI__colon__irritable_bowel_syndrome" -> "Irritable Bowel Syndrome"
 * - "cv__acs" -> "ACS"
 */
const cleanConditionName = (raw: string | undefined): string => {
  if (!raw) return 'Unspecified condition';

  if (!raw.includes('__') && !raw.includes('_')) return raw;

  let s: string = raw;
  if (s.includes('__')) {
    const parts = s.split('__');
    // Get last part, with fallback for TypeScript strict mode
    const lastPart = parts[parts.length - 1];
    s = lastPart ?? raw;
  }

  const words = s.split('_').filter(Boolean);

  const formatted = words
    .map((word) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      if (!letters) return word;

      if (letters.length <= 4) {
        return letters.toUpperCase();
      }

      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    })
    .join(' ');

  return formatted || 'Unspecified condition';
};

const SystemDrilldownModal: React.FC<SystemDrilldownModalProps> = (props) => {
  const system: SystemCode | undefined =
    props.system || props.systemCode || props.selection?.system;

  const allRecords: PerformanceRecord[] =
    props.records || props.selection?.records || props.performanceData || [];

  const systemRecords = useMemo(() => {
    if (!system) return allRecords;
    return allRecords.filter((r) => r.system === system);
  }, [allRecords, system]);

  const systemSummary = useMemo(() => {
    const total = systemRecords.length;
    const correct = systemRecords.filter((r) => r.isCorrect).length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, percent };
  }, [systemRecords]);

  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'weakest' | 'alpha' | 'most'>('weakest');
  const [showWeakOnly, setShowWeakOnly] = useState(false);

  // -------- SUBCATEGORY STATS --------
  const rawSubcategoryStats = useMemo(() => {
    const map = new Map<string, { subcategory: string; correct: number; total: number }>();

    for (const r of systemRecords) {
      const key = r.subcategory || 'Unspecified';
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

  const subcategoryStats = useMemo(() => {
    let list = [...rawSubcategoryStats];

    if (showWeakOnly) {
      list = list.filter((s) => s.score < 80);
    }

    if (sortMode === 'alpha') {
      list.sort((a, b) => a.subcategory.localeCompare(b.subcategory));
    } else if (sortMode === 'most') {
      list.sort((a, b) => b.total - a.total);
    } else {
      list.sort((a, b) => a.score - b.score); // weakest first
    }

    return list;
  }, [rawSubcategoryStats, sortMode, showWeakOnly]);

  // -------- CONDITION STATS --------
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
      const sub = r.subcategory || 'Unspecified';
      const rawCond = r.condition || r.conditionId || '';
      const condName = cleanConditionName(rawCond || 'Unspecified');

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
      .sort((a, b) => a.score - b.score);
  }, [systemRecords]);

  // Default selection: weakest subcategory
  useEffect(() => {
    if (!activeSubcategory && subcategoryStats.length > 0) {
      const firstStat = subcategoryStats[0];
      if (firstStat) {
        setActiveSubcategory(firstStat.subcategory);
      }
    }
  }, [activeSubcategory, subcategoryStats]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.onClose]);

  const filteredConditionStats = useMemo(() => {
    if (!activeSubcategory) return [];
    return conditionStats.filter((c) => c.subcategory === activeSubcategory);
  }, [conditionStats, activeSubcategory]);

  const getBarColor = (score: number) => {
    if (score < 50) return 'bg-[var(--color-data-fail)]';
    if (score < 80) return 'bg-[var(--color-data-provisional)]';
    return 'bg-[var(--color-data-pass)]';
  };

  const systemLabel = system ? SYSTEM_LABELS[system] : 'System Details';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${systemLabel} drilldown`}
        className="bg-[var(--color-bg-tertiary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col border border-[var(--color-border)]"
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {systemLabel} – Drilldown
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {systemSummary.total > 0
                ? `Based on ${systemSummary.total.toString()} ${systemLabel.toLowerCase()} questions (${systemSummary.correct.toString()}/${systemSummary.total.toString()}, ${systemSummary.percent.toString()}% correct).`
                : 'No performance data yet for this system.'}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              Click a subcategory to see condition-level performance.
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="px-3 py-1 text-sm rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* LEFT: SUBCATEGORIES */}
          <div className="md:w-1/2 border-b md:border-b-0 md:border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-bg-secondary)]">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Subcategories
                </h3>
                {subcategoryStats.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                      <input
                        id="show-weak-only"
                        name="show-weak-only"
                        type="checkbox"
                        className="h-3 w-3 rounded border-[var(--color-border)]"
                        checked={showWeakOnly}
                        onChange={(e) => setShowWeakOnly(e.target.checked)}
                      />
                      <span>Weak only (&lt;80%)</span>
                    </label>
                    <select
                      aria-label="Sort order"
                      className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)] text-[11px] px-2 py-1 text-[var(--color-text-secondary)]"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as 'weakest' | 'alpha' | 'most')}
                    >
                      <option value="weakest">Weakest first</option>
                      <option value="alpha">A–Z</option>
                      <option value="most">Most questions</option>
                    </select>
                  </div>
                )}
              </div>

              {subcategoryStats.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No performance data for this system yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {subcategoryStats.map((sub) => {
                    const isActive = sub.subcategory === activeSubcategory;
                    const isWeak = sub.score < 80;

                    return (
                      <button
                        key={sub.subcategory}
                        onClick={() => setActiveSubcategory(sub.subcategory)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isActive
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)]'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {sub.subcategory}
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                            {sub.score.toFixed(0)}% ({sub.correct}/{sub.total})
                          </span>
                        </div>
                        <div className="w-full bg-[var(--color-bg-primary)] rounded-full h-1.5 mb-1">
                          <div
                            className={`h-1.5 rounded-full ${getBarColor(sub.score)}`}
                            style={{ width: `${sub.score}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {sub.total.toString()} question
                            {sub.total !== 1 ? 's' : ''}
                          </span>
                          {isWeak && (
                            <span className="text-[11px] text-[var(--color-data-provisional)] font-medium">
                              Needs review
                            </span>
                          )}
                          {!isWeak && sub.total < 3 && (
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                              Low sample size
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: CONDITIONS */}
          <div className="md:w-1/2 overflow-y-auto bg-[var(--color-bg-secondary)]">
            <div className="p-4">
              {activeSubcategory ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Conditions – {activeSubcategory}
                    </h3>
                    {props.onDrillSubcategory && system && (
                      <button
                        onClick={() => {
                          props.onDrillSubcategory?.({
                            system,
                            subcategory: activeSubcategory,
                          });
                          props.onClose();
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)]/10 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] transition"
                      >
                        Drill this subcategory
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Questions from this subcategory are listed below.
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Select a subcategory on the left to see condition-level mastery.
                </p>
              )}

              {activeSubcategory && filteredConditionStats.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  No condition-level data yet for this subcategory.
                </p>
              )}

              {activeSubcategory && filteredConditionStats.length > 0 && (
                <div className="space-y-3">
                  {filteredConditionStats.map((cond) => (
                    <div
                      key={`${cond.subcategory}__${cond.condition}`}
                      className="p-4 rounded-lg bg-[var(--color-bg-tertiary)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {cond.condition}
                        </span>
                        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                          {cond.score.toFixed(0)}% ({cond.correct}/{cond.total})
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-bg-primary)] rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full ${getBarColor(cond.score)}`}
                          style={{ width: `${cond.score}%` }}
                        />
                      </div>
                      {cond.total < 3 && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          Low sample size
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemDrilldownModal;
