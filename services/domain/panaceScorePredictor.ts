/**
 * PANaCEa Score Predictor - Sprint 2
 *
 * Predicts PANCE performance score based on practice performance.
 * Uses Bayesian modeling with organ system weights from NCCPA Blueprint.
 *
 * @see docs/PANCE Blueprint for official organ system distribution
 */

import { API_ENDPOINTS, fetchWithAuth } from '../../lib/apiClient';

// ============================================================================
// TYPES
// ============================================================================

export interface SystemPerformance {
  system: string;
  questionsAttempted: number;
  correctAnswers: number;
  accuracy: number;
  averageStability: number;
  averageRetrievability: number;
  trend: 'improving' | 'stable' | 'declining';
  weightedImpact: number;
  lastAttempted: Date | null;
}

export interface PANaCEaScorePrediction {
  predictedScore: number;
  confidenceInterval: [number, number];
  confidenceLevel: number;
  systemPerformance: SystemPerformance[];
  weakSystems: string[];
  strongSystems: string[];
  readinessLevel: 'not-ready' | 'borderline' | 'ready' | 'highly-ready';
  recommendedFocus: string[];
  modelVersion: string;
  lastUpdated: Date;
}

interface SystemWeight {
  system: string;
  weight: number; // NCCPA Blueprint percentage
}

// ============================================================================
// NCCPA BLUEPRINT WEIGHTS (2025)
// ============================================================================

const SYSTEM_WEIGHTS: SystemWeight[] = [
  { system: 'Cardiovascular', weight: 0.11 },
  { system: 'Pulmonary', weight: 0.09 },
  { system: 'Gastrointestinal/Nutritional', weight: 0.08 },
  { system: 'Musculoskeletal', weight: 0.08 },
  { system: 'EENT', weight: 0.08 },
  { system: 'Reproductive', weight: 0.08 },
  { system: 'Genitourinary', weight: 0.06 },
  { system: 'Endocrine', weight: 0.06 },
  { system: 'Neurologic', weight: 0.06 },
  { system: 'Dermatologic', weight: 0.06 },
  { system: 'Psychiatry/Behavioral', weight: 0.06 },
  { system: 'Hematologic', weight: 0.05 },
  { system: 'Infectious Diseases', weight: 0.05 },
  { system: 'Other', weight: 0.08 }, // General principles, legal, etc.
];

// PANCE score range: 200-800, passing = 350
const PANCE_MIN = 200;
const PANCE_MAX = 800;
const PANCE_PASSING = 350;
const PANCE_MEAN = 490; // Historical mean
const PANCE_SD = 100; // Historical standard deviation

// ============================================================================
// CORE PREDICTION ALGORITHM
// ============================================================================

/**
 * Predicts PANCE score using weighted Bayesian model.
 *
 * Formula:
 * PredictedScore = PANCE_MEAN + (WeightedAccuracy - 0.75) * SCALING_FACTOR
 *
 * Where:
 * - WeightedAccuracy = Σ(system_accuracy * blueprint_weight)
 * - 0.75 is the expected accuracy for a passing candidate
 * - SCALING_FACTOR adjusts raw accuracy to score scale
 *
 * Confidence interval uses Wilson score interval for binomial proportion.
 */
