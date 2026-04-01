/**
 * Implicit Behavior Metrics System
 *
 * Zero-Friction FSRS integration: Derives memory strength from behavioral data
 * instead of self-rated buttons. Eliminates subjective bias in spaced repetition.
 *
 * Metrics tracked:
 * - Response latency (time-to-first-click)
 * - Answer switching (times user changed selection)
 * - Dwell time (total time on question)
 * - Latency variance (consistency across session)
 *
 * Research basis:
 * - Retrieval fluency correlates with memory strength (Kelley & Lindsay, 1993)
 * - Response latency predicts future recall (Benjamin et al., 1998)
 */

import { Rating } from './fsrs';
import { type TrajectoryMetrics, interpretTrajectoryForRating } from './micro-kinetics';

/**
 * Raw behavioral metrics captured during question interaction
 */
export interface ImplicitBehaviorMetrics {
  /** Time from question display to first answer selection (ms) */
  timeToFirstClick: number;
  /** Number of times user changed their answer selection */
  answerSwitches: number;
  /** Total time on question screen before submission (ms) */
  totalDwellTime: number;
  /** Whether the answer was correct */
  isCorrect: boolean;  /** Optional: par time for this question type (ms) */
  parTimeMs?: number;
  /** Optional: question complexity score (1-5) */
  complexityScore?: number;
  /** Optional: Mouse trajectory metrics (Phase 3A) */
  trajectory?: TrajectoryMetrics;
  /** Optional: Time from last answer selection to submit (ms). Micro-kinetics. */
  commitmentGapMs?: number | null;
  /** Optional: pathLength/idealDistance. >1 = meandering. Micro-kinetics. */
  cursorEntropy?: number;
  /** Optional: Hover oscillation count (A↔B revisits). Micro-kinetics. */
  hoverOscillationCount?: number;
}

/**
 * Session-level latency statistics for variance calculation
 */
export interface SessionLatencyStats {
  /** Running mean of response latencies */
  meanLatency: number;
  /** Running variance of response latencies */
  variance: number;
  /** Number of responses in session */
  count: number;
  /** Standard deviation */
  stdDev: number;
}

/**
 * Extended review data including implicit metrics
 */
export interface ImplicitReviewData {
  /** Derived FSRS rating (1-4) */
  rating: Rating;  /** Continuous floating-point rating (1.0-4.0) derived from telemetry */
  continuousRating?: number;
  /** Raw metrics that led to this rating */
  metrics: ImplicitBehaviorMetrics;
  /** Confidence score in the derived rating (0-1) */
  confidence: number;
  /** Latency percentile within session */
  latencyPercentile: number;
  /** Whether this was flagged as potentially unreliable */
  flagged: boolean;
  /** Reason for flagging, if any */
  flagReason?: string;
}

/**
 * Continuous rating result for FSRS scheduling with stability modifier
 */
export interface ContinuousRatingResult {
  /** Float grade in [1.0, 4.0]; 3.0 = standard correct baseline */
  grade: number;
  /** Confidence in derived rating (0-1). High gap/entropy → lower confidence. */
  confidence: number;
  /** Discrete rating for FSRS.next() (round of grade) */
  discreteRating: Rating;
}

/**
 * Configuration for implicit rating derivation
 */
export interface ImplicitRatingConfig {
  /** Minimum time to consider a response valid (ms) */
  minValidTime: number;
  /** Maximum time before considering as "forgotten" (ms) */
  maxValidTime: number;  /** Answer switch penalty factor */
  switchPenalty: number;
  /** Latency thresholds for each rating (as ratio of par time) */
  ratingThresholds: {
    easy: number; // Below this = Easy
    good: number; // Below this = Good
    hard: number; // Below this = Hard
    // Above hard threshold = Again (if correct) or Again (if incorrect)
  };
  /** Penalty weights for deriveContinuousRating (correct answers) */
  penalties: {
    perSwitch: number;           // Per answer switch
    latencyExcessMultiplier: number; // Applied to excess latency
    commitmentGapPerSec: number; // Per second of commitment gap
    entropyAboveOne: number;     // Per unit of entropy above 1.0
    perOscillation: number;      // Per hover oscillation
  };
  /** Speed bonus thresholds (latency ratio → bonus) for deriveContinuousRating */
  speedBonusTiers: Array<{ maxRatio: number; bonus: number }>;
  /** Clean-answer bonus: no hesitation signals → additional boost */
  cleanBonus: {
    full: number;       // All clean signals + fast
    partial: number;    // No switches + moderately fast
    maxGapMs: number;   // Max commitment gap for full bonus
    maxRatio: number;   // Max latency ratio for full bonus
    partialMaxRatio: number; // Max latency ratio for partial bonus
  };
  /** Confidence calculation parameters */
  confidenceParams: {
    baseCorrect: number;
    baseIncorrect: number;
    perSwitchPenalty: number;
    longGapThresholdMs: number;    longGapPenalty: number;
    highEntropyThreshold: number;
    highEntropyPenalty: number;
    min: number;
    max: number;
  };
}

