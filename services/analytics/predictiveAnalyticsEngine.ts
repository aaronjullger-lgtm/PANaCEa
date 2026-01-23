/**
 * Predictive Analytics Engine
 *
 * Advanced prediction system that:
 * - Predicts exam readiness with high accuracy
 * - Estimates days to readiness
 * - Identifies knowledge decay risk
 * - Forecasts performance degradation
 * - Provides probability distributions for outcomes
 */

import type { SystemMasteryProfile } from './advancedUserAnalyticsEngine';
import { getCognitiveState, getLearningVelocity } from './advancedUserAnalyticsEngine';

// ============================================================================
// Types
// ============================================================================

export interface ReadinessAssessment {
  /** Overall readiness score (0-100) */
  readinessScore: number;
  /** Predicted PANCE score (200-800) */
  predictedScore: number;
  /** Confidence interval for prediction */
  confidenceInterval: { lower: number; upper: number };
  /** Pass probability (0-100%) */
  passProbability: number;
  /** Estimated days to 80% pass probability */
  daysToReadiness: number | null;
  /** Readiness level category */
  level: 'not_ready' | 'building' | 'progressing' | 'almost_ready' | 'ready';
  /** Key factors affecting readiness */
  factors: ReadinessFactor[];
  /** Risk areas that need attention */
  riskAreas: RiskArea[];
  /** Projection of score over time */
  scoreProjection: ScoreProjection[];
}

export interface ReadinessFactor {
  name: string;
  impact: 'positive' | 'neutral' | 'negative';
  weight: number;
  description: string;
}

export interface RiskArea {
  system: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommendedAction: string;
  potentialImpact: number; // Points at risk
}

export interface ScoreProjection {
  days: number;
  predictedScore: number;
  confidence: number;
}

export interface DecayPrediction {
  system: string;
  currentMastery: number;
  projectedMastery: { days7: number; days14: number; days30: number };
  urgentReview: boolean;
  optimalReviewDate: Date;
}

export interface PerformanceForecaster {
  /** Predicted accuracy for next N questions */
  nextNAccuracy: number;
  /** Fatigue point prediction */
  predictedFatiguePoint: number;
  /** Optimal session end point */
  optimalSessionEnd: number;
  /** Performance trajectory */
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile';
}

// ============================================================================
// Constants
// ============================================================================

// PANCE Blueprint percentages (approximate)
const PANCE_WEIGHTS: Record<string, number> = {
  Cardiovascular: 16,
  CV: 16,
  Pulmonary: 12,
  PULM: 12,
  Gastrointestinal: 10,
  GI: 10,
  Musculoskeletal: 10,
  MSK: 10,
  EENT: 9,
  HEENT: 9,
  Reproductive: 8,
  REPRO: 8,
  Neurologic: 7,
  NEURO: 7,
  Psychiatry: 6,
  PSYCH: 6,
  Dermatologic: 5,
  DERM: 5,
  Endocrine: 6,
  ENDO: 6,
  Hematologic: 5,
  HEME: 5,
  Genitourinary: 6,
  RENAL: 6,
  'Infectious Disease': 6,
  ID: 6,
};

// ============================================================================
// Core Prediction Functions
// ============================================================================

/**
 * Calculate comprehensive readiness assessment
 */
