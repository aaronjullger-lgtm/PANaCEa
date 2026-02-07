/**
 * Adaptive Difficulty Service
 * 2026 PA Student Optimization - Priority 8
 * 
 * Maintains optimal challenge (70-85% accuracy) by dynamically adjusting
 * question difficulty during study sessions to keep students in "flow state"
 */

import type { PerformanceRecord, SystemCode } from '@/types';

// Flow state target: 70-85% accuracy
const TARGET_ACCURACY_MIN = 0.70;
const TARGET_ACCURACY_MAX = 0.85;
const OPTIMAL_ACCURACY = 0.77; // Sweet spot

// Rolling window for accuracy calculation
const ACCURACY_WINDOW_SIZE = 10; // Last 10 questions
const MIN_QUESTIONS_FOR_ADJUSTMENT = 3; // Wait for 3 questions before adjusting

export type DifficultyLevel = 'easier' | 'maintain' | 'harder';

export interface DifficultyRecommendation {
  level: DifficultyLevel;
  currentAccuracy: number;
  targetAccuracy: number;
  confidence: number; // 0-1, how confident we are in the recommendation
  reason: string;
  shouldAdjust: boolean;
}

export interface DifficultyContext {
  recentPerformance: PerformanceRecord[];
  systemFamiliarity?: Record<SystemCode, number>; // 0-1, how familiar user is with each system
  confidenceTrend?: 'increasing' | 'decreasing' | 'stable'; // From confidence ratings
  streakCount?: number; // Current correct answer streak
}

/**
 * Calculate rolling accuracy from recent performance
 */
function calculateRollingAccuracy(
  performance: PerformanceRecord[],
  windowSize: number = ACCURACY_WINDOW_SIZE
): number {
  if (performance.length === 0) return 0.75; // Default to mid-range
  
  const recentPerformance = performance.slice(-windowSize);
  const correctCount = recentPerformance.filter(p => p.isCorrect).length;
  
  return correctCount / recentPerformance.length;
}

/**
 * Analyze confidence trend to detect over/under confidence
 */
function analyzeConfidenceTrend(
  performance: PerformanceRecord[]
): 'increasing' | 'decreasing' | 'stable' {
  const recentWithConfidence = performance
    .slice(-ACCURACY_WINDOW_SIZE)
    .filter(p => p.confidenceLevel !== undefined);
  
  if (recentWithConfidence.length < 3) return 'stable';
  
  const firstHalf = recentWithConfidence.slice(0, Math.floor(recentWithConfidence.length / 2));
  const secondHalf = recentWithConfidence.slice(Math.floor(recentWithConfidence.length / 2));
  
  const avgFirst = firstHalf.reduce((sum, p) => sum + (p.confidenceLevel || 3), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, p) => sum + (p.confidenceLevel || 3), 0) / secondHalf.length;
  
  const diff = avgSecond - avgFirst;
  
  if (diff > 0.5) return 'increasing';
  if (diff < -0.5) return 'decreasing';
  return 'stable';
}

/**
 * Calculate confidence in the difficulty recommendation
 * Higher confidence = more data points, clearer trend
 */
function calculateRecommendationConfidence(
  performanceCount: number,
  accuracyDeviation: number
): number {
  // Confidence increases with more data points
  const dataConfidence = Math.min(performanceCount / ACCURACY_WINDOW_SIZE, 1.0);
  
  // Confidence increases with clearer deviation from target
  const deviationConfidence = Math.min(Math.abs(accuracyDeviation) / 0.15, 1.0);
  
  // Combined confidence (weighted average)
  return dataConfidence * 0.6 + deviationConfidence * 0.4;
}

/**
 * Get difficulty recommendation based on current performance
 * 
 * @param context - Performance data and user context
 * @returns Recommendation with level, accuracy stats, and reasoning
 */
export function getDifficultyRecommendation(
  context: DifficultyContext
): DifficultyRecommendation {
  const { recentPerformance, confidenceTrend, streakCount = 0 } = context;
  
  // Not enough data yet - maintain current difficulty
  if (recentPerformance.length < MIN_QUESTIONS_FOR_ADJUSTMENT) {
    return {
      level: 'maintain',
      currentAccuracy: calculateRollingAccuracy(recentPerformance),
      targetAccuracy: OPTIMAL_ACCURACY,
      confidence: 0,
      reason: 'Insufficient data - need at least 3 questions',
      shouldAdjust: false,
    };
  }
  
  const currentAccuracy = calculateRollingAccuracy(recentPerformance);
  const deviation = currentAccuracy - OPTIMAL_ACCURACY;
  const confidence = calculateRecommendationConfidence(
    recentPerformance.length,
    deviation
  );
  
  // User is crushing it (> 85%) - increase difficulty
  if (currentAccuracy > TARGET_ACCURACY_MAX) {
    // Check if high confidence too (not just lucky guesses)
    const trend = confidenceTrend || analyzeConfidenceTrend(recentPerformance);
    const isConfident = trend === 'increasing' || trend === 'stable';
    
    return {
      level: 'harder',
      currentAccuracy,
      targetAccuracy: OPTIMAL_ACCURACY,
      confidence: isConfident ? confidence : confidence * 0.7,
      reason: `Accuracy ${(currentAccuracy * 100).toFixed(0)}% is above target (85%). ${
        streakCount >= 5 ? `On ${streakCount}-question streak. ` : ''
      }Increasing challenge to maintain engagement.`,
      shouldAdjust: isConfident && confidence > 0.5,
    };
  }
  
  // User is struggling (< 70%) - decrease difficulty
  if (currentAccuracy < TARGET_ACCURACY_MIN) {
    // Check confidence - if user is overconfident despite low accuracy, maintain difficulty
    const trend = confidenceTrend || analyzeConfidenceTrend(recentPerformance);
    const isOverconfident = trend === 'increasing' && currentAccuracy < 0.6;
    
    if (isOverconfident) {
      return {
        level: 'maintain',
        currentAccuracy,
        targetAccuracy: OPTIMAL_ACCURACY,
        confidence: confidence * 0.5,
        reason: `Accuracy ${(currentAccuracy * 100).toFixed(0)}% is low but confidence is high. Maintaining difficulty to calibrate metacognition.`,
        shouldAdjust: false,
      };
    }
    
    return {
      level: 'easier',
      currentAccuracy,
      targetAccuracy: OPTIMAL_ACCURACY,
      confidence,
      reason: `Accuracy ${(currentAccuracy * 100).toFixed(0)}% is below target (70%). Reducing difficulty to build confidence and prevent burnout.`,
      shouldAdjust: confidence > 0.4,
    };
  }
  
  // User is in the sweet spot (70-85%) - maintain current difficulty
  return {
    level: 'maintain',
    currentAccuracy,
    targetAccuracy: OPTIMAL_ACCURACY,
    confidence,
    reason: `Accuracy ${(currentAccuracy * 100).toFixed(0)}% is in optimal range (70-85%). Flow state maintained.`,
    shouldAdjust: false,
  };
}

