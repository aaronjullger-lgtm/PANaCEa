/**
 * Statistical Analysis Utility
 * 
 * Provides comprehensive statistical calculations for learning analytics:
 * - Confidence intervals
 * - Standard deviation
 * - Learning velocity (improvement rate)
 * - Trend analysis
 * - Statistical significance testing
 * 
 * @module lib/utils/statisticalAnalysis
 */

export interface StatisticalSummary {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  count: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
  marginOfError: number;
}

export interface TrendAnalysis {
  slope: number;
  direction: 'improving' | 'declining' | 'stable';
  rSquared: number;
  predictedNext: number;
  velocityPerDay: number;
}

export interface PerformanceComparison {
  difference: number;
  percentChange: number;
  isSignificant: boolean;
  pValue: number;
  effectSize: number;
}

/**
 * Calculate basic statistical summary for an array of numbers
 */
export function calculateStatistics(data: number[]): StatisticalSummary {
  if (data.length === 0) {
    return {
      mean: 0,
      median: 0,
      standardDeviation: 0,
      variance: 0,
      min: 0,
      max: 0,
      range: 0,
      count: 0,
    };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  
  // Mean
  const mean = data.reduce((sum, val) => sum + val, 0) / n;
  
  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  // Variance and Standard Deviation
  const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / n;
  const standardDeviation = Math.sqrt(variance);
  
  // Min, Max, Range
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  return {
    mean,
    median,
    standardDeviation,
    variance,
    min,
    max,
    range,
    count: n,
  };
}

/**
 * Calculate confidence interval for a sample proportion (e.g., accuracy rate)
 * Uses Wilson score interval for small samples
 */
export function calculateConfidenceInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (total === 0) {
    return { lower: 0, upper: 0, confidenceLevel, marginOfError: 0 };
  }

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const z = zScores[confidenceLevel] || 1.96;
  
  const p = successes / total;
  const n = total;
  
  // Wilson score interval (more accurate for small samples)
  const denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const adjustment = z / denominator * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  
  const lower = Math.max(0, center - adjustment);
  const upper = Math.min(1, center + adjustment);
  const marginOfError = (upper - lower) / 2;

  return {
    lower: Math.round(lower * 1000) / 10, // Convert to percentage with 1 decimal
    upper: Math.round(upper * 1000) / 10,
    confidenceLevel,
    marginOfError: Math.round(marginOfError * 1000) / 10,
  };
}

/**
 * Calculate learning velocity and trend from historical performance data
 * Uses linear regression to determine improvement rate
 */