export function calculateReadinessAssessment(
  systemMastery: SystemMasteryProfile[],
  lifetimeAccuracy: number,
  lifetimeQuestions: number,
  recentAccuracy: number,
  studyDaysStreak: number
): ReadinessAssessment {
  const factors: ReadinessFactor[] = [];
  const riskAreas: RiskArea[] = [];

  // 1. Calculate weighted mastery based on PANCE blueprint
  let weightedMastery = 0;
  let totalWeight = 0;

  for (const system of systemMastery) {
    const weight = getSystemWeight(system.system);
    weightedMastery += system.masteryLevel * weight;
    totalWeight += weight;
  }

  const avgWeightedMastery = totalWeight > 0 ? weightedMastery / totalWeight : 50;

  // 2. Sample size confidence adjustment
  const sampleConfidence = Math.min(1, lifetimeQuestions / 500);
  const confidenceAdjustedMastery =
    avgWeightedMastery * sampleConfidence + 50 * (1 - sampleConfidence);

  // 3. Trend factor
  const trendFactor = calculateTrendFactor(recentAccuracy, lifetimeAccuracy);

  // 4. Consistency factor
  const consistencyFactor = calculateConsistencyFactor(systemMastery);

  // 5. Study habit factor
  const habitFactor = Math.min(1.1, 0.9 + studyDaysStreak * 0.02);

  // Calculate base score
  const baseReadiness = confidenceAdjustedMastery * 0.6 + recentAccuracy * 0.4;
  const adjustedReadiness = baseReadiness * trendFactor * consistencyFactor * habitFactor;

  const readinessScore = Math.min(100, Math.max(0, adjustedReadiness));

  // Convert to PANCE score (200-800)
  const predictedScore = Math.round(200 + (readinessScore / 100) * 600);

  // Calculate confidence interval based on sample size
  const intervalWidth = Math.max(30, 100 - Math.min(70, lifetimeQuestions / 10));
  const confidenceInterval = {
    lower: Math.max(200, predictedScore - intervalWidth),
    upper: Math.min(800, predictedScore + intervalWidth),
  };

  // Calculate pass probability (passing ~450)
  const passProbability = calculatePassProbability(predictedScore, intervalWidth);

  // Estimate days to readiness
  const daysToReadiness = estimateDaysToReadiness(readinessScore, passProbability, systemMastery);

  // Determine level
  const level = determineReadinessLevel(readinessScore, passProbability);

  // Build factors
  if (trendFactor > 1.05) {
    factors.push({
      name: 'Improvement Trend',
      impact: 'positive',
      weight: 0.15,
      description: 'Your recent performance is improving over your baseline',
    });
  } else if (trendFactor < 0.95) {
    factors.push({
      name: 'Performance Decline',
      impact: 'negative',
      weight: 0.15,
      description: 'Recent performance below your baseline - consider reviewing strategy',
    });
  }

  if (consistencyFactor > 1) {
    factors.push({
      name: 'System Consistency',
      impact: 'positive',
      weight: 0.1,
      description: 'Balanced performance across organ systems',
    });
  } else if (consistencyFactor < 0.9) {
    factors.push({
      name: 'Uneven Coverage',
      impact: 'negative',
      weight: 0.1,
      description: 'Large gaps between your strongest and weakest systems',
    });
  }

  if (sampleConfidence > 0.8) {
    factors.push({
      name: 'Sample Size',
      impact: 'positive',
      weight: 0.1,
      description: 'Strong statistical confidence from many questions',
    });
  } else if (sampleConfidence < 0.4) {
    factors.push({
      name: 'Limited Data',
      impact: 'neutral',
      weight: 0.1,
      description: 'More practice needed for accurate prediction',
    });
  }

  // Identify risk areas
  for (const system of systemMastery) {
    const weight = getSystemWeight(system.system);

    if (system.masteryLevel < 50 && weight >= 6) {
      riskAreas.push({
        system: system.system,
        severity: system.masteryLevel < 30 ? 'critical' : 'high',
        reason: `Low mastery in high-yield system`,
        recommendedAction: `Focus study on ${system.system} fundamentals`,
        potentialImpact: Math.round((weight * (60 - system.masteryLevel)) / 10),
      });
    } else if (system.masteryLevel < 60 && weight >= 8) {
      riskAreas.push({
        system: system.system,
        severity: 'medium',
        reason: `Below target in heavily-tested system`,
        recommendedAction: `Review ${system.system} weak topics`,
        potentialImpact: Math.round((weight * (70 - system.masteryLevel)) / 10),
      });
    }
  }

  // Sort risk areas by potential impact
  riskAreas.sort((a, b) => b.potentialImpact - a.potentialImpact);

  // Generate score projection
  const scoreProjection = generateScoreProjection(readinessScore, predictedScore, systemMastery);

  return {
    readinessScore,
    predictedScore,
    confidenceInterval,
    passProbability,
    daysToReadiness,
    level,
    factors,
    riskAreas: riskAreas.slice(0, 5),
    scoreProjection,
  };
}

