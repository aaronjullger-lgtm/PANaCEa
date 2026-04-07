/**
 * Drill Recommendation Engine
 *
 * Analyzes a student's weakness profile (system gaps, confusion pairs,
 * calibration errors, behavioral patterns) and recommends the 3-5 most
 * impactful drill modes for their current session.
 *
 * Each recommendation includes:
 * - Which drill to do
 * - Why it was recommended (grounded in data)
 * - Estimated impact ("high" / "medium" / "low")
 * - Optional focus parameters (system, condition, etc.)
 *
 * Deterministic — no AI calls. Pure signal processing.
 *
 * @module lib/services/drillRecommendationEngine
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface DrillRecommendation {
  /** Drill type to recommend */
  drillType: string;
  /** Human-readable drill name */
  label: string;
  /** Why this drill was recommended */
  reason: string;
  /** Expected impact level */
  impact: 'high' | 'medium' | 'low';
  /** Optional: which system to focus on */
  focusSystem?: string;
  /** Optional: which condition(s) to target */
  focusConditions?: string[];
  /** Priority score (higher = recommend first) */
  priority: number;
}

export interface WeaknessProfile {
  /** System performance: { system: accuracy } */
  systemAccuracy: Record<string, { accuracy: number; attempts: number }>;
  /** Confusion pairs: [{ real, mistaken, count }] */
  confusionPairs: Array<{ realCondition: string; mistakenFor: string; count: number; system?: string }>;
  /** Calibration state */
  calibration: {
    overconfidentMisses: number; // High confidence + wrong
    totalAttempts: number;
  };
  /** Answer switching data */
  answerSwitching: {
    switchRate: number;
    harmfulSwitchRate: number; // harmful / total switches
  };
  /** Speed data */
  speed: {
    avgRtMs: number;
    fastQuartileAccuracy: number;
    slowQuartileAccuracy: number;
  };
  /** Blueprint gaps: systems under-studied relative to PANCE weight */
  blueprintGaps: Array<{ system: string; gapPercent: number }>;
}

// ── Drill Catalog ─────────────────────────────────────────────────────────

const DRILL_LABELS: Record<string, string> = {
  ddx_compare: 'DDx Compare',
  ddx_drill: 'DDx Drill',
  condition_drill: 'Condition Drill',
  system_drill: 'System Drill',
  subcategory_drill: 'Subcategory Drill',
  rapid_recall: 'Rapid Recall',
  pharmacology: 'Pharmacology',
  first_line_treatment: 'First-Line Treatment',
  antibiotic_mode: 'Antibiotic Drill',
  ecg_drill: 'ECG Interpretation',
  imaging_drill: 'Imaging Drill',
  mini_lab: 'Mini Lab',
  fluid_electrolyte: 'Fluid & Electrolyte',
  physiology_drill: 'Physiology',
  anatomy_review: 'Anatomy Review',
  history_drill: 'History & PE',
  procedure_drill: 'Procedure Drill',
  guideline_drill: 'Guideline Drill',
};

// ── Engine ─────────────────────────────────────────────────────────────────

/**
 * Generate personalized drill recommendations from a weakness profile.
 *
 * Returns up to `maxRecommendations` sorted by priority (highest first).
 */