/**
 * Calculate system familiarity scores based on historical performance
 * Used to adjust difficulty per system
 */
export function calculateSystemFamiliarity(
  allPerformance: PerformanceRecord[]
): Record<string, number> {
  const systemStats: Record<string, { correct: number; total: number }> = {};
  
  // Aggregate performance by system
  for (const record of allPerformance) {
    const system = record.system || 'Unknown';
    if (!systemStats[system]) {
      systemStats[system] = { correct: 0, total: 0 };
    }
    
    systemStats[system].total++;
    if (record.isCorrect) {
      systemStats[system].correct++;
    }
  }
  
  // Convert to familiarity scores (0-1)
  const familiarity: Record<string, number> = {};
  for (const [system, stats] of Object.entries(systemStats)) {
    // Familiarity = accuracy * (1 - 1/sqrt(attempts))
    // This rewards both accuracy and experience
    const accuracy = stats.correct / stats.total;
    const experienceFactor = 1 - 1 / Math.sqrt(Math.max(stats.total, 1));
    familiarity[system] = accuracy * experienceFactor;
  }
  
  return familiarity;
}

/**
 * Adjust question pool filtering based on difficulty recommendation
 * Returns filter parameters for question service
 */
export function getDifficultyFilters(
  recommendation: DifficultyRecommendation
): {
  complexityMin?: number; // 0-1
  complexityMax?: number; // 0-1
  wordCountMin?: number;
  wordCountMax?: number;
  timeConstraintMultiplier?: number; // Adjust par time
} {
  if (!recommendation.shouldAdjust || recommendation.level === 'maintain') {
    return {}; // No filtering - standard PANCE-level questions
  }
  
  if (recommendation.level === 'harder') {
    return {
      complexityMin: 0.6, // High complexity only
      wordCountMin: 100, // Longer vignettes
      timeConstraintMultiplier: 0.9, // 10% less time (more pressure)
    };
  }
  
  // Easier
  return {
    complexityMax: 0.5, // Lower complexity
    wordCountMax: 150, // Shorter vignettes
    timeConstraintMultiplier: 1.2, // 20% more time
  };
}

/**
 * Get user-friendly feedback message for difficulty adjustment
 */
export function getDifficultyFeedbackMessage(
  recommendation: DifficultyRecommendation
): string | null {
  if (!recommendation.shouldAdjust) return null;
  
  if (recommendation.level === 'harder') {
    return `🎯 Great job! You're crushing it at ${(recommendation.currentAccuracy * 100).toFixed(0)}% accuracy. Increasing challenge to keep you engaged.`;
  }
  
  if (recommendation.level === 'easier') {
    return `💪 Adjusting difficulty to help you build confidence. You've got this!`;
  }
  
  return null;
}

/**
 * Track difficulty adjustments for analytics
 */
export interface DifficultyAdjustmentEvent {
  timestamp: number;
  fromLevel: string;
  toLevel: string;
  accuracy: number;
  confidence: number;
  reason: string;
}

const DIFFICULTY_ADJUSTMENT_KEY = 'panacea_difficulty_adjustments';

export function logDifficultyAdjustment(event: DifficultyAdjustmentEvent): void {
  try {
    if (typeof window === 'undefined') return;
    
    const stored = localStorage.getItem(DIFFICULTY_ADJUSTMENT_KEY);
    const events: DifficultyAdjustmentEvent[] = stored ? JSON.parse(stored) : [];
    
    events.push(event);
    
    // Keep last 50 events
    const trimmed = events.slice(-50);
    localStorage.setItem(DIFFICULTY_ADJUSTMENT_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[AdaptiveDifficulty] Failed to log adjustment:', error);
  }
}

export function getDifficultyAdjustmentHistory(): DifficultyAdjustmentEvent[] {
  try {
    if (typeof window === 'undefined') return [];
    
    const stored = localStorage.getItem(DIFFICULTY_ADJUSTMENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[AdaptiveDifficulty] Failed to load history:', error);
    return [];
  }
}