/**
 * Default configuration based on cognitive research
 */
export const DEFAULT_IMPLICIT_CONFIG: ImplicitRatingConfig = {
  minValidTime: 1000, // 1 second minimum
  maxValidTime: 180000, // 3 minutes maximum
  switchPenalty: 0.3, // Each switch adds 30% to effective latency
  ratingThresholds: {
    easy: 0.5, // Under 50% of par time = Easy
    good: 0.85, // Under 85% of par time = Good
    hard: 1.3, // Under 130% of par time = Hard
  },
  penalties: {
    perSwitch: 0.15,              // Each answer change costs 0.15 grade
    latencyExcessMultiplier: 0.3, // Latency above 85% par × this
    commitmentGapPerSec: 0.02,    // Each second of hesitation before submit
    entropyAboveOne: 0.2,         // Cursor wandering penalty per unit
    perOscillation: 0.1,          // Each A↔B hover revisit
  },
  speedBonusTiers: [
    { maxRatio: 0.35, bonus: 0.5 },  // Instant recall
    { maxRatio: 0.5, bonus: 0.35 },  // Fast recall
    { maxRatio: 0.7, bonus: 0.15 },  // Smooth recall
  ],
  cleanBonus: {
    full: 0.25,           // No switches, fast, no oscillation
    partial: 0.1,         // No switches, moderately fast
    maxGapMs: 1500,       // Max commitment gap for full bonus
    maxRatio: 0.7,        // Max latency ratio for full bonus
    partialMaxRatio: 0.85, // Max latency ratio for partial bonus
  },  confidenceParams: {
    baseCorrect: 0.7,
    baseIncorrect: 0.95,
    perSwitchPenalty: 0.1,
    longGapThresholdMs: 3000,
    longGapPenalty: 0.1,
    highEntropyThreshold: 1.5,
    highEntropyPenalty: 0.1,
    min: 0.5,
    max: 0.95,
  },
};

/**
 * Calculate running latency statistics using Welford's algorithm
 * Maintains numerical stability for variance calculation
 */
export function updateLatencyStats(
  stats: SessionLatencyStats,
  newLatency: number
): SessionLatencyStats {
  const n = stats.count + 1;
  const delta = newLatency - stats.meanLatency;
  const newMean = stats.meanLatency + delta / n;
  const delta2 = newLatency - newMean;
  const newVariance = stats.variance + delta * delta2;

  return {
    count: n,
    meanLatency: newMean,
    variance: newVariance,
    stdDev: n > 1 ? Math.sqrt(newVariance / (n - 1)) : 0,
  };
}/**
 * Initialize empty latency stats for a new session
 */
export function initLatencyStats(): SessionLatencyStats {
  return {
    count: 0,
    meanLatency: 0,
    variance: 0,
    stdDev: 0,
  };
}

/**
 * Calculate latency percentile within session
 * Uses z-score transformation
 */
export function calculateLatencyPercentile(latency: number, stats: SessionLatencyStats): number {
  if (stats.count < 3 || stats.stdDev === 0) {
    return 0.5; // Not enough data, assume median
  }

  const zScore = (latency - stats.meanLatency) / stats.stdDev;
  // Convert z-score to percentile using sigmoid approximation
  const percentile = 1 / (1 + Math.exp(-0.7 * zScore));
  return Math.max(0, Math.min(1, percentile));
}

/**
 * Derive continuous FSRS grade (1.0–4.0) from behavioral metrics.
 * Standard correct (no red flags) = 3.0. Deviations toward 4.0 or 1.0 driven by behavior.
 *
 * Formula:
 * - base = isCorrect ? 3.0 : 1.0
 * - penalties: switch, latency, commitment gap, entropy, oscillation
 * - bonus: fast response (< 0.5 par time)
 * - grade = clamp(base - penalties + bonus, 1.0, 4.0)
 */