export function generateDrillRecommendations(
  profile: WeaknessProfile,
  maxRecommendations = 5
): DrillRecommendation[] {
  const recs: DrillRecommendation[] = [];

  // ── 1. Confusion-pair drills (highest signal) ──

  if (profile.confusionPairs.length > 0) {
    const topPair = profile.confusionPairs[0]!;
    recs.push({
      drillType: 'ddx_compare',
      label: DRILL_LABELS['ddx_compare'] ?? 'DDx Compare',
      reason: `You've confused "${topPair.realCondition}" with "${topPair.mistakenFor}" ${topPair.count} times. Contrastive drilling builds discrimination.`,
      impact: topPair.count >= 5 ? 'high' : 'medium',
      focusConditions: [topPair.realCondition, topPair.mistakenFor],
      focusSystem: topPair.system,
      priority: 90 + Math.min(topPair.count, 10),
    });
  }

  // ── 2. Weakest system drill ──

  const systemEntries = Object.entries(profile.systemAccuracy)
    .filter(([, s]) => s.attempts >= 10)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy);

  if (systemEntries.length > 0) {
    const [weakSystem, weakStats] = systemEntries[0]!;
    const accPct = Math.round(weakStats.accuracy * 100);
    recs.push({
      drillType: 'system_drill',
      label: DRILL_LABELS['system_drill'] ?? 'System Drill',
      reason: `${weakSystem} is your weakest system at ${accPct}% accuracy (${weakStats.attempts} questions). Focused drilling closes this gap.`,
      impact: weakStats.accuracy < 0.6 ? 'high' : 'medium',
      focusSystem: weakSystem,
      priority: 85 - weakStats.accuracy * 20,
    });
  }

  // ── 3. Blueprint gap drill ──

  const topGap = profile.blueprintGaps
    .filter(g => g.gapPercent > 3)
    .sort((a, b) => b.gapPercent - a.gapPercent)[0];

  if (topGap) {
    recs.push({
      drillType: 'system_drill',
      label: `${topGap.system} Coverage`,
      reason: `${topGap.system} is ${topGap.gapPercent.toFixed(0)}% under your PANCE blueprint target. More questions here reduces exam risk.`,
      impact: topGap.gapPercent > 8 ? 'high' : 'medium',
      focusSystem: topGap.system,
      priority: 80 + topGap.gapPercent,
    });
  }

  // ── 4. Overconfidence drill ──

  if (profile.calibration.totalAttempts >= 30) {
    const overconfRate = profile.calibration.overconfidentMisses / profile.calibration.totalAttempts;
    if (overconfRate > 0.10) {
      recs.push({
        drillType: 'rapid_recall',
        label: DRILL_LABELS['rapid_recall'] ?? 'Rapid Recall',
        reason: `${Math.round(overconfRate * 100)}% of your answers are high-confidence misses. Rapid recall under time pressure exposes weak spots.`,
        impact: overconfRate > 0.15 ? 'high' : 'medium',
        priority: 70 + overconfRate * 100,
      });
    }
  }

  // ── 5. Speed-rushing drill ──

  if (profile.speed.fastQuartileAccuracy < profile.speed.slowQuartileAccuracy - 0.15) {
    recs.push({
      drillType: 'condition_drill',
      label: 'Deliberate Practice',
      reason: `Your fast answers are ${Math.round((profile.speed.slowQuartileAccuracy - profile.speed.fastQuartileAccuracy) * 100)}% less accurate than deliberate ones. Slow, focused condition drills build pattern recognition.`,
      impact: 'medium',
      priority: 60,
    });
  }

  // ── 6. Answer-switching remediation ──

  if (profile.answerSwitching.switchRate > 0.15 && profile.answerSwitching.harmfulSwitchRate > 0.5) {
    recs.push({
      drillType: 'first_line_treatment',
      label: DRILL_LABELS['first_line_treatment'] ?? 'First-Line Treatment',
      reason: `You change answers on ${Math.round(profile.answerSwitching.switchRate * 100)}% of questions and most switches hurt. First-line drills build decisive recall.`,
      impact: 'medium',
      priority: 55,
    });
  }

  // ── 7. Pharmacology (always useful for PA students) ──

  const pharmAccuracy = profile.systemAccuracy['Pharmacology']?.accuracy;
  if (pharmAccuracy !== undefined && pharmAccuracy < 0.7) {
    recs.push({
      drillType: 'pharmacology',
      label: DRILL_LABELS['pharmacology'] ?? 'Pharmacology',
      reason: `Pharmacology accuracy is ${Math.round(pharmAccuracy * 100)}%. Pharm is heavily tested on PANCE — steady practice here compounds.`,
      impact: pharmAccuracy < 0.55 ? 'high' : 'medium',
      priority: 50,
    });
  }

  // Deduplicate by drillType (keep highest priority)
  const seen = new Set<string>();
  const deduped = recs
    .sort((a, b) => b.priority - a.priority)
    .filter(r => {
      const key = `${r.drillType}:${r.focusSystem ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return deduped.slice(0, maxRecommendations);
}
