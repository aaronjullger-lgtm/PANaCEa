/**
 * PANCE Readiness Score Service (Tier 2, Feature 4 — Phase 1 Heuristic)
 *
 * Computes a composite PANCE readiness score from study behavior data,
 * weighted by the official NCCPA 2025 Blueprint percentages.
 *
 * Feature signals (per tier2.md):
 *   1. Topic coverage: % of blueprint areas with ≥ N cards reviewed
 *   2. Accuracy trend: Rolling 14-day accuracy per organ system
 *   3. Stability distribution: % of "mature" cards (S > 30d) per topic
 *   4. Retrievability profile: Mean R across all cards per topic
 *   5. Study consistency: Days studied per week, session count trend
 *   6. Lapse rate: Recent lapse frequency per topic
 *   7. Difficulty profile: Mean FSRS D per topic
 *
 * Phase 1 is a heuristic composite — no ML model.
 * Frame output as "readiness indicator" per tier2.md's liability guidance.
 *
 * @see lib/constants/blueprint.ts — NCCPA 2025 Blueprint weights
 * @see lib/services/blueprintCoverageService.ts — Coverage gap analysis
 * @module lib/services/panceReadinessService
 */

import { NCCPA_2025_BLUEPRINT } from '../constants/blueprint';

// ─── Types ────────────────────────────────────────────────────────

/** Per-system study metrics (input from DB queries) */
export interface SystemMetrics {
  /** Organ system name (must match NCCPA_2025_BLUEPRINT keys) */
  system: string;
  /** Total questions attempted in this system */
  totalAttempts: number;
  /** Correct answers in this system */
  correctAnswers: number;
  /** Rolling 14-day accuracy (0-1), null if insufficient data */
  recentAccuracy: number | null;
  /** Fraction of cards with FSRS stability > 30 days */
  matureCardFraction: number;
  /** Mean FSRS retrievability across all cards */
  meanRetrievability: number;
  /** Mean FSRS difficulty across all cards (reserved for Phase 2 ML model) */
  meanDifficulty: number;
  /** Number of lapses in last 14 days */
  recentLapses: number;
  /** Total cards with at least one review */
  cardsReviewed: number;
  /** Total cards available for this system */
  cardsAvailable: number;
}

/** Consistency metrics (session-level) */
export interface ConsistencyMetrics {
  /** Number of days with at least one study session in the last 14 days */
  activeDaysLast14: number;
  /** Total sessions in the last 14 days */
  sessionsLast14: number;
  /** Average session length in minutes */
  avgSessionMinutes: number;
  /** Day-over-day trend in sessions (positive = increasing) */
  sessionTrend: number;
}

/** Per-system readiness breakdown */
export interface SystemReadiness {
  system: string;
  /** Blueprint weight (0-1) */
  blueprintWeight: number;
  /** Coverage score (0-100): what fraction of available questions attempted */
  coverageScore: number;
  /** Accuracy score (0-100): recent accuracy relative to 75% target */
  accuracyScore: number;
  /** Stability score (0-100): fraction of mature cards */
  stabilityScore: number;
  /** Retrievability score (0-100): mean R */
  retrievabilityScore: number;
  /** Lapse penalty (0-20): penalizes high lapse rates */
  lapsePenalty: number;
  /** Composite system score (0-100) */
  compositeScore: number;
  /** Weighted contribution to final score */
  weightedContribution: number;
  /** Qualitative tier */
  readinessTier: ReadinessTier;
}

export type ReadinessTier = 'exam_ready' | 'strong' | 'developing' | 'needs_work' | 'critical';

/** Final readiness score result */
export interface PanceReadinessResult {
  /** Overall readiness score (0-100) */
  overallScore: number;
  /** Qualitative readiness level */
  readinessLevel: ReadinessTier;
  /** Per-system breakdown */
  systemBreakdown: SystemReadiness[];
  /** Consistency bonus/penalty applied */
  consistencyModifier: number;
  /** Systems below minimum threshold (need immediate attention) */
  criticalSystems: string[];
  /** Systems at or above exam-ready threshold */
  examReadySystems: string[];
  /** Estimated PANCE score range (300-800 scale, rough heuristic) */
  estimatedScoreRange: { low: number; high: number };
  /** Disclaimer (always include per tier2.md) */
  disclaimer: string;
  /** Timestamp */
  computedAt: string;
}

/** Configuration for the readiness computation */
export interface ReadinessConfig {
  /** Weight for accuracy in composite (default 0.35) */
  accuracyWeight: number;
  /** Weight for stability in composite (default 0.25) */
  stabilityWeight: number;
  /** Weight for coverage in composite (default 0.20) */
  coverageWeight: number;
  /** Weight for retrievability in composite (default 0.20) */
  retrievabilityWeight: number;
  /** Minimum attempts per system for accuracy to count */
  minAttemptsForAccuracy: number;
  /** Target accuracy for full accuracy score (100%) */
  targetAccuracy: number;
  /** Stability threshold in days for "mature" card */
  matureStabilityDays: number;
  /** Minimum coverage fraction for "covered" system */
  minCoverageFraction: number;
}

