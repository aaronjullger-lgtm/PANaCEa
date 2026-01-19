/**
 * Performance Prediction Service
 *
 * Predicts likely PANCE score based on session performance patterns.
 * Uses multiple factors:
 * - Overall accuracy
 * - Performance under time pressure
 * - Consistency across systems
 * - Improvement trends
 */

export interface PredictionResult {
  predictedScore: number; // 200-800 scale (PANCE uses scaled scoring)
  confidence: 'low' | 'medium' | 'high';
  passLikelihood: number; // 0-100%
  strengths: string[];
  riskFactors: string[];
  recommendations: string[];
}

export interface PerformanceSnapshot {
  system: string;
  accuracy: number;
  totalQuestions: number;
  avgTimeMs: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Calculate predicted PANCE score from session data
 */
export function predictPANCEScore(
  overallAccuracy: number,
  totalQuestions: number,
  systemPerformance: PerformanceSnapshot[],
  avgTimePerQuestion: number,
  streakData: { maxStreak: number; avgStreak: number }
): PredictionResult {
  const strengths: string[] = [];
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // Base score calculation (accuracy is primary factor)
  // PANCE passing is typically ~60-65% accuracy
  // Scale: 200-800, passing ~450
  const baseScore = 200 + (overallAccuracy / 100) * 600;

  // Confidence based on sample size
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (totalQuestions >= 50) confidence = 'high';
  else if (totalQuestions >= 20) confidence = 'medium';

  // Adjustments based on various factors
  let adjustments = 0;

  // 1. System consistency bonus/penalty
  if (systemPerformance.length >= 3) {
    const accuracies = systemPerformance.map((s) => s.accuracy);
    const variance = calculateVariance(accuracies);

    if (variance < 100) {
      adjustments += 15;
      strengths.push('Consistent performance across systems');
    } else if (variance > 400) {
      adjustments -= 20;
      riskFactors.push('Inconsistent performance - some systems much weaker');

      // Find weakest systems
      const weakSystems = systemPerformance
        .filter((s) => s.accuracy < 60 && s.totalQuestions >= 3)
        .map((s) => s.system);
      if (weakSystems.length > 0) {
        recommendations.push(`Focus review on: ${weakSystems.slice(0, 3).join(', ')}`);
      }
    }
  }

  // 2. Time management
  const idealTimeMs = 72000; // 72 seconds per question (PANCE timing)
  if (avgTimePerQuestion < idealTimeMs * 0.8) {
    // Answering quickly - check if accuracy suffers
    if (overallAccuracy >= 70) {
      adjustments += 10;
      strengths.push('Efficient time management with maintained accuracy');
    } else {
      adjustments -= 10;
      riskFactors.push('May be rushing - consider slowing down');
      recommendations.push('Take more time on complex questions');
    }
  } else if (avgTimePerQuestion > idealTimeMs * 1.5) {
    adjustments -= 10;
    riskFactors.push('Time management concern - may run out of time on real exam');
    recommendations.push('Practice answering within 60-90 seconds');
  }

  // 3. Streak patterns (consistency)
  if (streakData.maxStreak >= 10) {
    adjustments += 10;
    strengths.push('Strong sustained focus shown by long streaks');
  }
  if (streakData.avgStreak < 2 && totalQuestions >= 20) {
    adjustments -= 10;
    riskFactors.push('Frequent errors break concentration');
  }

  // 4. Improvement trends
  const improvingSystems = systemPerformance.filter((s) => s.trend === 'improving').length;
  const decliningSystems = systemPerformance.filter((s) => s.trend === 'declining').length;

  if (improvingSystems > decliningSystems) {
    adjustments += 5;
    strengths.push('Showing improvement over the session');
  } else if (decliningSystems > improvingSystems && systemPerformance.length >= 3) {
    adjustments -= 10;
    riskFactors.push('Performance declining - possible fatigue');
    recommendations.push('Consider shorter, more frequent study sessions');
  }

  // 5. High-yield system performance (Cardio, Pulm, GI are heavily weighted)
  const highYieldSystems = ['CARD', 'PULM', 'GI', 'NEURO'];
  const highYieldPerf = systemPerformance.filter((s) =>
    highYieldSystems.some((hy) => s.system.toUpperCase().includes(hy))
  );

  if (highYieldPerf.length > 0) {
    const highYieldAvg = highYieldPerf.reduce((s, p) => s + p.accuracy, 0) / highYieldPerf.length;
    if (highYieldAvg >= 75) {
      adjustments += 15;
      strengths.push('Strong in high-yield PANCE systems');
    } else if (highYieldAvg < 60) {
      adjustments -= 15;
      riskFactors.push('Needs improvement in heavily-tested systems');
      recommendations.push('Prioritize Cardiology, Pulmonology, GI, and Neurology');
    }
  }

  // Apply adjustments
  const finalScore = Math.max(200, Math.min(800, Math.round(baseScore + adjustments)));

  // Calculate pass likelihood
  // PANCE passing score is typically around 450 (scaled)
  const passingThreshold = 450;
  let passLikelihood: number;

  if (finalScore >= passingThreshold + 100) {
    passLikelihood = 95;
  } else if (finalScore >= passingThreshold + 50) {
    passLikelihood = 85;
  } else if (finalScore >= passingThreshold) {
    passLikelihood = 70;
  } else if (finalScore >= passingThreshold - 50) {
    passLikelihood = 50;
  } else if (finalScore >= passingThreshold - 100) {
    passLikelihood = 30;
  } else {
    passLikelihood = 15;
  }

  // Add general recommendations based on score
  if (finalScore < 400 && recommendations.length < 3) {
    recommendations.push('Focus on foundational concepts before moving to advanced topics');
  }
  if (passLikelihood < 70 && recommendations.length < 3) {
    recommendations.push('Consider more practice questions and content review');
  }

  return {
    predictedScore: finalScore,
    confidence,
    passLikelihood,
    strengths: strengths.slice(0, 4),
    riskFactors: riskFactors.slice(0, 4),
    recommendations: recommendations.slice(0, 3),
  };
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((s, n) => s + n, 0) / numbers.length;
  return numbers.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / numbers.length;
}

/**
 * Get performance trend from recent data
 */
export function calculateTrend(recentAccuracies: number[]): 'improving' | 'stable' | 'declining' {
  if (recentAccuracies.length < 3) return 'stable';

  const firstHalf = recentAccuracies.slice(0, Math.floor(recentAccuracies.length / 2));
  const secondHalf = recentAccuracies.slice(Math.floor(recentAccuracies.length / 2));

  const firstAvg = firstHalf.reduce((s, n) => s + n, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, n) => s + n, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;

  if (diff > 10) return 'improving';
  if (diff < -10) return 'declining';
  return 'stable';
}

// ============================================
// Session-scoped prediction tracking
// ============================================

const STORAGE_KEY = 'panceai_session_prediction';

interface SessionPredictionData {
  results: Array<{
    correct: boolean;
    timeSpentMs: number;
    parTimeMs: number;
    system?: string;
    questionNumber: number;
    inferredConfidence: number;
  }>;
  lastUpdated: number;
}

function getSessionData(): SessionPredictionData {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error(error);
  }
  return { results: [], lastUpdated: Date.now() };
}