export function deriveContinuousRating(  metrics: ImplicitBehaviorMetrics,
  config: ImplicitRatingConfig = DEFAULT_IMPLICIT_CONFIG
): ContinuousRatingResult {
  const parTime = metrics.parTimeMs ?? 30000;
  const effectiveLatency =
    metrics.timeToFirstClick * (1 + metrics.answerSwitches * config.switchPenalty);
  const latencyRatio = effectiveLatency / parTime;

  const base = metrics.isCorrect ? 3.0 : 1.0;
  let grade = base;

  if (metrics.isCorrect) {
    const p = config.penalties;

    // Red-flag penalties (from config)
    const penaltySwitch = metrics.answerSwitches * p.perSwitch;
    const latencyExcess = Math.max(0, Math.min(2, latencyRatio - config.ratingThresholds.good));
    const penaltyLatency = latencyExcess * p.latencyExcessMultiplier;
    const commitmentGapSec = (metrics.commitmentGapMs ?? 0) / 1000;
    const penaltyCommitment = commitmentGapSec * p.commitmentGapPerSec;
    const entropy = metrics.cursorEntropy ?? 0;
    const penaltyEntropy = entropy > 1 ? (entropy - 1) * p.entropyAboveOne : 0;
    const penaltyOscillation = (metrics.hoverOscillationCount ?? 0) * p.perOscillation;

    // Tiered speed bonus (from config tiers)
    // Research: retrieval fluency is the strongest predictor of long-term retention
    // (Benjamin et al., 1998; Kelley & Lindsay, 1993)
    let bonusSpeed = 0;
    for (const tier of config.speedBonusTiers) {
      if (latencyRatio < tier.maxRatio) {
        bonusSpeed = tier.bonus;
        break;
      }
    }

    // Clean-answer bonus: no switches + fast = strong retrieval signal
    const cb = config.cleanBonus;    const bonusClean =
      metrics.answerSwitches === 0 &&
      (metrics.commitmentGapMs ?? 0) < cb.maxGapMs &&
      (metrics.hoverOscillationCount ?? 0) === 0 &&
      latencyRatio < cb.maxRatio
        ? cb.full
        : metrics.answerSwitches === 0 && latencyRatio < cb.partialMaxRatio
          ? cb.partial
          : 0;

    const bonusFast = Math.min(bonusSpeed + bonusClean, 1.0);

    grade =
      base -
      penaltySwitch -
      penaltyLatency -
      penaltyCommitment -
      penaltyEntropy -
      penaltyOscillation +
      bonusFast;
  }

  grade = Math.max(1.0, Math.min(4.0, grade));

  // Confidence: high commitment gap / entropy → lower confidence
  const cp = config.confidenceParams;
  let confidence = metrics.isCorrect ? cp.baseCorrect : cp.baseIncorrect;
  if (metrics.isCorrect) {
    confidence -= metrics.answerSwitches * cp.perSwitchPenalty;
    if ((metrics.commitmentGapMs ?? 0) > cp.longGapThresholdMs) confidence -= cp.longGapPenalty;
    if ((metrics.cursorEntropy ?? 0) > cp.highEntropyThreshold) confidence -= cp.highEntropyPenalty;
    confidence = Math.max(cp.min, Math.min(cp.max, confidence));
  }

  const discreteRating = gradeToRating(grade);

  return { grade, confidence, discreteRating };
}/** Map continuous grade to discrete FSRS Rating */
function gradeToRating(grade: number): Rating {
  if (grade < 1.5) return Rating.Again;
  if (grade < 2.5) return Rating.Hard;
  if (grade < 3.5) return Rating.Good;
  return Rating.Easy;
}

/**
 * Map legacy quality score (1-5) to FSRS Rating
 * For backward compatibility during transition
 */
export function legacyQualityToRating(quality: number): Rating {
  if (quality <= 1) return Rating.Again;
  if (quality === 2) return Rating.Hard;
  if (quality >= 5) return Rating.Easy;
  return Rating.Good;
}

/**
 * Estimate question complexity based on stem length and options
 * Used to adjust par time
 */
