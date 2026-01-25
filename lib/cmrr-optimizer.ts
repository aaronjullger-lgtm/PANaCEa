/**
 * CMRR Optimizer (Cost-Minimizing Desired Retention)
 *
 * Implements dynamic retention optimization for FSRS v5/v6
 * Based on: "Optimizing Spaced Repetition Schedule by Capturing the
 * Dynamics of Memory" (Ye et al., 2024)
 *
 * The key insight: A fixed R=0.90 is suboptimal. Users with limited
 * study time should target lower retention (more reviews, less accuracy)
 * while users with more time can afford higher retention targets.
 *
 * Formula: Minimize (Workload / Knowledge) where:
 * - Workload = Expected reviews per day
 * - Knowledge = Accumulated retrievability
 */

import { NCCPA_BLUEPRINT_WEIGHTS } from './nccpa-blueprint';

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewHistoryEntry {
  date: string;
  stability: number;
  difficulty: number;
  rating: number;
  state: number;
}

export interface FSRSParams {
  w: number[];
  requestR: number;
  maximumInterval: number;
  enableFuzz: boolean;
}

export interface CMRRInput {
  reviewHistory: ReviewHistoryEntry[];
  avgStudyTimeMinutes: number; // Available study time per day
  targetExamDate?: Date; // Optional exam date for urgency factor
  currentParams?: FSRSParams;
}

export interface CMRROutput {
  optimalRetention: number; // Recommended R value (0.80-0.97)
  workloadEstimate: number; // Expected reviews per day
  knowledgeScore: number; // Accumulated knowledge (0-100)
  efficiencyRatio: number; // Knowledge / Workload (higher = better)
  confidenceLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  sliderPosition: number; // 0-100 for UI slider
}

// ============================================================================
// CONSTANTS
// ============================================================================

// FSRS v5 default parameters
const DEFAULT_W = [
  0.4072,
  1.1829,
  3.1262,
  15.4722, // Initial stability (S0)
  7.2102,
  0.5316,
  1.0651, // Difficulty-stability relationship
  0.0652,
  1.5351,
  0.1367,
  1.045, // Memory strength decay
  1.9395,
  0.1091,
  0.2995,
  2.2584, // Forgetting curve parameters
  0.2898,
  2.819,
  0.517,
  0.605, // Additional v5 parameters
];

// Retention bounds (don't go below 0.80 or above 0.97)
const MIN_RETENTION = 0.8;
const MAX_RETENTION = 0.97;
const DEFAULT_RETENTION = 0.9;

// Minimum reviews needed for reliable optimization
const MIN_REVIEWS_FOR_OPTIMIZATION = 50;

// Decay constant for FSRS
const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate optimal retention using CMRR algorithm
 *
 * The algorithm finds R that minimizes:
 * Cost = (1 / R) * ln(R) - but with practical constraints
 *
 * @param input - Review history and constraints
 * @returns Optimal retention and metadata
 */