// ─── Constants ────────────────────────────────────────────────────

export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  accuracyWeight: 0.35,
  stabilityWeight: 0.25,
  coverageWeight: 0.20,
  retrievabilityWeight: 0.20,
  minAttemptsForAccuracy: 10,
  targetAccuracy: 0.75,  // 75% accuracy = full score (PANCE passing is ~65%)
  matureStabilityDays: 30,
  minCoverageFraction: 0.50, // 50% of available questions attempted = full coverage
};

/** Tier thresholds */
const TIER_THRESHOLDS: Record<ReadinessTier, number> = {
  exam_ready: 80,
  strong: 65,
  developing: 50,
  needs_work: 35,
  critical: 0,
};

/** PANCE score range mapping (300-800 scale) */
const PANCE_SCORE_MAPPING = {
  minScore: 300,
  maxScore: 800,
  passingScore: 450,  // Approximate passing threshold
};

/** Mandatory disclaimer per tier2.md liability guidance */
const READINESS_DISCLAIMER =
  'This readiness indicator is based on your study patterns and is not a prediction of your PANCE score. ' +
  'It reflects coverage, accuracy, and retention across blueprint areas. ' +
  'Actual exam performance depends on many factors not captured here. ' +
  'Use this as one data point alongside practice exams and program guidance.';

// ─── Core Algorithm ───────────────────────────────────────────────

/**
 * Compute the PANCE Readiness Score.
 *
 * Blueprint-weighted composite of:
 *   - Accuracy (35%): Recent accuracy relative to 75% target
 *   - Stability (25%): Fraction of cards with S > 30 days (mature)
 *   - Coverage (20%): Fraction of available questions attempted
 *   - Retrievability (20%): Mean R across all cards
 *
 * Each system score is weighted by its NCCPA blueprint percentage,
 * producing a single 0-100 composite that reflects exam readiness
 * proportional to what the PANCE actually tests.
 *
 * @param systemMetrics - Per-system study metrics
 * @param consistency - Session-level consistency metrics
 * @param config - Scoring configuration
 * @returns Complete readiness result with breakdown
 */
export function computePanceReadiness(
  systemMetrics: ReadonlyArray<SystemMetrics>,
  consistency: ConsistencyMetrics,
  config: Partial<ReadinessConfig> = {}
): PanceReadinessResult {
  const cfg = { ...DEFAULT_READINESS_CONFIG, ...config };
  const now = new Date();

  // Build system breakdown
  const systemBreakdown: SystemReadiness[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const metrics of systemMetrics) {
    const blueprintWeight = NCCPA_2025_BLUEPRINT[metrics.system] ?? 0;
    if (blueprintWeight === 0) continue;

    const systemScore = computeSystemScore(metrics, cfg);
    const weightedContribution = systemScore.compositeScore * blueprintWeight;

    systemBreakdown.push({
      system: metrics.system,
      blueprintWeight,
      ...systemScore,
      weightedContribution,
      readinessTier: classifyTier(systemScore.compositeScore),
    });

    weightedSum += weightedContribution;
    totalWeight += blueprintWeight;
  }

  // Handle missing systems (not yet studied)
  for (const [system, weight] of Object.entries(NCCPA_2025_BLUEPRINT)) {
    if (!systemBreakdown.find(s => s.system === system)) {
      systemBreakdown.push({
        system,
        blueprintWeight: weight,
        coverageScore: 0,
        accuracyScore: 0,
        stabilityScore: 0,
        retrievabilityScore: 0,
        lapsePenalty: 0,
        compositeScore: 0,
        weightedContribution: 0,
        readinessTier: 'critical',
      });
      totalWeight += weight;
    }
  }

  // Normalize by total weight
  const rawScore = totalWeight > 0 ? (weightedSum / totalWeight) : 0;

  // Apply consistency modifier (+/- up to 10 points)
  const consistencyMod = computeConsistencyModifier(consistency);
  const overallScore = Math.max(0, Math.min(100, rawScore + consistencyMod));

  // Identify critical and exam-ready systems
  const criticalSystems = systemBreakdown
    .filter(s => s.readinessTier === 'critical' || s.readinessTier === 'needs_work')
    .sort((a, b) => b.blueprintWeight - a.blueprintWeight)
    .map(s => s.system);

  const examReadySystems = systemBreakdown
    .filter(s => s.readinessTier === 'exam_ready')
    .map(s => s.system);

  // Estimate PANCE score range (rough heuristic)
  const estimatedScoreRange = estimateScoreRange(overallScore);

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    readinessLevel: classifyTier(overallScore),
    systemBreakdown: systemBreakdown.sort((a, b) => b.blueprintWeight - a.blueprintWeight),
    consistencyModifier: consistencyMod,
    criticalSystems,
    examReadySystems,
    estimatedScoreRange,
    disclaimer: READINESS_DISCLAIMER,
    computedAt: now.toISOString(),
  };
}

// ─── Per-System Scoring ───────────────────────────────────────────

interface SystemScoreResult {
  coverageScore: number;
  accuracyScore: number;
  stabilityScore: number;
  retrievabilityScore: number;
  lapsePenalty: number;
  compositeScore: number;
}

