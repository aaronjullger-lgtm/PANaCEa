/**
 * PANCE Score Predictor Service
 * Sprint 7: Statistical model to predict PANCE score based on practice performance
 *
 * Uses item response theory (IRT) concepts and historical performance data
 * to estimate likelihood of passing the real exam.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PerformanceDataPoint {
  questionId: string;
  conditionId?: string;
  organSystem: string;
  difficulty: number; // 1-10 scale
  isCorrect: boolean;
  responseTimeMs: number;
  timestamp: Date;
}

export interface SystemPerformance {
  system: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  averageDifficulty: number;
  trend: 'improving' | 'stable' | 'declining';
  weight: number; // NCCPA blueprint weight
}

export interface PredictedScore {
  scaledScore: number; // 200-800 PANCE scale
  confidenceInterval: { lower: number; upper: number };
  passLikelihood: number; // 0-100%
  readinessLevel: 'not_ready' | 'borderline' | 'likely_pass' | 'confident_pass';
  projectedDate: Date | null; // Estimated date to reach 80% pass likelihood
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface HistoricalPrediction {
  date: Date;
  predictedScore: number;
  actualScore?: number;
  questionsAnswered: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// NCCPA Blueprint weights (2024)
const NCCPA_WEIGHTS: Record<string, number> = {
  cardiovascular: 0.11,
  pulmonary: 0.09,
  gastrointestinal: 0.09,
  musculoskeletal: 0.09,
  heent: 0.08,
  reproductive: 0.08,
  neurological: 0.07,
  psychiatry: 0.07,
  endocrine: 0.06,
  dermatology: 0.05,
  genitourinary: 0.05,
  hematology: 0.04,
  infectious_disease: 0.04,
  nephrology: 0.04,
  emergency_medicine: 0.02,
};

// Pass threshold (scaled score)
const PASS_SCORE = 350;

// Minimum questions for reliable prediction
const MIN_QUESTIONS_FOR_PREDICTION = 100;

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class PANCEScorePredictorService {
  /**
   * Calculate predicted PANCE score from performance data
   */
  static predictScore(
    performanceData: PerformanceDataPoint[],
    systemPerformance: SystemPerformance[]
  ): PredictedScore {
    // Need minimum questions for reliable prediction
    if (performanceData.length < MIN_QUESTIONS_FOR_PREDICTION) {
      return this.getInsufficientDataResponse(performanceData.length);
    }

    // Calculate weighted accuracy based on NCCPA blueprint
    const weightedAccuracy = this.calculateWeightedAccuracy(systemPerformance);

    // Calculate difficulty-adjusted performance
    const difficultyAdjusted = this.calculateDifficultyAdjustedPerformance(performanceData);

    // Calculate scaled score (200-800 scale)
    const rawScore = weightedAccuracy * 0.6 + difficultyAdjusted * 0.4;
    const scaledScore = Math.round(200 + rawScore * 600);

    // Calculate confidence interval based on sample size
    const standardError = this.calculateStandardError(performanceData.length, rawScore);
    const confidenceInterval = {
      lower: Math.round(Math.max(200, scaledScore - 1.96 * standardError * 600)),
      upper: Math.round(Math.min(800, scaledScore + 1.96 * standardError * 600)),
    };

    // Calculate pass likelihood using logistic function
    const passLikelihood = this.calculatePassLikelihood(scaledScore, confidenceInterval);

    // Determine readiness level
    const readinessLevel = this.determineReadinessLevel(passLikelihood);

    // Calculate projected pass date if not ready
    const projectedDate =
      passLikelihood < 80 ? this.projectPassDate(performanceData, passLikelihood) : null;

    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(systemPerformance);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      systemPerformance,
      weaknesses,
      passLikelihood
    );

    return {
      scaledScore,
      confidenceInterval,
      passLikelihood,
      readinessLevel,
      projectedDate,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  /**
   * Calculate weighted accuracy based on NCCPA blueprint
   */
  private static calculateWeightedAccuracy(systemPerformance: SystemPerformance[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const system of systemPerformance) {
      const weight = NCCPA_WEIGHTS[system.system.toLowerCase()] || 0.04;
      weightedSum += system.accuracy * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Adjust performance based on question difficulty
   */
  private static calculateDifficultyAdjustedPerformance(data: PerformanceDataPoint[]): number {
    // Group by difficulty bands
    const bands = {
      easy: data.filter((d) => d.difficulty <= 3),
      medium: data.filter((d) => d.difficulty > 3 && d.difficulty <= 7),
      hard: data.filter((d) => d.difficulty > 7),
    };

    const bandAccuracy = {
      easy: this.getAccuracy(bands.easy),
      medium: this.getAccuracy(bands.medium),
      hard: this.getAccuracy(bands.hard),
    };

    // Weight harder questions more heavily (reflects PANCE item pool)
    return bandAccuracy.easy * 0.2 + bandAccuracy.medium * 0.5 + bandAccuracy.hard * 0.3;
  }

  /**
   * Calculate accuracy for a set of data points
   */
  private static getAccuracy(data: PerformanceDataPoint[]): number {
    if (data.length === 0) return 0.5; // Default to 50% if no data
    const correct = data.filter((d) => d.isCorrect).length;
    return correct / data.length;
  }

  /**
   * Calculate standard error based on sample size
   */
  private static calculateStandardError(n: number, p: number): number {
    // Binomial standard error formula
    return Math.sqrt((p * (1 - p)) / n);
  }

  /**
   * Calculate pass likelihood using logistic function
   */
  private static calculatePassLikelihood(
    score: number,
    confidence: { lower: number; upper: number }
  ): number {
    // Logistic function centered at pass score
    const k = 0.02; // Steepness parameter
    const midpoint = PASS_SCORE;

    // Use lower confidence bound for conservative estimate
    const effectiveScore = (score + confidence.lower) / 2;

    const likelihood = 100 / (1 + Math.exp(-k * (effectiveScore - midpoint)));
    return Math.round(Math.max(0, Math.min(100, likelihood)));
  }

  /**
   * Determine readiness level based on pass likelihood
   */
  private static determineReadinessLevel(passLikelihood: number): PredictedScore['readinessLevel'] {
    if (passLikelihood >= 90) return 'confident_pass';
    if (passLikelihood >= 75) return 'likely_pass';
    if (passLikelihood >= 50) return 'borderline';
    return 'not_ready';
  }

  /**
   * Project date when user will reach 80% pass likelihood
   */
  private static projectPassDate(
    data: PerformanceDataPoint[],
    currentLikelihood: number
  ): Date | null {
    if (data.length < 50) return null;

    // Calculate learning rate from recent data
    const recentData = data.slice(-100);
    const firstHalf = recentData.slice(0, 50);
    const secondHalf = recentData.slice(50);

    const firstAccuracy = this.getAccuracy(firstHalf);
    const secondAccuracy = this.getAccuracy(secondHalf);

    const improvementRate = secondAccuracy - firstAccuracy;

    if (improvementRate <= 0) return null; // Not improving

    // Estimate questions needed to reach 80%
    const targetLikelihood = 80;
    const likelihoodGap = targetLikelihood - currentLikelihood;
    const questionsPerPercent = 10 / (improvementRate * 100);
    const questionsNeeded = likelihoodGap * questionsPerPercent;

    // Assume 20 questions per day average
    const daysNeeded = Math.ceil(questionsNeeded / 20);

    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysNeeded);

    return projectedDate;
  }

  /**
   * Identify strengths and weaknesses from system performance
   */
  private static identifyStrengthsWeaknesses(systemPerformance: SystemPerformance[]): {
    strengths: string[];
    weaknesses: string[];
  } {
    const sorted = [...systemPerformance].sort((a, b) => b.accuracy - a.accuracy);

    const strengths = sorted
      .filter((s) => s.accuracy >= 0.75 && s.totalQuestions >= 20)
      .slice(0, 3)
      .map((s) => s.system);

    const weaknesses = sorted
      .filter((s) => s.accuracy < 0.65 || s.totalQuestions < 20)
      .slice(-3)
      .reverse()
      .map((s) => s.system);

    return { strengths, weaknesses };
  }

  /**
   * Generate personalized study recommendations
   */
  private static generateRecommendations(
    systemPerformance: SystemPerformance[],
    weaknesses: string[],
    passLikelihood: number
  ): string[] {
    const recommendations: string[] = [];

    // Weakness-based recommendations
    for (const weakness of weaknesses.slice(0, 2)) {
      const system = systemPerformance.find((s) => s.system === weakness);
      if (system) {
        if (system.totalQuestions < 30) {
          recommendations.push(
            `Practice more ${weakness} questions (only ${system.totalQuestions} attempted)`
          );
        } else if (system.accuracy < 0.5) {
          recommendations.push(
            `Review ${weakness} fundamentals - accuracy is ${Math.round(system.accuracy * 100)}%`
          );
        } else {
          recommendations.push(
            `Focus on difficult ${weakness} cases to improve from ${Math.round(system.accuracy * 100)}%`
          );
        }
      }
    }

    // Coverage recommendations
    const lowCoverageSystems = systemPerformance
      .filter((s) => s.totalQuestions < 20)
      .map((s) => s.system);

    if (lowCoverageSystems.length > 0) {
      recommendations.push(`Increase coverage in: ${lowCoverageSystems.slice(0, 3).join(', ')}`);
    }

    // Readiness-based recommendations
    if (passLikelihood < 50) {
      recommendations.push('Consider reviewing comprehensive study materials');
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

  /**
   * Response when insufficient data is available
   */
  private static getInsufficientDataResponse(questionsAnswered: number): PredictedScore {
    return {
      scaledScore: 0,
      confidenceInterval: { lower: 0, upper: 0 },
      passLikelihood: 0,
      readinessLevel: 'not_ready',
      projectedDate: null,
      strengths: [],
      weaknesses: [],
      recommendations: [
        `Answer ${MIN_QUESTIONS_FOR_PREDICTION - questionsAnswered} more questions for a prediction`,
        'Focus on variety across all organ systems',
        'Complete at least 20 questions per major system',
      ],
    };
  }

  /**
   * Calculate percentile rank among cohort
   */
  static calculatePercentile(userScore: number, cohortScores: number[]): number {
    if (cohortScores.length === 0) return 50;

    const belowUser = cohortScores.filter((s) => s < userScore).length;
    return Math.round((belowUser / cohortScores.length) * 100);
  }

  /**
   * Get score trend from historical predictions
   */
  static getScoreTrend(history: HistoricalPrediction[]): {
    trend: 'up' | 'down' | 'stable';
    change: number;
  } {
    if (history.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const recent = history.slice(-5);
    const first = recent[0]!.predictedScore;
    const last = recent[recent.length - 1]!.predictedScore;
    const change = last - first;

    if (change > 10) return { trend: 'up', change };
    if (change < -10) return { trend: 'down', change };
    return { trend: 'stable', change };
  }
}

export default PANCEScorePredictorService;