export function calculateOptimalRetention(input: CMRRInput): CMRROutput {
  const { reviewHistory, avgStudyTimeMinutes, targetExamDate, currentParams } = input;

  // Check if we have enough data for reliable optimization
  if (reviewHistory.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    return {
      optimalRetention: DEFAULT_RETENTION,
      workloadEstimate: 0,
      knowledgeScore: 0,
      efficiencyRatio: 0,
      confidenceLevel: 'low',
      recommendation: `Complete ${MIN_REVIEWS_FOR_OPTIMIZATION - reviewHistory.length} more reviews for personalized optimization.`,
      sliderPosition: 50,
    };
  }

  // Extract user's learning parameters from history
  const userParams = estimateUserParameters(reviewHistory);

  // Calculate workload at different retention levels
  const retentionSamples = [0.8, 0.82, 0.85, 0.87, 0.9, 0.92, 0.95, 0.97];
  const efficiencies: { r: number; efficiency: number; workload: number }[] = [];

  for (const r of retentionSamples) {
    const workload = estimateWorkload(r, userParams, reviewHistory.length);
    const knowledge = estimateKnowledge(r, userParams);
    const efficiency = knowledge / Math.max(workload, 1);
    efficiencies.push({ r, efficiency, workload });
  }

  // Find optimal R considering time constraints
  const timeConstraintFactor = calculateTimeConstraintFactor(avgStudyTimeMinutes);

  // Sort by efficiency and apply time constraint
  efficiencies.sort((a, b) => b.efficiency - a.efficiency);

  // Select R based on available time
  let optimalR = DEFAULT_RETENTION;
  const bestEfficiency = efficiencies[0];

  if (bestEfficiency) {
    if (timeConstraintFactor < 0.5) {
      // Limited time: accept lower retention for manageable workload
      optimalR = Math.max(MIN_RETENTION, bestEfficiency.r - 0.05);
    } else if (timeConstraintFactor > 1.5) {
      // Plenty of time: can afford higher retention
      optimalR = Math.min(MAX_RETENTION, bestEfficiency.r + 0.03);
    } else {
      // Normal: use efficiency-optimal R
      optimalR = bestEfficiency.r;
    }
  }

  // Apply exam urgency adjustment
  if (targetExamDate) {
    const daysUntilExam = Math.max(
      1,
      (targetExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExam < 30) {
      // Exam imminent: lower R to cover more ground
      optimalR = Math.max(MIN_RETENTION, optimalR - 0.05);
    } else if (daysUntilExam > 180) {
      // Plenty of time: can afford higher retention
      optimalR = Math.min(MAX_RETENTION, optimalR + 0.02);
    }
  }

  // Clamp to valid range
  optimalR = Math.max(MIN_RETENTION, Math.min(MAX_RETENTION, optimalR));

  // Calculate final metrics
  const finalWorkload = estimateWorkload(optimalR, userParams, reviewHistory.length);
  const finalKnowledge = estimateKnowledge(optimalR, userParams);
  const finalEfficiency = finalKnowledge / Math.max(finalWorkload, 1);

  // Determine confidence level
  const confidenceLevel =
    reviewHistory.length >= 200 ? 'high' : reviewHistory.length >= 100 ? 'medium' : 'low';

  // Generate recommendation
  const recommendation = generateRecommendation(
    optimalR,
    currentParams?.requestR || DEFAULT_RETENTION,
    avgStudyTimeMinutes
  );

  // Calculate slider position (0-100)
  const sliderPosition = Math.round(
    ((optimalR - MIN_RETENTION) / (MAX_RETENTION - MIN_RETENTION)) * 100
  );

  return {
    optimalRetention: Math.round(optimalR * 1000) / 1000, // 3 decimal places
    workloadEstimate: Math.round(finalWorkload),
    knowledgeScore: Math.round(finalKnowledge),
    efficiencyRatio: Math.round(finalEfficiency * 100) / 100,
    confidenceLevel,
    recommendation,
    sliderPosition,
  };
}

/**
 * Estimate user-specific learning parameters from review history
 */
function estimateUserParameters(history: ReviewHistoryEntry[]): {
  avgStability: number;
  avgDifficulty: number;
  lapseRate: number;
  retentionRate: number;
} {
  if (history.length === 0) {
    return {
      avgStability: 1.0,
      avgDifficulty: 5.0,
      lapseRate: 0.1,
      retentionRate: 0.9,
    };
  }

  const stabilities = history.map((h) => h.stability).filter((s) => s > 0);
  const difficulties = history.map((h) => h.difficulty).filter((d) => d > 0);
  const ratings = history.map((h) => h.rating);

  const avgStability =
    stabilities.length > 0 ? stabilities.reduce((a, b) => a + b, 0) / stabilities.length : 1.0;

  const avgDifficulty =
    difficulties.length > 0 ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length : 5.0;

  // Lapse rate = proportion of "Again" ratings
  const lapseCount = ratings.filter((r) => r === 1).length;
  const lapseRate = lapseCount / ratings.length;

  // Retention rate = proportion of "Good" or "Easy" ratings
  const retentionCount = ratings.filter((r) => r >= 3).length;
  const retentionRate = retentionCount / ratings.length;

  return {
    avgStability,
    avgDifficulty,
    lapseRate,
    retentionRate,
  };
}

/**
 * Estimate daily workload for a given retention target
 *
 * Based on FSRS interval formula: I = S * (R^(1/DECAY) - 1)
 */
function estimateWorkload(
  retention: number,
  params: { avgStability: number; avgDifficulty: number; lapseRate: number },
  totalCards: number
): number {
  // Average interval at target retention
  const avgInterval = params.avgStability * (Math.pow(retention, 1 / DECAY) - 1);

  // Daily reviews = total cards / average interval (plus lapse re-reviews)
  const baseReviews = totalCards / Math.max(avgInterval, 1);
  const lapseReviews = baseReviews * params.lapseRate * 3; // Lapses need ~3 extra reviews

  return baseReviews + lapseReviews;
}

/**
 * Estimate accumulated knowledge score
 *
 * Knowledge = sum of (stability * retrievability) across all cards
 */
function estimateKnowledge(
  retention: number,
  params: { avgStability: number; avgDifficulty: number; retentionRate: number }
): number {
  // Higher retention = higher knowledge, but diminishing returns
  const baseKnowledge = retention * 100;

  // Stability amplifies knowledge
  const stabilityBonus = Math.log2(params.avgStability + 1) * 10;

  // Retention rate indicates actual learning
  const retentionBonus = params.retentionRate * 20;

  return Math.min(100, baseKnowledge + stabilityBonus + retentionBonus);
}

/**
 * Calculate time constraint factor based on available study time
 *
 * < 15 min/day = severely constrained (factor < 0.5)
 * 15-30 min/day = constrained (factor 0.5-1.0)
 * 30-60 min/day = normal (factor 1.0)
 * > 60 min/day = abundant (factor > 1.0)
 */
function calculateTimeConstraintFactor(avgMinutes: number): number {
  if (avgMinutes < 15) return avgMinutes / 30;
  if (avgMinutes < 30) return 0.5 + (avgMinutes - 15) / 30;
  if (avgMinutes < 60) return 1.0;
  return 1.0 + (avgMinutes - 60) / 60;
}

/**
 * Generate human-readable recommendation
 */
function generateRecommendation(optimalR: number, currentR: number, avgMinutes: number): string {
  const diff = optimalR - currentR;

  if (Math.abs(diff) < 0.02) {
    return `Your current retention target (${Math.round(currentR * 100)}%) is well-calibrated for your study patterns.`;
  }

  if (diff > 0) {
    if (avgMinutes > 45) {
      return `With your available study time (${avgMinutes} min/day), you can target ${Math.round(optimalR * 100)}% retention for stronger long-term memory.`;
    }
    return `Consider increasing retention to ${Math.round(optimalR * 100)}% for better exam preparation.`;
  }

  if (avgMinutes < 20) {
    return `Given limited study time (${avgMinutes} min/day), targeting ${Math.round(optimalR * 100)}% retention will help you cover more material.`;
  }
  return `Lowering retention to ${Math.round(optimalR * 100)}% may improve your study efficiency by reducing review burden.`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert retention target to human-readable label
 */
export function retentionToLabel(r: number): string {
  if (r >= 0.95) return 'Maximum Memory';
  if (r >= 0.9) return 'High Retention';
  if (r >= 0.85) return 'Balanced';
  if (r >= 0.8) return 'Efficiency Focus';
  return 'Speed Learning';
}

/**
 * Get recommended settings based on user profile
 */
export function getRetentionPresets(): Array<{
  label: string;
  value: number;
  description: string;
  bestFor: string;
}> {
  return [
    {
      label: 'Efficiency Mode',
      value: 0.82,
      description: 'Lower retention, higher throughput',
      bestFor: 'Limited study time, broad coverage needed',
    },
    {
      label: 'Balanced',
      value: 0.87,
      description: 'Good balance of retention and workload',
      bestFor: 'Regular study schedule, exam in 2-6 months',
    },
    {
      label: 'Standard FSRS',
      value: 0.9,
      description: 'FSRS default, proven effective',
      bestFor: 'Most users, general study',
    },
    {
      label: 'High Retention',
      value: 0.93,
      description: 'Stronger memory, more reviews',
      bestFor: 'Plenty of time, want deep mastery',
    },
    {
      label: 'Maximum Memory',
      value: 0.97,
      description: 'Highest retention, highest workload',
      bestFor: 'Exam imminent, critical material only',
    },
  ];
}

/**
 * Calculate interval for a given retention and stability
 */
export function calculateInterval(stability: number, retention: number): number {
  return Math.max(1, Math.round(stability * (Math.pow(retention, 1 / DECAY) - 1)));
}

/**
 * Estimate time to complete reviews for a given retention
 */
export function estimateReviewTime(
  reviewCount: number,
  avgSecondsPerReview: number = 30
): { minutes: number; formatted: string } {
  const minutes = Math.round((reviewCount * avgSecondsPerReview) / 60);
  const formatted =
    minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return { minutes, formatted };
}

export default {
  calculateOptimalRetention,
  retentionToLabel,
  getRetentionPresets,
  calculateInterval,
  estimateReviewTime,
};
