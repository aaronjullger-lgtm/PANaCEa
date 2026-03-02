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
  isCorrect: boolean;
  /** Optional: par time for this question type (ms) */
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
  rating: Rating;
  /** Continuous floating-point rating (1.0-4.0) derived from telemetry */
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
  maxValidTime: number;
  /** Answer switch penalty factor */
  switchPenalty: number;
  /** Latency thresholds for each rating (as ratio of par time) */
  ratingThresholds: {
    easy: number; // Below this = Easy
    good: number; // Below this = Good
    hard: number; // Below this = Hard
    // Above hard threshold = Again (if correct) or Again (if incorrect)
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
    // Above 130% = borderline, combined with switches
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
}

/**
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
 * @deprecated Use `deriveContinuousRating` instead. This function is no longer
 * called in production (drillReviewService uses deriveContinuousRating since the
 * continuous FSRS ratings migration). Kept for backward compatibility only.
 *
 * Derive FSRS rating from implicit behavioral metrics, returning both a discrete
 * rating (1-4) and a continuous floating‑point rating (1.0‑4.0) based on millisecond‑level
 * telemetry and answer‑switch logic.
 *
 * Core algorithm:
 * 1. If incorrect → Rating.Again (continuousRating = 1.0)
 * 2. Calculate effective latency with switch penalty
 * 3. Compute latency ratio relative to par time
 * 4. Apply penalties (switches, latency excess, commitment gap, entropy, oscillation)
 *    and bonus (fast response) to baseline grade 3.0
 * 5. Adjust based on session variance and trajectory if available
 * 6. Clamp to [1.0, 4.0] and map to discrete rating
 */
