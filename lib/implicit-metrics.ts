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
    easy: number;    // Below this = Easy
    good: number;    // Below this = Good
    hard: number;    // Below this = Hard
    // Above hard threshold = Again (if correct) or Again (if incorrect)
  };
}

/**
 * Default configuration based on cognitive research
 */
export const DEFAULT_IMPLICIT_CONFIG: ImplicitRatingConfig = {
  minValidTime: 1000,      // 1 second minimum
  maxValidTime: 180000,    // 3 minutes maximum
  switchPenalty: 0.3,      // Each switch adds 30% to effective latency
  ratingThresholds: {
    easy: 0.5,   // Under 50% of par time = Easy
    good: 0.85,  // Under 85% of par time = Good
    hard: 1.3,   // Under 130% of par time = Hard
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
export function calculateLatencyPercentile(
  latency: number,
  stats: SessionLatencyStats
): number {
  if (stats.count < 3 || stats.stdDev === 0) {
    return 0.5; // Not enough data, assume median
  }
  
  const zScore = (latency - stats.meanLatency) / stats.stdDev;
  // Convert z-score to percentile using sigmoid approximation
  const percentile = 1 / (1 + Math.exp(-0.7 * zScore));
  return Math.max(0, Math.min(1, percentile));
}

/**
 * Derive FSRS rating from implicit behavioral metrics
 * 
 * Core algorithm:
 * 1. If incorrect → Rating.Again (no exceptions)
 * 2. Calculate effective latency (base + switch penalty)
 * 3. Compare to par time to get latency ratio
 * 4. Map ratio to rating using thresholds
 * 5. Apply variance modifier for consistency bonus/penalty
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
      metrics,
      confidence: 0.95, // High confidence for incorrect
      latencyPercentile: sessionStats 
        ? calculateLatencyPercentile(metrics.timeToFirstClick, sessionStats) 
        : 0.5,
      flagged: false,
    };
  }

  // Calculate effective latency with switch penalty
  const switchPenalty = 1 + (metrics.answerSwitches * config.switchPenalty);
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

  // Derive base rating from latency ratio
  let rating: Rating;
  if (latencyRatio < config.ratingThresholds.easy) {
    rating = Rating.Easy;
  } else if (latencyRatio < config.ratingThresholds.good) {
    rating = Rating.Good;
  } else if (latencyRatio < config.ratingThresholds.hard) {
    rating = Rating.Hard;
  } else {
    // Very slow but correct - treat as Hard, not Again
    rating = Rating.Hard;
  }

  // Apply variance-based adjustment if session stats available
  if (sessionStats && sessionStats.count >= 5) {
    const percentile = calculateLatencyPercentile(metrics.timeToFirstClick, sessionStats);
    
    // High variance (inconsistent) responses get slight downgrade
    // Low variance (consistent) responses get slight upgrade
    if (percentile > 0.85 && rating > Rating.Again) {
      // Slower than 85th percentile for this session - consider downgrade
      if (rating === Rating.Easy) {
        rating = Rating.Good;
      }
    } else if (percentile < 0.15 && rating < Rating.Easy) {
      // Faster than 15th percentile - consider upgrade
      if (rating === Rating.Good) {
        rating = Rating.Easy;
      }
    }
  }

  // Apply trajectory-based adjustment if available (Phase 3A)
  if (metrics.trajectory) {
    const trajectoryAnalysis = interpretTrajectoryForRating(metrics.trajectory, metrics.isCorrect);
    
    // Apply trajectory adjustment
    if (trajectoryAnalysis.suggestedAdjustment === 'upgrade' && rating < Rating.Easy) {
      // High confidence trajectory + correct = upgrade one level
      if (rating === Rating.Hard) {
        rating = Rating.Good;
      } else if (rating === Rating.Good) {
        rating = Rating.Easy;
      }
    } else if (trajectoryAnalysis.suggestedAdjustment === 'downgrade' && rating > Rating.Hard) {
      // Low confidence trajectory + correct = downgrade one level (possible lucky guess)
      if (rating === Rating.Easy) {
        rating = Rating.Good;
      } else if (rating === Rating.Good) {
        rating = Rating.Hard;
      }
    }
  }

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

  return {
    rating,
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
  
  const totalParTime = readingTimeMs + optionTimeMs + vignetteTimeMs + imageTimeMs + processingTimeMs;
  
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
      ratingDistribution: { [Rating.Again]: 0, [Rating.Hard]: 0, [Rating.Good]: 0, [Rating.Easy]: 0 },
      consistencyScore: 0,
    };
  }

  const totalLatency = reviews.reduce((sum, r) => sum + r.metrics.timeToFirstClick, 0);
  const totalConfidence = reviews.reduce((sum, r) => sum + r.confidence, 0);
  const flaggedCount = reviews.filter(r => r.flagged).length;

  const ratingDistribution: Record<Rating, number> = {
    [Rating.Again]: 0,
    [Rating.Hard]: 0,
    [Rating.Good]: 0,
    [Rating.Easy]: 0,
  };
  reviews.forEach(r => ratingDistribution[r.rating]++);

  // Consistency score: lower variance in latency percentiles = more consistent
  const avgPercentile = reviews.reduce((sum, r) => sum + r.latencyPercentile, 0) / reviews.length;
  const percentileVariance = reviews.reduce(
    (sum, r) => sum + Math.pow(r.latencyPercentile - avgPercentile, 2), 
    0
  ) / reviews.length;
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

export default {
  deriveImplicitRating,
  updateLatencyStats,
  initLatencyStats,
  calculateLatencyPercentile,
  estimateParTime,
  analyzeSessionMetrics,
  legacyQualityToRating,
  serializeImplicitMetrics,
  DEFAULT_IMPLICIT_CONFIG,
};
