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
import { exGaussianRTSignal, type ExGaussianParams } from './confidence/exGaussianRT';

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
  /** Optional: Whether user viewed a hint before answering. Aided recall = weaker retention signal. */
  hintViewed?: boolean;
  /** Optional: Time spent viewing hint (ms). Longer viewing = weaker retrieval. */
  hintViewDurationMs?: number | null;
  /** Optional: Question type for type-specific weight profiles */
  questionType?: string;
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
  /** Ex-Gaussian RT classification if available: 'automatic' | 'normal' | 'effortful' | 'lapse' | null */
  rtClassification?: string | null;
  /** RT signal quality (1.0 = normal, 0.6 = lapse-detected) */
  rtSignalQuality?: number;
}

/**
 * Per-user behavioral baseline for normalizing confidence signals.
 * When provided, confidence signals are z-scored against the student's own history
 * instead of using absolute thresholds.
 *
 * All fields are optional — if a particular baseline is missing (e.g., no CRPL data),
 * that signal falls back to absolute normalization.
 */
export interface UserBaseline {
  rtMedianMs: number;
  rtStdDevMs: number;
  switchMedian: number;
  switchP75: number;
  commitmentGapMedianMs: number;
  cursorEntropyMedian: number;
  oscillationMedian: number;
  /** Ex-Gaussian RT distribution params (Ratcliff, 1978). When present, enables
   *  lapse detection: attentional lapses reduce signal quality instead of
   *  being misinterpreted as weak memory. */
  exGaussian?: ExGaussianParams;
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
    hintViewed: number;          // Flat penalty for viewing hint before answering
    hintViewDurationPerSec: number; // Additional penalty per second of hint viewing (capped)
    hintViewDurationCap: number; // Maximum additional hint duration penalty
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
  /**
   * Multi-signal confidence model parameters (SDT-inspired).
   * Combines response time, answer stability, hesitation metrics, and trajectory
   * into a weighted continuous confidence score.
   *
   * Research basis:
   * - Benjamin et al. (1998): retrieval fluency (RT) predicts future recall
   * - Freeman & Ambady (2010): trajectory deviation measures response competition
   * - Kornell & Bjork (2008): massed repetition inflates perceived fluency
   * - Signal Detection Theory: geometric mean of noisy signals for robustness
   */
  confidenceParams: {
    /** Weight for response-time signal (fast correct = strong retrieval) */
    rtWeight: number;
    /** Weight for answer-stability signal (no switches = confident) */
    switchWeight: number;
    /** Weight for trajectory/micro-kinetics signal (if available) */
    trajectoryWeight: number;
    /** Weight for hesitation composite (commitment gap, entropy, oscillations) */
    hesitationWeight: number;
    /** Confidence for incorrect answers (high = we're sure they got it wrong) */
    incorrectConfidence: number;
    /** Hint-viewed dampener (aided recall = weaker signal) */
    hintDampener: number;
    /** Minimum confidence (wider range than before for graduated modifier) */
    min: number;
    /** Maximum confidence */
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
    hintViewed: 0.4,              // Flat penalty: aided recall ≠ free recall (Roediger & Karpicke, 2006)
    hintViewDurationPerSec: 0.03, // Per second of hint viewing (longer = weaker retrieval signal)
    hintViewDurationCap: 0.3,     // Maximum additional hint duration penalty
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
    rtWeight: 0.35,           // Response time is strongest predictor (Benjamin et al.)
    switchWeight: 0.25,       // Answer stability is second-strongest signal
    trajectoryWeight: 0.20,   // Trajectory metrics when available (Freeman & Ambady)
    hesitationWeight: 0.20,   // Composite hesitation (gap, entropy, oscillations)
    incorrectConfidence: 0.9, // High confidence that the error classification is correct
    hintDampener: 0.7,        // 30% reduction for hint-aided responses
    min: 0.3,                 // Wider range for graduated stability modifier
    max: 0.95,
  },
};