function saveSessionData(data: SessionPredictionData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error(error);
  }
}

/**
 * Record a question result for prediction tracking
 */
export function updatePerformancePrediction(result: {
  correct: boolean;
  timeSpentMs: number;
  parTimeMs: number;
  system?: string;
  questionNumber: number;
  inferredConfidence: number;
}): void {
  const data = getSessionData();
  data.results.push(result);
  data.lastUpdated = Date.now();
  saveSessionData(data);
}

/**
 * Get current session prediction
 */
export function getPrediction(): PredictionResult | null {
  const data = getSessionData();
  if (data.results.length < 5) return null;

  const overallAccuracy =
    (data.results.filter((r) => r.correct).length / data.results.length) * 100;

  // Build system performance data
  const systemStats: Record<string, { correct: number; total: number; times: number[] }> = {};
  for (const r of data.results) {
    const sys = r.system || 'GENERAL';
    if (!systemStats[sys]) {
      systemStats[sys] = { correct: 0, total: 0, times: [] };
    }
    systemStats[sys].total++;
    if (r.correct) systemStats[sys].correct++;
    systemStats[sys].times.push(r.timeSpentMs);
  }

  const systemPerformance: PerformanceSnapshot[] = Object.entries(systemStats).map(
    ([system, stats]) => ({
      system,
      accuracy: (stats.correct / stats.total) * 100,
      totalQuestions: stats.total,
      avgTimeMs: stats.times.reduce((s, t) => s + t, 0) / stats.times.length,
      trend: 'stable' as const,
    })
  );

  // Calculate streaks
  let maxStreak = 0;
  let currentStreak = 0;
  let totalStreaks = 0;
  let streakCount = 0;

  for (const r of data.results) {
    if (r.correct) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      if (currentStreak > 0) {
        totalStreaks += currentStreak;
        streakCount++;
      }
      currentStreak = 0;
    }
  }
  if (currentStreak > 0) {
    totalStreaks += currentStreak;
    streakCount++;
  }

  const avgStreak = streakCount > 0 ? totalStreaks / streakCount : 0;
  const avgTime = data.results.reduce((s, r) => s + r.timeSpentMs, 0) / data.results.length;

  return predictPANCEScore(overallAccuracy, data.results.length, systemPerformance, avgTime, {
    maxStreak,
    avgStreak,
  });
}

/**
 * Get confidence interval for prediction
 */
export function getConfidenceInterval(): { lower: number; upper: number } | null {
  const prediction = getPrediction();
  if (!prediction) return null;

  // Wider interval for lower confidence
  const margin =
    prediction.confidence === 'high' ? 30 : prediction.confidence === 'medium' ? 50 : 80;

  return {
    lower: Math.max(200, prediction.predictedScore - margin),
    upper: Math.min(800, prediction.predictedScore + margin),
  };
}

/**
 * Reset session prediction data
 */
export function resetPrediction(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error(error);
  }
}