/**
 * Predict knowledge decay for each system
 */
export function predictKnowledgeDecay(systemMastery: SystemMasteryProfile[]): DecayPrediction[] {
  const now = new Date();
  const predictions: DecayPrediction[] = [];

  for (const system of systemMastery) {
    if (system.questionsSeen < 5) continue;

    // Base decay rate (Ebbinghaus-inspired)
    const baseDecayRate = 0.05; // 5% per day baseline

    // Adjust based on mastery (higher mastery = slower decay)
    const masteryAdjustment = 1 - system.masteryLevel / 200;

    // Adjust based on stability (FSRS-derived)
    const stabilityAdjustment =
      system.stabilityScore > 0 ? Math.max(0.3, 1 - system.stabilityScore / 100) : 1;

    const dailyDecay = baseDecayRate * masteryAdjustment * stabilityAdjustment;

    // Calculate projections
    const days7 = Math.max(10, system.masteryLevel * Math.pow(1 - dailyDecay, 7));
    const days14 = Math.max(10, system.masteryLevel * Math.pow(1 - dailyDecay, 14));
    const days30 = Math.max(10, system.masteryLevel * Math.pow(1 - dailyDecay, 30));

    // Determine optimal review date
    const targetRetention = 0.85;
    const daysToTarget = Math.log(targetRetention) / Math.log(1 - dailyDecay);
    const optimalReviewDate = new Date(now.getTime() + daysToTarget * 86400000);

    // Check if urgent
    const daysSinceReview = system.lastReviewed
      ? (now.getTime() - system.lastReviewed.getTime()) / 86400000
      : 30;
    const urgentReview = daysSinceReview > system.optimalReviewInterval * 1.5;

    predictions.push({
      system: system.system,
      currentMastery: system.masteryLevel,
      projectedMastery: { days7, days14, days30 },
      urgentReview,
      optimalReviewDate,
    });
  }

  // Sort by urgency
  predictions.sort((a, b) => {
    if (a.urgentReview !== b.urgentReview) return a.urgentReview ? -1 : 1;
    return a.projectedMastery.days7 - b.projectedMastery.days7;
  });

  return predictions;
}

/**
 * Forecast performance for current session
 */