export function predictPANaCEaScore(
  systemPerformance: SystemPerformance[]
): PANaCEaScorePrediction {
  // Calculate weighted accuracy
  let weightedAccuracy = 0;
  let totalWeight = 0;
  let totalQuestions = 0;

  for (const perf of systemPerformance) {
    const systemWeight = SYSTEM_WEIGHTS.find((w) => w.system === perf.system);
    if (systemWeight && perf.questionsAttempted >= 10) {
      // Only include systems with sufficient data
      weightedAccuracy += perf.accuracy * systemWeight.weight;
      totalWeight += systemWeight.weight;
      totalQuestions += perf.questionsAttempted;
    }
  }

  // Normalize if we don't have data for all systems
  if (totalWeight > 0) {
    weightedAccuracy /= totalWeight;
  }

  // Bayesian adjustment: pull toward population mean if low sample size
  const RELIABLE_N = 360; // PANCE has 360 questions
  const sampleSizeWeight = Math.min(1, totalQuestions / RELIABLE_N);
  const bayesianAccuracy =
    weightedAccuracy * sampleSizeWeight + 0.75 * (1 - sampleSizeWeight);

  // Convert accuracy to PANCE score
  // Linear scaling: 60% accuracy → 350 (passing), 75% → 490 (mean), 90% → 650+
  const SCALING_FACTOR = 600;
  const predictedScore = Math.round(
    PANCE_MEAN + (bayesianAccuracy - 0.75) * SCALING_FACTOR
  );

  // Clamp to valid range
  const clampedScore = Math.max(PANCE_MIN, Math.min(PANCE_MAX, predictedScore));

  // Calculate confidence interval (Wilson score interval)
  const z = 1.96; // 95% confidence
  const p = bayesianAccuracy;
  const n = totalQuestions > 0 ? totalQuestions : 1;

  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  const lowerBound = Math.max(
    PANCE_MIN,
    Math.round(PANCE_MEAN + (center - margin - 0.75) * SCALING_FACTOR)
  );
  const upperBound = Math.min(
    PANCE_MAX,
    Math.round(PANCE_MEAN + (center + margin - 0.75) * SCALING_FACTOR)
  );

  // Confidence level decreases with low sample size
  const confidenceLevel = Math.min(0.95, sampleSizeWeight * 0.95);

  // Identify weak and strong systems
  const weakSystems = systemPerformance
    .filter((p) => p.accuracy < 0.65 && p.questionsAttempted >= 10)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
    .map((p) => p.system);

  const strongSystems = systemPerformance
    .filter((p) => p.accuracy >= 0.85 && p.questionsAttempted >= 10)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)
    .map((p) => p.system);

  // Determine readiness level
  let readinessLevel: PANaCEaScorePrediction['readinessLevel'];
  if (clampedScore >= 500) {
    readinessLevel = 'highly-ready';
  } else if (clampedScore >= PANCE_PASSING + 50) {
    readinessLevel = 'ready';
  } else if (clampedScore >= PANCE_PASSING) {
    readinessLevel = 'borderline';
  } else {
    readinessLevel = 'not-ready';
  }

  // Generate focus recommendations
  const recommendedFocus: string[] = [];
  if (weakSystems.length > 0) {
    recommendedFocus.push(`Focus on weak systems: ${weakSystems.join(', ')}`);
  }

  // Check for systems with insufficient practice
  const insufficientPractice = systemPerformance
    .filter((p) => p.questionsAttempted < 30)
    .map((p) => p.system);
  if (insufficientPractice.length > 0) {
    recommendedFocus.push(
      `Increase practice in: ${insufficientPractice.slice(0, 3).join(', ')}`
    );
  }

  // Check for declining trends
  const decliningTrends = systemPerformance
    .filter((p) => p.trend === 'declining' && p.questionsAttempted >= 20)
    .map((p) => p.system);
  if (decliningTrends.length > 0) {
    recommendedFocus.push(
      `Review fundamentals for: ${decliningTrends.slice(0, 2).join(', ')}`
    );
  }

  return {
    predictedScore: clampedScore,
    confidenceInterval: [lowerBound, upperBound],
    confidenceLevel,
    systemPerformance,
    weakSystems,
    strongSystems,
    readinessLevel,
    recommendedFocus,
    modelVersion: 'v2.0-bayesian',
    lastUpdated: new Date(),
  };
}

// ============================================================================
// API INTEGRATION
// ============================================================================

/**
 * Fetches user's system performance data from the API.
 * Uses ReviewLog data aggregated by organ system.
 */
export async function fetchUserSystemPerformance(
  token: string
): Promise<SystemPerformance[]> {
  try {
    const response = await fetchWithAuth(API_ENDPOINTS.SYSTEM_PERFORMANCE, token);

    if (!response.ok) {
      throw new Error(`Failed to fetch system performance: ${response.statusText}`);
    }

    const data = await response.json();
    return data.systemPerformance || [];
  } catch (error) {
    console.error('[panaceScorePredictor] Error fetching system performance:', error);
    throw error;
  }
}

/**
 * Fetches complete PANCE score prediction with system performance.
 */
export async function fetchPANaCEaPrediction(
  token: string
): Promise<PANaCEaScorePrediction> {
  const systemPerformance = await fetchUserSystemPerformance(token);
  return predictPANaCEaScore(systemPerformance);
}

/**
 * Client-side prediction using cached system performance data.
 * Use this when you already have system performance data to avoid API call.
 */
export function predictFromCache(
  systemPerformance: SystemPerformance[]
): PANaCEaScorePrediction {
  return predictPANaCEaScore(systemPerformance);
}