/**
 * Compute composite score for a single organ system.
 */
function computeSystemScore(
  metrics: SystemMetrics,
  config: ReadinessConfig
): SystemScoreResult {
  // Coverage: fraction of available questions attempted
  const coverageRatio = metrics.cardsAvailable > 0
    ? Math.min(1, metrics.cardsReviewed / (metrics.cardsAvailable * config.minCoverageFraction))
    : 0;
  const coverageScore = coverageRatio * 100;

  // Accuracy: recent accuracy relative to target
  let accuracyScore: number;
  if (metrics.totalAttempts < config.minAttemptsForAccuracy || metrics.recentAccuracy === null) {
    // Insufficient data — conservative estimate
    accuracyScore = metrics.totalAttempts > 0
      ? (metrics.correctAnswers / metrics.totalAttempts) * 100 * 0.8  // 20% confidence penalty
      : 0;
  } else {
    accuracyScore = Math.min(100, (metrics.recentAccuracy / config.targetAccuracy) * 100);
  }

  // Stability: fraction of mature cards
  const stabilityScore = metrics.matureCardFraction * 100;

  // Retrievability: mean R (already 0-1)
  const retrievabilityScore = metrics.meanRetrievability * 100;

  // Lapse penalty: penalize high recent lapse rates (up to 20 points)
  const lapseRate = metrics.totalAttempts > 0
    ? metrics.recentLapses / Math.max(1, metrics.totalAttempts)
    : 0;
  const lapsePenalty = Math.min(20, lapseRate * 100);

  // Composite with configurable weights
  const compositeScore = Math.max(0,
    config.accuracyWeight * accuracyScore +
    config.stabilityWeight * stabilityScore +
    config.coverageWeight * coverageScore +
    config.retrievabilityWeight * retrievabilityScore -
    lapsePenalty
  );

  return {
    coverageScore: Math.round(coverageScore * 10) / 10,
    accuracyScore: Math.round(accuracyScore * 10) / 10,
    stabilityScore: Math.round(stabilityScore * 10) / 10,
    retrievabilityScore: Math.round(retrievabilityScore * 10) / 10,
    lapsePenalty: Math.round(lapsePenalty * 10) / 10,
    compositeScore: Math.round(compositeScore * 10) / 10,
  };
}

// ─── Consistency Modifier ─────────────────────────────────────────

/**
 * Compute a consistency modifier (+/- 10 points) based on study habits.
 *
 * Rewards: studying 5+ days/week, regular sessions, positive trend
 * Penalizes: fewer than 3 days/week, declining session trend
 */
function computeConsistencyModifier(consistency: ConsistencyMetrics): number {
  let mod = 0;

  // Active days bonus/penalty (target: 5+ of 14 days)
  if (consistency.activeDaysLast14 >= 10) {
    mod += 5;  // Very consistent
  } else if (consistency.activeDaysLast14 >= 7) {
    mod += 3;  // Good
  } else if (consistency.activeDaysLast14 < 4) {
    mod -= 5;  // Inconsistent
  }

  // Session trend bonus/penalty
  if (consistency.sessionTrend > 0.1) {
    mod += 3;  // Increasing engagement
  } else if (consistency.sessionTrend < -0.2) {
    mod -= 3;  // Declining engagement
  }

  // Session length bonus
  if (consistency.avgSessionMinutes >= 20) {
    mod += 2;  // Sustained sessions
  }

  return Math.max(-10, Math.min(10, mod));
}

// ─── Tier Classification ──────────────────────────────────────────

/**
 * Classify a score into a readiness tier.
 */
function classifyTier(score: number): ReadinessTier {
  if (score >= TIER_THRESHOLDS.exam_ready) return 'exam_ready';
  if (score >= TIER_THRESHOLDS.strong) return 'strong';
  if (score >= TIER_THRESHOLDS.developing) return 'developing';
  if (score >= TIER_THRESHOLDS.needs_work) return 'needs_work';
  return 'critical';
}

// ─── Score Range Estimation ───────────────────────────────────────

/**
 * Estimate a PANCE score range from the readiness score.
 *
 * This is a rough linear mapping from our 0-100 readiness scale
 * to the PANCE 300-800 scale. Wide confidence intervals reflect
 * the uncertainty of a heuristic approach without calibration data.
 *
 * Not a prediction — a rough indicator per tier2.md guidance.
 */
function estimateScoreRange(readinessScore: number): { low: number; high: number } {
  const { minScore, maxScore } = PANCE_SCORE_MAPPING;
  const range = maxScore - minScore; // 500 points

  // Map 0-100 readiness to 300-800 with 50-point uncertainty band
  const centerEstimate = minScore + (readinessScore / 100) * range;
  const uncertainty = 50; // ±50 points

  return {
    low: Math.max(minScore, Math.round(centerEstimate - uncertainty)),
    high: Math.min(maxScore, Math.round(centerEstimate + uncertainty)),
  };
}

// ─── Exports for Edge API ─────────────────────────────────────────

/** Re-export tier thresholds for API responses */
export { TIER_THRESHOLDS, PANCE_SCORE_MAPPING };
