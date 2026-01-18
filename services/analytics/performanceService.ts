/**
 * Consolidated Performance Service
 *
 * Single entry point for all performance-related operations.
 * Consolidates: performanceService, panaceScorePredictor,
 * panceScorePredictorService, performancePredictionService
 *
 * @module services/analytics/performanceService
 */

// ============================================================================
// Re-exports from legacy services (façade pattern)
// ============================================================================

// Base performance service (localStorage recording, hierarchical stats)
export {
  recordQuestionOutcome,
  getHierarchicalStats,
  clearPerformanceCache,
  type ConditionStats,
  type SubcategoryStats,
  type SystemStats,
} from '../performanceService';

// Class-based PANCE predictor (more sophisticated)
export {
  PANCEScorePredictorService,
  type PerformanceDataPoint,
  type SystemPerformance as ISystemPerformance,
  type PredictedScore as IrtPredictedScore,
  type HistoricalPrediction,
} from '../panceScorePredictorService';

// Session-scoped prediction (temporary session data)
export {
  predictPANCEScore,
  updatePerformancePrediction,
  getPrediction as getSessionPrediction,
  getConfidenceInterval,
  resetPrediction,
  calculateTrend,
  type PredictionResult,
  type PerformanceSnapshot,
} from '../performancePredictionService';

// ============================================================================
// Unified Types (consolidate duplicates)
// ============================================================================

export interface SystemPerformance {
  system: string;
  accuracy: number;
  questionsAttempted: number;
  totalQuestions?: number;
  trend: 'improving' | 'stable' | 'declining';
  lastPracticed?: Date | null;
  masteryLevel?: number;
  weight?: number;
}

export interface ScorePrediction {
  predictedScore: number;
  scaledScore?: number;
  confidenceInterval: { low: number; high: number; lower?: number; upper?: number };
  passLikelihood: number;
  probabilityOfPassing?: number;
  confidence?: 'high' | 'medium' | 'low';
  readinessLevel?: 'not_ready' | 'borderline' | 'likely_pass' | 'confident_pass';
  keyStrengths: string[];
  strengths?: string[];
  keyRisks?: string[];
  riskFactors?: string[];
  weaknesses?: string[];
  recommendedFocusAreas?: string[];
  recommendations?: string[];
  estimatedStudyHoursToPass?: number;
  projectedDate?: Date | null;
}

// ============================================================================
// Unified NCCPA Blueprint Weights (single source of truth)
// ============================================================================

/**
 * NCCPA PANCE Blueprint weights (2024)
 * Based on official exam blueprint
 */
export const NCCPA_BLUEPRINT_WEIGHTS: Record<string, number> = {
  cardiovascular: 0.16,
  pulmonary: 0.12,
  gastrointestinal: 0.1,
  musculoskeletal: 0.1,
  eent: 0.09,
  heent: 0.09,
  reproductive: 0.08,
  neurological: 0.08,
  psychiatry: 0.06,
  dermatology: 0.05,
  endocrine: 0.05,
  renal: 0.05,
  hematology: 0.03,
  infectious_disease: 0.03,
  infectious: 0.03,
};

// Exam score constants
export const PANCE_CONSTANTS = {
  PASS_SCORE: 350,
  MIN_SCORE: 200,
  MAX_SCORE: 800,
  MIN_QUESTIONS_FOR_PREDICTION: 50,
  IDEAL_TIME_PER_QUESTION_MS: 72000, // 72 seconds
};

// ============================================================================
// Unified Score Prediction (best of all implementations)
// ============================================================================

/**
 * Unified PANCE score prediction
 * Combines logic from all 3 prediction services
 */