export function analyzeTrend(
  dataPoints: { timestamp: Date | number; value: number }[]
): TrendAnalysis {
  if (dataPoints.length < 2) {
    return {
      slope: 0,
      direction: 'stable',
      rSquared: 0,
      predictedNext: dataPoints[0]?.value || 0,
      velocityPerDay: 0,
    };
  }

  // Convert timestamps to days from first data point
  const firstTimestamp = typeof dataPoints[0].timestamp === 'number' 
    ? dataPoints[0].timestamp 
    : dataPoints[0].timestamp.getTime();
  
  const normalizedData = dataPoints.map(d => ({
    x: ((typeof d.timestamp === 'number' ? d.timestamp : d.timestamp.getTime()) - firstTimestamp) / (1000 * 60 * 60 * 24),
    y: d.value,
  }));

  // Linear regression
  const n = normalizedData.length;
  const sumX = normalizedData.reduce((sum, d) => sum + d.x, 0);
  const sumY = normalizedData.reduce((sum, d) => sum + d.y, 0);
  const sumXY = normalizedData.reduce((sum, d) => sum + d.x * d.y, 0);
  const sumXX = normalizedData.reduce((sum, d) => sum + d.x * d.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared calculation
  const meanY = sumY / n;
  const ssTotal = normalizedData.reduce((sum, d) => sum + Math.pow(d.y - meanY, 2), 0);
  const ssResidual = normalizedData.reduce((sum, d) => {
    const predicted = slope * d.x + intercept;
    return sum + Math.pow(d.y - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  // Determine direction
  let direction: 'improving' | 'declining' | 'stable';
  if (Math.abs(slope) < 0.5) {
    direction = 'stable';
  } else if (slope > 0) {
    direction = 'improving';
  } else {
    direction = 'declining';
  }

  // Predict next value (1 day after last data point)
  const lastX = normalizedData[normalizedData.length - 1].x;
  const predictedNext = slope * (lastX + 1) + intercept;

  return {
    slope: Math.round(slope * 100) / 100,
    direction,
    rSquared: Math.round(rSquared * 100) / 100,
    predictedNext: Math.round(predictedNext * 10) / 10,
    velocityPerDay: Math.round(slope * 100) / 100, // Change per day
  };
}

/**
 * Compare two performance periods to detect significant improvement
 * Uses two-proportion z-test
 */
export function comparePerformance(
  period1: { successes: number; total: number },
  period2: { successes: number; total: number }
): PerformanceComparison {
  const p1 = period1.total > 0 ? period1.successes / period1.total : 0;
  const p2 = period2.total > 0 ? period2.successes / period2.total : 0;
  
  const difference = p2 - p1;
  const percentChange = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;
  
  // Two-proportion z-test
  const pooledP = (period1.successes + period2.successes) / (period1.total + period2.total);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / period1.total + 1 / period2.total));
  
  const zScore = se > 0 ? Math.abs(difference) / se : 0;
  
  // Approximate p-value from z-score
  const pValue = 2 * (1 - normalCDF(zScore));
  
  // Effect size (Cohen's h for proportions)
  const effectSize = Math.abs(2 * Math.asin(Math.sqrt(p2)) - 2 * Math.asin(Math.sqrt(p1)));

  return {
    difference: Math.round(difference * 1000) / 10, // Percentage difference
    percentChange: Math.round(percentChange * 10) / 10,
    isSignificant: pValue < 0.05,
    pValue: Math.round(pValue * 1000) / 1000,
    effectSize: Math.round(effectSize * 100) / 100,
  };
}

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate moving average for smoothing time series data
 */
export function calculateMovingAverage(
  data: number[],
  windowSize: number = 5
): number[] {
  if (data.length < windowSize) {
    return data;
  }

  const result: number[] = [];
  for (let i = 0; i <= data.length - windowSize; i++) {
    const window = data.slice(i, i + windowSize);
    const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
    result.push(Math.round(avg * 10) / 10);
  }
  return result;
}

/**
 * Detect performance plateaus (periods of no significant improvement)
 */
export function detectPlateau(
  dataPoints: { timestamp: Date | number; value: number }[],
  thresholdPercent: number = 2,
  minDays: number = 7
): { isPlateau: boolean; daysSincePlateau: number; plateauValue: number } {
  if (dataPoints.length < 3) {
    return { isPlateau: false, daysSincePlateau: 0, plateauValue: 0 };
  }

  // Check recent data points
  const recentPoints = dataPoints.slice(-10);
  const stats = calculateStatistics(recentPoints.map(d => d.value));
  
  // Calculate coefficient of variation (relative standard deviation)
  const cv = stats.mean > 0 ? (stats.standardDeviation / stats.mean) * 100 : 0;
  
  const isPlateau = cv < thresholdPercent;
  
  // Calculate how long the plateau has been going
  let daysSincePlateau = 0;
  if (isPlateau && recentPoints.length >= 2) {
    const firstPoint = recentPoints[0].timestamp;
    const lastPoint = recentPoints[recentPoints.length - 1].timestamp;
    const firstTs = typeof firstPoint === 'number' ? firstPoint : (firstPoint as Date).getTime();
    const lastTs = typeof lastPoint === 'number' ? lastPoint : (lastPoint as Date).getTime();
    daysSincePlateau = Math.round((lastTs - firstTs) / (1000 * 60 * 60 * 24));
  }

  return {
    isPlateau,
    daysSincePlateau,
    plateauValue: Math.round(stats.mean * 10) / 10,
  };
}

/**
 * Generate learning insights based on statistical analysis
 */
export function generateLearningInsights(
  accuracyHistory: { timestamp: Date; value: number }[],
  currentAccuracy: number,
  totalQuestions: number
): string[] {
  const insights: string[] = [];
  
  // Confidence interval insight
  const ci = calculateConfidenceInterval(
    Math.round(currentAccuracy * totalQuestions / 100),
    totalQuestions
  );
  if (totalQuestions >= 10) {
    insights.push(
      `Your true ability is likely between ${ci.lower.toFixed(1)}% and ${ci.upper.toFixed(1)}% (95% confidence).`
    );
  }
  
  // Trend analysis
  if (accuracyHistory.length >= 5) {
    const trend = analyzeTrend(accuracyHistory);
    if (trend.direction === 'improving' && trend.rSquared > 0.5) {
      insights.push(
        `Strong improvement trend! You're gaining approximately ${Math.abs(trend.velocityPerDay).toFixed(1)} percentage points per day.`
      );
    } else if (trend.direction === 'declining' && trend.rSquared > 0.5) {
      insights.push(
        `Performance has been declining. Consider reviewing fundamentals or adjusting your study strategy.`
      );
    }
    
    // Plateau detection
    const plateau = detectPlateau(accuracyHistory);
    if (plateau.isPlateau && plateau.daysSincePlateau > 7) {
      insights.push(
        `You've plateaued at around ${plateau.plateauValue}% for ${plateau.daysSincePlateau} days. Try varying your study approach.`
      );
    }
  }
  
  // Sample size warning
  if (totalQuestions < 30) {
    insights.push(
      `With only ${totalQuestions} questions, results may vary significantly. Complete at least 50 for stable metrics.`
    );
  }
  
  return insights;
}

/**
 * Calculate predicted PANCE score based on current performance
 * Uses scaled scoring similar to NCCPA methodology
 */
export function predictPANCEScore(
  accuracy: number,
  totalQuestions: number,
  difficultyLevel: 'easy' | 'medium' | 'hard' = 'medium'
): { predictedScore: number; range: { min: number; max: number }; passLikelihood: string } {
  // PANCE uses scaled scores from 200-800, passing is typically 350-400
  const baseScore = 500;
  const maxDeviation = 300;
  
  // Difficulty adjustment
  const difficultyMultiplier = {
    easy: 0.85,
    medium: 1.0,
    hard: 1.15,
  };
  
  const adjustedAccuracy = accuracy * difficultyMultiplier[difficultyLevel];
  
  // Convert accuracy to scaled score
  // 50% accuracy ≈ 350 (borderline pass)
  // 75% accuracy ≈ 500 (average)
  // 90%+ accuracy ≈ 650+ (high pass)
  const normalizedAccuracy = (adjustedAccuracy - 50) / 50; // -1 to 1 scale
  const predictedScore = Math.round(baseScore + normalizedAccuracy * maxDeviation);
  
  // Calculate confidence range based on sample size
  const ci = calculateConfidenceInterval(
    Math.round(accuracy * totalQuestions / 100),
    totalQuestions
  );
  const rangeMultiplier = maxDeviation / 50; // Scale CI to score range
  
  const min = Math.max(200, Math.round(predictedScore - ci.marginOfError * rangeMultiplier));
  const max = Math.min(800, Math.round(predictedScore + ci.marginOfError * rangeMultiplier));
  
  // Pass likelihood
  let passLikelihood: string;
  if (min >= 400) {
    passLikelihood = 'Very likely to pass';
  } else if (predictedScore >= 400 && min >= 350) {
    passLikelihood = 'Likely to pass';
  } else if (predictedScore >= 350) {
    passLikelihood = 'Borderline - continue studying';
  } else {
    passLikelihood = 'More preparation needed';
  }

  return {
    predictedScore: Math.max(200, Math.min(800, predictedScore)),
    range: { min, max },
    passLikelihood,
  };
}