export function forecastSessionPerformance(
  questionsAnswered: number,
  currentAccuracy: number,
  recentStreak: number
): PerformanceForecaster {
  const cognitive = getCognitiveState();
  const velocity = getLearningVelocity();

  // Predict next N accuracy based on current state
  let nextNAccuracy = currentAccuracy;

  // Cognitive adjustments
  if (cognitive.fatigueLevel > 60) {
    nextNAccuracy *= 0.9;
  } else if (cognitive.flowState > 70) {
    nextNAccuracy *= 1.05;
  }

  // Streak momentum
  if (recentStreak >= 5) {
    nextNAccuracy *= 1.03;
  }

  nextNAccuracy = Math.min(100, nextNAccuracy);

  // Predict fatigue point
  const baseFatiguePoint = 30;
  const adjustedFatiguePoint = baseFatiguePoint * (1 + velocity.retentionEfficiency / 200);
  const predictedFatiguePoint = Math.round(adjustedFatiguePoint - questionsAnswered * 0.5);

  // Optimal session end
  const optimalSessionEnd = Math.max(
    questionsAnswered + 5,
    Math.round(predictedFatiguePoint * 0.9)
  );

  // Determine trajectory
  let trajectory: 'improving' | 'stable' | 'declining' | 'volatile' = 'stable';

  if (velocity.trend === 'accelerating' && cognitive.flowState > 60) {
    trajectory = 'improving';
  } else if (cognitive.fatigueLevel > 70 || velocity.trend === 'decelerating') {
    trajectory = 'declining';
  } else if (cognitive.attentionLevel < 40) {
    trajectory = 'volatile';
  }

  return {
    nextNAccuracy: Math.round(nextNAccuracy),
    predictedFatiguePoint: Math.max(0, predictedFatiguePoint),
    optimalSessionEnd,
    trajectory,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemWeight(system: string): number {
  // Try exact match first
  if (PANCE_WEIGHTS[system]) return PANCE_WEIGHTS[system];

  // Try partial match
  for (const [key, weight] of Object.entries(PANCE_WEIGHTS)) {
    if (
      system.toUpperCase().includes(key.toUpperCase()) ||
      key.toUpperCase().includes(system.toUpperCase())
    ) {
      return weight;
    }
  }

  return 5; // Default weight
}

function calculateTrendFactor(recent: number, lifetime: number): number {
  if (lifetime === 0) return 1;

  const ratio = recent / lifetime;

  if (ratio > 1.1) return 1.1;
  if (ratio > 1.05) return 1.05;
  if (ratio < 0.9) return 0.9;
  if (ratio < 0.95) return 0.95;
  return 1;
}

function calculateConsistencyFactor(systems: SystemMasteryProfile[]): number {
  if (systems.length < 3) return 1;

  const masteries = systems.map((s) => s.masteryLevel);
  const max = Math.max(...masteries);
  const min = Math.min(...masteries);
  const range = max - min;

  if (range < 20) return 1.05;
  if (range < 30) return 1;
  if (range < 40) return 0.95;
  return 0.9;
}

function calculatePassProbability(score: number, intervalWidth: number): number {
  const passingScore = 450;

  // Simple normal distribution approximation
  const z = (score - passingScore) / (intervalWidth / 2);

  // Approximate cumulative normal
  const probability = 0.5 * (1 + Math.tanh(z * 0.8));

  return Math.round(Math.min(99, Math.max(1, probability * 100)));
}

function estimateDaysToReadiness(
  readiness: number,
  passProbability: number,
  systems: SystemMasteryProfile[]
): number | null {
  if (passProbability >= 80) return 0;
  if (readiness < 20) return null; // Too early to estimate

  // Base estimate on current trajectory
  const targetReadiness = 75; // ~80% pass probability
  const gap = targetReadiness - readiness;

  if (gap <= 0) return 0;

  // Estimate daily improvement (conservative)
  const dailyImprovement = 0.5; // 0.5% per day with consistent study

  return Math.ceil(gap / dailyImprovement);
}

function determineReadinessLevel(
  readiness: number,
  passProbability: number
): 'not_ready' | 'building' | 'progressing' | 'almost_ready' | 'ready' {
  if (passProbability >= 85) return 'ready';
  if (passProbability >= 70) return 'almost_ready';
  if (readiness >= 50) return 'progressing';
  if (readiness >= 30) return 'building';
  return 'not_ready';
}

function generateScoreProjection(
  currentReadiness: number,
  currentScore: number,
  systems: SystemMasteryProfile[]
): ScoreProjection[] {
  const projections: ScoreProjection[] = [];

  // Estimate improvement rate based on weak areas
  const weakSystems = systems.filter((s) => s.masteryLevel < 60).length;
  const improvementPotential = weakSystems * 2; // Points per day potential

  for (const days of [7, 14, 30, 60, 90]) {
    // Diminishing returns over time
    const diminishing = Math.pow(0.95, days / 30);
    const improvement = improvementPotential * days * diminishing;

    const projectedScore = Math.min(800, Math.round(currentScore + improvement));
    const confidence = Math.max(0.3, 1 - days / 180);

    projections.push({
      days,
      predictedScore: projectedScore,
      confidence,
    });
  }

  return projections;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  calculateReadinessAssessment,
  predictKnowledgeDecay,
  forecastSessionPerformance,
};