export function predictScore(
  systemPerformance: SystemPerformance[],
  options: {
    totalQuestions?: number;
    avgTimePerQuestionMs?: number;
    streakData?: { maxStreak: number; avgStreak: number };
    errorPatterns?: Array<{ type: string; frequency: number }>;
  } = {}
): ScorePrediction {
  const { totalQuestions = 0, avgTimePerQuestionMs, streakData, errorPatterns } = options;

  // Minimum questions check
  if (totalQuestions < PANCE_CONSTANTS.MIN_QUESTIONS_FOR_PREDICTION) {
    return getInsufficientDataResult(totalQuestions);
  }

  // Calculate weighted accuracy based on NCCPA blueprint
  const weightedAccuracy = calculateWeightedAccuracy(systemPerformance);

  // Base score calculation (200-800 scale)
  let rawScore =
    PANCE_CONSTANTS.MIN_SCORE +
    weightedAccuracy * (PANCE_CONSTANTS.MAX_SCORE - PANCE_CONSTANTS.MIN_SCORE);

  // Volume adjustment (more questions = more reliable)
  const volumeAdj = Math.min(1, 0.7 + (0.3 * Math.log10(totalQuestions + 1)) / 3);
  rawScore *= volumeAdj;

  // Trend adjustment
  let trendAdj = 1.0;
  for (const sys of systemPerformance) {
    const weight = getSystemWeight(sys.system);
    if (sys.trend === 'improving') trendAdj += 0.02 * weight * 10;
    else if (sys.trend === 'declining') trendAdj -= 0.03 * weight * 10;
  }
  trendAdj = Math.max(0.85, Math.min(1.15, trendAdj));
  rawScore *= trendAdj;

  // Time management adjustment
  if (avgTimePerQuestionMs) {
    const idealTime = PANCE_CONSTANTS.IDEAL_TIME_PER_QUESTION_MS;
    if (avgTimePerQuestionMs < idealTime * 0.8 && weightedAccuracy >= 0.7) {
      rawScore += 10; // Efficient with good accuracy
    } else if (avgTimePerQuestionMs > idealTime * 1.5) {
      rawScore -= 10; // Too slow
    }
  }

  // Streak bonus
  if (streakData) {
    if (streakData.maxStreak >= 10) rawScore += 10;
    if (streakData.avgStreak < 2 && totalQuestions >= 20) rawScore -= 10;
  }

  // Error penalty
  let errorPenalty = 0;
  if (errorPatterns) {
    for (const p of errorPatterns) {
      if (p.type === 'knowledge_gap') errorPenalty += p.frequency * 15;
      else if (p.type === 'interference') errorPenalty += p.frequency * 10;
      else errorPenalty += p.frequency * 5;
    }
    rawScore -= Math.min(100, errorPenalty);
  }

  // Clamp to valid range
  const predictedScore = Math.round(
    Math.max(PANCE_CONSTANTS.MIN_SCORE, Math.min(PANCE_CONSTANTS.MAX_SCORE, rawScore))
  );

  // Confidence interval based on sample size
  const uncertainty = 80 * Math.max(0.5, 1 - Math.log10(totalQuestions + 1) / 4);
  const confidenceInterval = {
    low: Math.max(PANCE_CONSTANTS.MIN_SCORE, Math.round(predictedScore - uncertainty)),
    high: Math.min(PANCE_CONSTANTS.MAX_SCORE, Math.round(predictedScore + uncertainty)),
  };

  // Pass likelihood using logistic function
  const passLikelihood = calculatePassLikelihood(predictedScore, uncertainty);

  // Identify strengths and risks
  const { strengths, risks, focusAreas } = analyzePerformance(systemPerformance);

  // Estimate study hours needed
  const pointsNeeded = Math.max(0, PANCE_CONSTANTS.PASS_SCORE - predictedScore);
  const estimatedStudyHoursToPass = Math.ceil(pointsNeeded * 0.5);

  // Readiness level
  const readinessLevel =
    passLikelihood >= 90
      ? 'confident_pass'
      : passLikelihood >= 75
        ? 'likely_pass'
        : passLikelihood >= 50
          ? 'borderline'
          : 'not_ready';

  return {
    predictedScore,
    scaledScore: predictedScore,
    confidenceInterval,
    passLikelihood,
    probabilityOfPassing: passLikelihood,
    readinessLevel,
    keyStrengths: strengths,
    keyRisks: risks,
    weaknesses: risks,
    recommendedFocusAreas: focusAreas,
    recommendations: generateRecommendations(systemPerformance, passLikelihood),
    estimatedStudyHoursToPass,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSystemWeight(system: string): number {
  const normalized = system.toLowerCase().replace(/[^a-z]/g, '');
  return NCCPA_BLUEPRINT_WEIGHTS[normalized] || 0.05;
}

function calculateWeightedAccuracy(systemPerformance: SystemPerformance[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const sys of systemPerformance) {
    const weight = getSystemWeight(sys.system);
    const questions = sys.questionsAttempted || sys.totalQuestions || 0;
    if (questions > 0) {
      weightedSum += sys.accuracy * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

function calculatePassLikelihood(score: number, uncertainty: number): number {
  const effectiveScore = (score + (score - uncertainty)) / 2; // Conservative estimate
  const k = 0.02;
  const midpoint = PANCE_CONSTANTS.PASS_SCORE;
  const likelihood = 100 / (1 + Math.exp(-k * (effectiveScore - midpoint)));
  return Math.round(Math.max(0, Math.min(100, likelihood)));
}

function analyzePerformance(systemPerformance: SystemPerformance[]): {
  strengths: string[];
  risks: string[];
  focusAreas: string[];
} {
  const strengths: string[] = [];
  const risks: string[] = [];
  const focusAreas: string[] = [];

  for (const sys of systemPerformance) {
    const questions = sys.questionsAttempted || sys.totalQuestions || 0;
    if (sys.accuracy >= 0.8 && questions >= 20) {
      strengths.push(`Strong ${sys.system} (${Math.round(sys.accuracy * 100)}%)`);
    }
    if (sys.accuracy < 0.6) {
      risks.push(`Weak ${sys.system} (${Math.round(sys.accuracy * 100)}%)`);
      focusAreas.push(sys.system);
    }
    if (sys.trend === 'declining') {
      risks.push(`${sys.system} declining`);
    }
  }

  return {
    strengths: strengths.slice(0, 5),
    risks: risks.slice(0, 5),
    focusAreas: focusAreas.slice(0, 5),
  };
}

function generateRecommendations(
  systemPerformance: SystemPerformance[],
  passLikelihood: number
): string[] {
  const recommendations: string[] = [];

  // Weakness-based
  const weakSystems = systemPerformance
    .filter((s) => s.accuracy < 0.6)
    .sort((a, b) => a.accuracy - b.accuracy);

  for (const sys of weakSystems.slice(0, 2)) {
    const questions = sys.questionsAttempted || sys.totalQuestions || 0;
    if (questions < 30) {
      recommendations.push(`Practice more ${sys.system} questions (only ${questions} attempted)`);
    } else {
      recommendations.push(
        `Review ${sys.system} fundamentals - accuracy is ${Math.round(sys.accuracy * 100)}%`
      );
    }
  }

  // Readiness-based
  if (passLikelihood < 50) {
    recommendations.push('Focus on foundational concepts before advanced topics');
    recommendations.push('Aim for 50+ questions per day with active review');
  } else if (passLikelihood < 75) {
    recommendations.push('Focus on weak areas while maintaining strengths');
    recommendations.push('Practice timed blocks to build exam stamina');
  } else {
    recommendations.push("Maintain current pace - you're on track!");
    recommendations.push('Consider full-length practice exams');
  }

  return recommendations.slice(0, 5);
}

function getInsufficientDataResult(questionsAnswered: number): ScorePrediction {
  const needed = PANCE_CONSTANTS.MIN_QUESTIONS_FOR_PREDICTION - questionsAnswered;
  return {
    predictedScore: 0,
    confidenceInterval: { low: 0, high: 0 },
    passLikelihood: 0,
    readinessLevel: 'not_ready',
    keyStrengths: [],
    keyRisks: [],
    recommendedFocusAreas: [],
    recommendations: [
      `Answer ${needed} more questions for a prediction`,
      'Focus on variety across all organ systems',
      'Complete at least 20 questions per major system',
    ],
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Recording
  recordQuestionOutcome: async (
    ...args: Parameters<typeof import('../performanceService').recordQuestionOutcome>
  ) => (await import('../performanceService')).recordQuestionOutcome(...args),

  // Stats
  getHierarchicalStats: async () => (await import('../performanceService')).getHierarchicalStats(),

  // Prediction (unified)
  predictScore,

  // Session prediction
  getSessionPrediction: async () =>
    (await import('../performancePredictionService')).getPrediction(),

  // Class-based predictor (for advanced use)
  PANCEScorePredictorService: async () =>
    (await import('../panceScorePredictorService')).PANCEScorePredictorService,

  // Constants
  NCCPA_BLUEPRINT_WEIGHTS,
  PANCE_CONSTANTS,
};