export function estimateParTime(params: {
  stemLength: number;
  optionCount: number;
  hasVignette: boolean;
  hasImage: boolean;
}): number {
  const { stemLength, optionCount, hasVignette, hasImage } = params;

  // Base reading time: ~200 words per minute, assume 5 chars per word
  const readingTimeMs = (stemLength / 5) * (60000 / 200);

  // Option consideration time: 5 seconds per option
  const optionTimeMs = optionCount * 5000;

  // Vignette adds 15 seconds
  const vignetteTimeMs = hasVignette ? 15000 : 0;

  // Image adds 10 seconds
  const imageTimeMs = hasImage ? 10000 : 0;  // Processing and decision time: 10 seconds base
  const processingTimeMs = 10000;

  const totalParTime =
    readingTimeMs + optionTimeMs + vignetteTimeMs + imageTimeMs + processingTimeMs;

  // Clamp to reasonable bounds
  return Math.max(15000, Math.min(120000, totalParTime));
}

/**
 * Analyze session-level metrics for quality indicators
 */
export function analyzeSessionMetrics(reviews: ImplicitReviewData[]): {
  avgLatency: number;
  avgConfidence: number;
  flaggedCount: number;
  ratingDistribution: Record<Rating, number>;
  consistencyScore: number;
} {
  if (reviews.length === 0) {
    return {
      avgLatency: 0,
      avgConfidence: 0,
      flaggedCount: 0,
      ratingDistribution: {
        [Rating.Again]: 0,
        [Rating.Hard]: 0,
        [Rating.Good]: 0,
        [Rating.Easy]: 0,
      },
      consistencyScore: 0,
    };
  }

  const totalLatency = reviews.reduce((sum, r) => sum + r.metrics.timeToFirstClick, 0);
  const totalConfidence = reviews.reduce((sum, r) => sum + r.confidence, 0);
  const flaggedCount = reviews.filter((r) => r.flagged).length;

  const ratingDistribution: Record<Rating, number> = {
    [Rating.Again]: 0,
    [Rating.Hard]: 0,
    [Rating.Good]: 0,
    [Rating.Easy]: 0,
  };
  reviews.forEach((r) => ratingDistribution[r.rating]++);  // Consistency score: lower variance in latency percentiles = more consistent
  const avgPercentile = reviews.reduce((sum, r) => sum + r.latencyPercentile, 0) / reviews.length;
  const percentileVariance =
    reviews.reduce((sum, r) => sum + Math.pow(r.latencyPercentile - avgPercentile, 2), 0) /
    reviews.length;
  const consistencyScore = 1 - Math.min(1, percentileVariance * 4);

  return {
    avgLatency: totalLatency / reviews.length,
    avgConfidence: totalConfidence / reviews.length,
    flaggedCount,
    ratingDistribution,
    consistencyScore,
  };
}

/**
 * Serialize metrics for storage in review history
 */
export function serializeImplicitMetrics(data: ImplicitReviewData): Record<string, unknown> {
  const base: Record<string, unknown> = {
    rating: data.rating,
    latencyMs: data.metrics.timeToFirstClick,
    switches: data.metrics.answerSwitches,
    dwellMs: data.metrics.totalDwellTime,
    isCorrect: data.metrics.isCorrect,
    confidence: data.confidence,
    percentile: data.latencyPercentile,
    flagged: data.flagged,
    flagReason: data.flagReason,
  };

  // Include trajectory metrics if available (Phase 3A)
  if (data.metrics.trajectory) {
    base.trajectory = {
      mad: Math.round(data.metrics.trajectory.mad * 1000) / 1000,
      auc: Math.round(data.metrics.trajectory.auc * 1000) / 1000,
      hesitationIndex: Math.round(data.metrics.trajectory.hesitationIndex * 100) / 100,
      jitterScore: Math.round(data.metrics.trajectory.jitterScore * 100) / 100,
      efficiency: Math.round(data.metrics.trajectory.efficiency * 100) / 100,
      confidenceScore: Math.round(data.metrics.trajectory.confidenceScore * 100) / 100,
      movementTime: Math.round(data.metrics.trajectory.movementTime),
    };
  }

  return base;
}/**
 * Stability modifier from continuous grade.
 * grade 3.0 → 1.0; grade < 3 → slightly lower S; grade > 3 → slightly higher S.
 */
export function applyStabilityModifierFromGrade(grade: number): number {
  const delta = grade - 3;
  return Math.max(0.85, Math.min(1.15, 1 + delta * 0.05));
}

export default {
  deriveContinuousRating,
  applyStabilityModifierFromGrade,
  updateLatencyStats,
  initLatencyStats,
  calculateLatencyPercentile,
  estimateParTime,
  analyzeSessionMetrics,
  legacyQualityToRating,
  serializeImplicitMetrics,
  DEFAULT_IMPLICIT_CONFIG,
};