export function deriveImplicitRating(
  metrics: ImplicitBehaviorMetrics,
  sessionStats?: SessionLatencyStats,
  config: ImplicitRatingConfig = DEFAULT_IMPLICIT_CONFIG
): ImplicitReviewData {
  // Rule 1: Incorrect answers are always Again
  if (!metrics.isCorrect) {
    return {
      rating: Rating.Again,
      continuousRating: 1.0,
      metrics,
      confidence: 0.95, // High confidence for incorrect
      latencyPercentile: sessionStats
        ? calculateLatencyPercentile(metrics.timeToFirstClick, sessionStats)
        : 0.5,
      flagged: false,
    };
  }

  // Calculate effective latency with switch penalty
  const switchPenalty = 1 + metrics.answerSwitches * config.switchPenalty;
  const effectiveLatency = metrics.timeToFirstClick * switchPenalty;

  // Get par time (use default if not provided)
  const parTime = metrics.parTimeMs || 30000; // Default 30 seconds

  // Calculate latency ratio
  const latencyRatio = effectiveLatency / parTime;

  // Check for invalid response times
  let flagged = false;
  let flagReason: string | undefined;

  if (metrics.timeToFirstClick < config.minValidTime) {
    flagged = true;
    flagReason = 'Suspiciously fast response';
  } else if (metrics.timeToFirstClick > config.maxValidTime) {
    flagged = true;
    flagReason = 'Response time exceeded maximum';
  }

  // Compute continuous rating (grade) using telemetry-based formula
  // Base grade for correct answers is 3.0 (standard correct baseline)
  let grade = 3.0;

  // Penalties for answer switches
  const penaltySwitch = metrics.answerSwitches * 0.15;
  // Penalty for latency excess beyond "good" threshold (0.85)
  const latencyExcess = Math.max(0, Math.min(2, latencyRatio - 0.85));
  const penaltyLatency = latencyExcess * 0.3;
  // Penalty for commitment gap (hesitation after selection)
  const commitmentGapSec = (metrics.commitmentGapMs ?? 0) / 1000;
  const penaltyCommitment = commitmentGapSec * 0.02;
  // Penalty for cursor entropy (meandering)
  const entropy = metrics.cursorEntropy ?? 0;
  const penaltyEntropy = entropy > 1 ? (entropy - 1) * 0.2 : 0;
  // Penalty for hover oscillation
  const penaltyOscillation = (metrics.hoverOscillationCount ?? 0) * 0.1;

  // Bonus for fast, clean response (< 50% par time)
  const bonusFast = latencyRatio < 0.5 ? 0.3 : latencyRatio < 0.7 ? 0.15 : 0;

  grade = grade - penaltySwitch - penaltyLatency - penaltyCommitment - penaltyEntropy - penaltyOscillation + bonusFast;

  // Apply variance-based adjustment if session stats available
  if (sessionStats && sessionStats.count >= 5) {
    const percentile = calculateLatencyPercentile(metrics.timeToFirstClick, sessionStats);
    // High percentile (slower than peers) → downgrade by up to 0.2
    // Low percentile (faster than peers) → upgrade by up to 0.2
    const adjustment = percentile > 0.85 ? -0.2 : percentile < 0.15 ? 0.2 : 0;
    grade += adjustment;
  }

  // Apply trajectory-based adjustment if available (Phase 3A)
  if (metrics.trajectory) {
    const trajectoryAnalysis = interpretTrajectoryForRating(metrics.trajectory, metrics.isCorrect);
    if (trajectoryAnalysis.suggestedAdjustment === 'upgrade') {
      grade += 0.2;
    } else if (trajectoryAnalysis.suggestedAdjustment === 'downgrade') {
      grade -= 0.2;
    }
  }

  // Clamp grade to valid FSRS range [1.0, 4.0]
  grade = Math.max(1.0, Math.min(4.0, grade));

  // Derive discrete rating from continuous grade
  const discreteRating = gradeToRating(grade);

  // Calculate confidence in derived rating
  let confidence = 0.7; // Base confidence

  // Higher confidence for clear-cut cases
  if (latencyRatio < config.ratingThresholds.easy * 0.5) {
    confidence = 0.9; // Very fast and correct
  } else if (latencyRatio > config.ratingThresholds.hard * 1.5) {
    confidence = 0.85; // Very slow
  }

  // Lower confidence if answer switches occurred
  confidence -= metrics.answerSwitches * 0.1;
  confidence = Math.max(0.5, confidence);

  // Additional confidence adjustments based on micro‑kinetics
  if ((metrics.commitmentGapMs ?? 0) > 3000) confidence -= 0.1;
  if ((metrics.cursorEntropy ?? 0) > 1.5) confidence -= 0.1;
  confidence = Math.max(0.5, Math.min(0.95, confidence));

  return {
    rating: discreteRating,
    continuousRating: grade,
    metrics,
    confidence,
    latencyPercentile: sessionStats
      ? calculateLatencyPercentile(metrics.timeToFirstClick, sessionStats)
      : 0.5,
    flagged,
    flagReason,
  };
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
export function deriveContinuousRating(
  metrics: ImplicitBehaviorMetrics,
  config: ImplicitRatingConfig = DEFAULT_IMPLICIT_CONFIG
): ContinuousRatingResult {
  const parTime = metrics.parTimeMs ?? 30000;
  const effectiveLatency =
    metrics.timeToFirstClick * (1 + metrics.answerSwitches * config.switchPenalty);
  const latencyRatio = effectiveLatency / parTime;

  const base = metrics.isCorrect ? 3.0 : 1.0;
  let grade = base;

  if (metrics.isCorrect) {
    // Red-flag penalties
    const penaltySwitch = metrics.answerSwitches * 0.15;
    const latencyExcess = Math.max(0, Math.min(2, latencyRatio - 0.85));
    const penaltyLatency = latencyExcess * 0.3;
    const commitmentGapSec = (metrics.commitmentGapMs ?? 0) / 1000;
    const penaltyCommitment = commitmentGapSec * 0.02;
    const entropy = metrics.cursorEntropy ?? 0;
    const penaltyEntropy = entropy > 1 ? (entropy - 1) * 0.2 : 0;
    const penaltyOscillation = (metrics.hoverOscillationCount ?? 0) * 0.1;

    // Bonuses for fast, clean response
    const bonusFast = latencyRatio < 0.5 ? 0.3 : latencyRatio < 0.7 ? 0.15 : 0;

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
  let confidence = 0.7;
  if (!metrics.isCorrect) confidence = 0.95;
  else {
    confidence -= metrics.answerSwitches * 0.1;
    if ((metrics.commitmentGapMs ?? 0) > 3000) confidence -= 0.1;
    if ((metrics.cursorEntropy ?? 0) > 1.5) confidence -= 0.1;
    confidence = Math.max(0.5, Math.min(0.95, confidence));
  }

  const discreteRating = gradeToRating(grade);

  return { grade, confidence, discreteRating };
}

/** Map continuous grade to discrete FSRS Rating */
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
  const imageTimeMs = hasImage ? 10000 : 0;

  // Processing and decision time: 10 seconds base
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
  reviews.forEach((r) => ratingDistribution[r.rating]++);

  // Consistency score: lower variance in latency percentiles = more consistent
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
}

/**
 * Stability modifier from continuous grade.
 * grade 3.0 → 1.0; grade < 3 → slightly lower S; grade > 3 → slightly higher S.
 */
export function applyStabilityModifierFromGrade(grade: number): number {
  const delta = grade - 3;
  return Math.max(0.85, Math.min(1.15, 1 + delta * 0.05));
}

export default {
  deriveImplicitRating,
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