/**
 * Per-question-type confidence weight profiles.
 *
 * Different question formats engage different cognitive processes:
 * - Vignettes: reading comprehension dominates → RT is most diagnostic
 * - Recall: know-it-or-don't → answer switches most diagnostic
 * - Image: visual scanning → trajectory/cursor movement most diagnostic
 * - Rapid recall: pure speed → RT dominates
 *
 * Research: Rayner (1998) on reading vs scene perception;
 * Ericsson & Kintsch (1995) on retrieval mechanisms per format.
 */
export interface ConfidenceWeights {
  rtWeight: number;
  switchWeight: number;
  trajectoryWeight: number;
  hesitationWeight: number;
}

export type QuestionTypeKey = 'vignette' | 'recall' | 'image' | 'rapid_recall' | 'unknown';

export const QUESTION_TYPE_WEIGHTS: Record<QuestionTypeKey, ConfidenceWeights> = {
  vignette: {
    rtWeight: 0.40,
    switchWeight: 0.20,
    trajectoryWeight: 0.15,
    hesitationWeight: 0.25,
  },
  recall: {
    rtWeight: 0.30,
    switchWeight: 0.40,
    trajectoryWeight: 0.10,
    hesitationWeight: 0.20,
  },
  image: {
    rtWeight: 0.20,
    switchWeight: 0.20,
    trajectoryWeight: 0.35,
    hesitationWeight: 0.25,
  },
  rapid_recall: {
    rtWeight: 0.50,
    switchWeight: 0.30,
    trajectoryWeight: 0.05,
    hesitationWeight: 0.15,
  },
  unknown: {
    rtWeight: 0.35,
    switchWeight: 0.25,
    trajectoryWeight: 0.20,
    hesitationWeight: 0.20,
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
export function deriveContinuousRating(
  metrics: ImplicitBehaviorMetrics,
  config: ImplicitRatingConfig = DEFAULT_IMPLICIT_CONFIG,
  baseline?: UserBaseline
): ContinuousRatingResult {
  // ── NaN/Infinity guard ──
  // If telemetry values are NaN or negative, NaN propagates through all penalty/bonus
  // calculations and survives Math.max/Math.min clamping, corrupting FSRS card state.
  const parTime = Number.isFinite(metrics.parTimeMs) && (metrics.parTimeMs as number) > 0
    ? (metrics.parTimeMs as number)
    : 30000;
  const safeTimeToFirstClick = Number.isFinite(metrics.timeToFirstClick) && metrics.timeToFirstClick > 0
    ? metrics.timeToFirstClick
    : parTime; // Default to par time (produces latencyRatio ≈ 1.0 → neutral grade)
  const safeSwitches = Number.isFinite(metrics.answerSwitches) && metrics.answerSwitches >= 0
    ? Math.floor(metrics.answerSwitches)
    : 0;
  const effectiveLatency =
    safeTimeToFirstClick * (1 + safeSwitches * config.switchPenalty);
  const latencyRatio = effectiveLatency / parTime;

  const base = metrics.isCorrect ? 3.0 : 1.0;
  let grade = base;

  if (metrics.isCorrect) {
    const p = config.penalties;

    // Red-flag penalties (from config)
    const penaltySwitch = safeSwitches * p.perSwitch;
    // Logarithmic latency penalty: flattens beyond 1.5× par time.
    // Clinical vignettes with complex stems routinely take 2-3× par for careful
    // readers. Linear penalty over-punished thorough clinical reasoning.
    // ln(1 + excess) gives: 1.5× par → 0.13, 2× → 0.21, 3× → 0.29 (vs old 0.20/0.35/0.65)
    const latencyExcess = Math.max(0, latencyRatio - config.ratingThresholds.good);
    const penaltyLatency = p.latencyExcessMultiplier * Math.log(1 + latencyExcess);
    const commitmentGapSec = (metrics.commitmentGapMs ?? 0) / 1000;
    const penaltyCommitment = commitmentGapSec * p.commitmentGapPerSec;
    const entropy = metrics.cursorEntropy ?? 0;
    const penaltyEntropy = entropy > 1 ? (entropy - 1) * p.entropyAboveOne : 0;
    const penaltyOscillation = (metrics.hoverOscillationCount ?? 0) * p.perOscillation;

    // Hint-viewed penalty: aided recall produces weaker long-term retention
    // than unaided recall (testing effect; Roediger & Karpicke, 2006).
    // Flat penalty + time-proportional component (capped).
    const penaltyHint = metrics.hintViewed
      ? p.hintViewed + Math.min(
          ((metrics.hintViewDurationMs ?? 0) / 1000) * p.hintViewDurationPerSec,
          p.hintViewDurationCap
        )
      : 0;

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
      safeSwitches === 0 &&
      (metrics.commitmentGapMs ?? 0) < cb.maxGapMs &&
      (metrics.hoverOscillationCount ?? 0) === 0 &&
      latencyRatio < cb.maxRatio
        ? cb.full
        : safeSwitches === 0 && latencyRatio < cb.partialMaxRatio
          ? cb.partial
          : 0;

    const bonusFast = Math.min(bonusSpeed + bonusClean, 1.0);

    grade =
      base -
      penaltySwitch -
      penaltyLatency -
      penaltyCommitment -
      penaltyEntropy -
      penaltyOscillation -
      penaltyHint +
      bonusFast;
  }

  // Final NaN guard: if any telemetry produced NaN, fall back to neutral grade.
  // Math.max/Math.min do NOT catch NaN (NaN comparisons always return false).
  if (!Number.isFinite(grade)) grade = metrics.isCorrect ? 3.0 : 1.0;
  grade = Math.max(1.0, Math.min(4.0, grade));

  // ── Multi-signal confidence model (SDT-inspired) ──
  // Combines 4 behavioral signals into a weighted continuous confidence score.
  // Each signal is normalized to [0, 1] where 1 = maximum confidence.
  //
  // Research basis:
  // - Benjamin et al. (1998): faster retrieval → stronger long-term retention
  // - Freeman & Ambady (2010): trajectory deviation → response competition
  // - Kornell & Bjork (2008): fluency ≠ durability (addressed via fluency illusion in drillReviewService)
  const cp = config.confidenceParams;
  let confidence: number;
  let _rtClassification: string | null = null;
  let _rtSignalQuality = 1.0;

  if (!metrics.isCorrect) {
    // Incorrect: high confidence that the error classification is correct.
    // FSRS uses this to schedule aggressively (short interval).
    confidence = cp.incorrectConfidence;
  } else {
    // Signal 1: Response time (fast correct = strong automatic retrieval)
    // Priority: ex-Gaussian > z-score > log-transform
    let sRT: number;
    let rtSignalQuality = 1.0; // Reduced for attentional lapses

    if (baseline?.exGaussian && baseline.exGaussian.n >= 30) {
      // Best path: ex-Gaussian classification (Ratcliff, 1978; Luce, 1986)
      // Decomposes RT into cognitive processing (mu+sigma) and attentional lapses (tau).
      // Lapses are flagged with reduced signal quality — prevents random slowness
      // from being misinterpreted as weak memory.
      const egResult = exGaussianRTSignal(safeTimeToFirstClick, baseline.exGaussian);
      sRT = egResult.signal;
      rtSignalQuality = egResult.quality;
      _rtClassification = egResult.classification;
      _rtSignalQuality = rtSignalQuality;
    } else if (baseline && baseline.rtStdDevMs > 0) {
      // Fallback: z-score against student's own RT distribution
      const zScore = (safeTimeToFirstClick - baseline.rtMedianMs) / baseline.rtStdDevMs;
      // Map z-score to [0, 1]: z=-2 → 1.0 (very fast for them), z=0 → 0.67, z=+2 → 0.33, z=+3 → 0.0
      sRT = Math.max(0, Math.min(1, 1 - zScore / 3));
    } else {
      // Final fallback: log-transform of latency ratio (absolute threshold)
      // Range: 0.0 (very slow) → 1.0 (instant recall)
      const rtRatio = latencyRatio; // already computed above: effectiveLatency / parTime
      sRT = Math.max(0, Math.min(1, 1 - Math.log(Math.max(rtRatio, 0.1)) / Math.log(3)));
    }

    // Signal 2: Answer stability (no switches = confident)
    // When baseline available: normalize against student's own switch rate
    let sSwitch: number;
    if (baseline && baseline.switchP75 > 0) {
      // Normalize: switches at or below their p75 are "normal"; above is penalized
      const switchNorm = safeSwitches / (baseline.switchP75 * 1.5);
      sSwitch = Math.max(0.2, 1 - switchNorm * 0.5);
    } else {
      sSwitch = Math.max(0.2, 1 - safeSwitches * 0.2);
    }

    // Signal 3: Trajectory / micro-kinetics (if available)
    // Uses existing trajectory.confidenceScore or commitment gap + entropy as proxy
    // Range: 0.0 (maximum hesitation) → 1.0 (direct, confident movement)
    let sTrajectory: number;
    if (metrics.trajectory) {
      // Direct trajectory confidence from micro-kinetics (Freeman & Ambady, 2010)
      sTrajectory = metrics.trajectory.confidenceScore;
    } else {
      // Proxy from commitment gap and entropy when no trajectory data
      const gapSignal = 1 - Math.min((metrics.commitmentGapMs ?? 0) / 5000, 1);
      const entropySignal = Math.max(0, 1 - ((metrics.cursorEntropy ?? 0) - 0.5) / 2);
      sTrajectory = (gapSignal + entropySignal) / 2;
    }

    // Signal 4: Hesitation composite (commitment gap, entropy, oscillations)
    // When baseline available: normalize against student's own hesitation norms
    const gapDenominator = (baseline && baseline.commitmentGapMedianMs > 0)
      ? baseline.commitmentGapMedianMs * 3
      : 4000;
    const gapNorm = Math.max(0, 1 - (metrics.commitmentGapMs ?? 0) / gapDenominator);

    const entropyCenter = (baseline && baseline.cursorEntropyMedian > 0)
      ? baseline.cursorEntropyMedian
      : 1.0;
    const entropyNorm = Math.max(0, 1 - Math.max(0, ((metrics.cursorEntropy ?? 0) - entropyCenter)) / (entropyCenter * 2));

    const oscDenominator = (baseline && baseline.oscillationMedian > 0)
      ? baseline.oscillationMedian * 3
      : 4;
    const oscNorm = Math.max(0, 1 - (metrics.hoverOscillationCount ?? 0) / oscDenominator);

    // Range: 0.0 (strong hesitation) → 1.0 (no hesitation signals)
    const sHesitation = (gapNorm + entropyNorm + oscNorm) / 3;

    // Select question-type-specific weights if available, otherwise use config defaults
    const qtKey = (metrics.questionType ?? 'unknown') as QuestionTypeKey;
    const weights = QUESTION_TYPE_WEIGHTS[qtKey] ?? QUESTION_TYPE_WEIGHTS.unknown;

    // Weighted sum of signals (question-type-aware)
    // When an attentional lapse is detected via ex-Gaussian, the RT signal's
    // contribution is reduced (rtSignalQuality < 1.0) and its weight is
    // redistributed equally to other signals. This prevents a random "zone-out"
    // from tanking confidence when the student actually knows the material.
    const effectiveRtWeight = weights.rtWeight * rtSignalQuality;
    const redistributedWeight = weights.rtWeight * (1 - rtSignalQuality);
    const otherWeightSum = weights.switchWeight + weights.trajectoryWeight + weights.hesitationWeight;
    const boostFactor = otherWeightSum > 0 ? 1 + redistributedWeight / otherWeightSum : 1;

    confidence =
      effectiveRtWeight * sRT +
      weights.switchWeight * boostFactor * sSwitch +
      weights.trajectoryWeight * boostFactor * sTrajectory +
      weights.hesitationWeight * boostFactor * sHesitation;

    // Hint dampener: aided recall produces weaker retrieval strength signal
    if (metrics.hintViewed) {
      confidence *= cp.hintDampener;
    }

    confidence = Math.max(cp.min, Math.min(cp.max, confidence));
  }

  const discreteRating = gradeToRating(grade);

  return { grade, confidence, discreteRating, rtClassification: _rtClassification, rtSignalQuality: _rtSignalQuality };
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

/**
 * Telemetry quality classification for ReviewLog tagging.
 * Enables the optimizer sidecar to filter or weight reviews by data fidelity.
 *
 * - 'full': All key behavioral signals present (first click, switches, CRPL micro-kinetics)
 * - 'partial': Some behavioral signals (first click or switches, but not CRPL)
 * - 'minimal': Only correctness and duration available
 */
export type TelemetryQuality = 'full' | 'partial' | 'minimal';

/**
 * Assess telemetry data quality based on which behavioral fields are present.
 * Used to tag ReviewLog entries so the optimizer can weigh high-fidelity data
 * more heavily during parameter fitting.
 *
 * @param raw - The raw telemetry object from the client (may be undefined)
 * @returns Quality classification: 'full', 'partial', or 'minimal'
 */
export function assessTelemetryQuality(
  raw?: Record<string, unknown> | null
): TelemetryQuality {
  if (!raw) return 'minimal';

  const hasFirstClick = raw.time_to_first_interaction_ms != null;
  const hasSwitches = raw.answer_changes != null;
  const hasCRPL = raw.hover_oscillations != null
    || raw.selection_drift_ms != null
    || raw.tremor_score != null;

  if (hasFirstClick && hasSwitches && hasCRPL) return 'full';
  if (hasFirstClick || hasSwitches) return 'partial';
  return 'minimal';
}

/**
 * Graduated confidence → stability multiplier.
 *
 * Replaces the old binary threshold (confidence ≤ 0.5 → -25% stability) with a
 * continuous sigmoid function that both rewards high confidence and penalizes low.
 *
 * Formula: multiplier = 0.7 + 0.6 × sigmoid((confidence - 0.6) × 5)
 *
 * Output range: [0.72, 1.28]
 * - confidence 0.3 → ≈ 0.72 (28% stability reduction — weak retrieval)
 * - confidence 0.5 → ≈ 0.82 (18% reduction)
 * - confidence 0.6 → ≈ 1.0  (neutral — average confidence)
 * - confidence 0.7 → ≈ 1.12 (12% bonus — good retrieval fluency)
 * - confidence 0.9 → ≈ 1.28 (28% bonus — strong automatic retrieval)
 *
 * Research basis:
 * - Benjamin et al. (1998): retrieval fluency predicts future recall
 * - SDT: continuous signal strength maps to d' for prediction
 *
 * @param confidence - Implicit confidence score from deriveContinuousRating [0.3, 0.95]
 * @returns Stability multiplier [0.72, 1.28]
 */
export function confidenceStabilityMultiplier(confidence: number): number {
  const sigmoid = 1 / (1 + Math.exp(-((confidence - 0.6) * 5)));
  return 0.7 + 0.6 * sigmoid;
}

/**
 * Fluency illusion dampener for confidence.
 *
 * Kornell & Bjork (2008) showed that 71% of students overestimate retention on
 * massed (closely-spaced) items. A correct answer 12 hours after last review
 * feels fluent but doesn't predict long-term retention.
 *
 * This dampens confidence for reviews that happen within 24 hours of the previous
 * review of the same card, with a linear ramp from 0.7 (same-day) to 1.0 (≥1 day).
 *
 * @param elapsedDays - Days since previous review of this card (0 = same day)
 * @returns Dampening factor [0.7, 1.0] to multiply against confidence
 */
export function fluencyIllusionDampener(elapsedDays: number): number {
  if (elapsedDays >= 1.0) return 1.0;
  // Floor at 0.7 even for negative/zero elapsed days
  return 0.7 + 0.3 * Math.max(0, Math.min(elapsedDays, 1.0));
}

export default {
  deriveContinuousRating,
  applyStabilityModifierFromGrade,
  confidenceStabilityMultiplier,
  fluencyIllusionDampener,
  updateLatencyStats,
  initLatencyStats,
  calculateLatencyPercentile,
  estimateParTime,
  analyzeSessionMetrics,
  legacyQualityToRating,
  serializeImplicitMetrics,
  assessTelemetryQuality,
  DEFAULT_IMPLICIT_CONFIG,
};