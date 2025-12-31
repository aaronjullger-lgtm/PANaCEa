/**
 * Behavioral Confidence Inference Service
 * 
 * Automatically infers user confidence from behavioral signals:
 * - Time spent on question (relative to par time)
 * - Number of answer changes
 * - Use of elimination feature
 * - Hesitation patterns
 * 
 * This removes the need for explicit confidence input while still
 * capturing valuable calibration data for learning analytics.
 */

export type InferredConfidence = 'high' | 'medium' | 'low';

export interface BehaviorSignals {
  /** Time spent on question in ms */
  timeSpentMs: number;
  /** Expected time for this question complexity in ms */
  parTimeMs: number;
  /** Number of times user changed their answer */
  answerChangeCount: number;
  /** Number of answers eliminated using the elimination feature */
  eliminatedCount: number;
  /** Whether user selected answer quickly then waited vs deliberated */
  quickInitialSelection: boolean;
}

export interface InferredConfidenceResult {
  confidence: InferredConfidence;
  score: number; // 0-100, higher = more confident behavior
  signals: {
    timeSignal: 'fast' | 'normal' | 'slow';
    changedAnswer: boolean;
    usedElimination: boolean;
  };
}

/**
 * Infer confidence level from behavioral signals
 * No explicit user input required
 */
export function inferConfidence(signals: BehaviorSignals): InferredConfidenceResult {
  let score = 50; // Start neutral
  
  const timeRatio = signals.timeSpentMs / signals.parTimeMs;
  
  // Time signal analysis
  let timeSignal: 'fast' | 'normal' | 'slow' = 'normal';
  if (timeRatio < 0.5) {
    // Very fast answer - could indicate high confidence OR rushing/guessing
    // We'll lean toward high confidence but cap the bonus
    score += 15;
    timeSignal = 'fast';
  } else if (timeRatio < 0.8) {
    // Slightly fast - good confidence
    score += 10;
    timeSignal = 'fast';
  } else if (timeRatio > 2.0) {
    // Very slow - struggling or uncertain
    score -= 20;
    timeSignal = 'slow';
  } else if (timeRatio > 1.3) {
    // Somewhat slow - some uncertainty
    score -= 10;
    timeSignal = 'slow';
  }
  
  // Answer changes indicate uncertainty
  if (signals.answerChangeCount > 0) {
    score -= 15 * Math.min(signals.answerChangeCount, 3);
  }
  
  // Elimination usage indicates methodical approach but also uncertainty
  // Using elimination is smart test-taking, but suggests not immediately certain
  if (signals.eliminatedCount > 0) {
    score -= 5 * Math.min(signals.eliminatedCount, 2);
  }
  
  // Quick initial selection with no changes = high confidence behavior
  if (signals.quickInitialSelection && signals.answerChangeCount === 0) {
    score += 10;
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine confidence level
  let confidence: InferredConfidence;
  if (score >= 65) {
    confidence = 'high';
  } else if (score >= 35) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    confidence,
    score,
    signals: {
      timeSignal,
      changedAnswer: signals.answerChangeCount > 0,
      usedElimination: signals.eliminatedCount > 0,
    },
  };
}

/**
 * Behavioral Confidence Record for analytics
 */
export interface BehavioralConfidenceRecord {
  inferredConfidence: InferredConfidence;
  confidenceScore: number;
  wasCorrect: boolean;
  timeSpentMs: number;
  parTimeMs: number;
  answerChangeCount: number;
  eliminatedCount: number;
  timestamp: number;
}

// Storage key
const STORAGE_KEY = 'panceai_behavioral_confidence';

/**
 * Get all behavioral confidence records from session
 */
export function getBehavioralRecords(): BehavioralConfidenceRecord[] {
  if (typeof window === 'undefined') return [];
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Record a behavioral confidence data point
 */
export function recordBehavioralConfidence(
  signals: BehaviorSignals,
  wasCorrect: boolean
): BehavioralConfidenceRecord {
  const result = inferConfidence(signals);
  
  const record: BehavioralConfidenceRecord = {
    inferredConfidence: result.confidence,
    confidenceScore: result.score,
    wasCorrect,
    timeSpentMs: signals.timeSpentMs,
    parTimeMs: signals.parTimeMs,
    answerChangeCount: signals.answerChangeCount,
    eliminatedCount: signals.eliminatedCount,
    timestamp: Date.now(),
  };
  
  // Store in session
  const records = getBehavioralRecords();
  records.push(record);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  
  return record;
}

/**
 * Calculate behavioral calibration stats
 * How well does inferred confidence correlate with actual performance?
 */
export function calculateBehavioralCalibration(): {
  high: { correct: number; total: number; accuracy: number | null };
  medium: { correct: number; total: number; accuracy: number | null };
  low: { correct: number; total: number; accuracy: number | null };
  calibrationScore: number | null;
  insights: string[];
} {
  const records = getBehavioralRecords();
  
  const stats = {
    high: { correct: 0, total: 0, accuracy: null as number | null },
    medium: { correct: 0, total: 0, accuracy: null as number | null },
    low: { correct: 0, total: 0, accuracy: null as number | null },
  };
  
  records.forEach(r => {
    stats[r.inferredConfidence].total++;
    if (r.wasCorrect) stats[r.inferredConfidence].correct++;
  });
  
  // Calculate accuracies
  for (const level of ['high', 'medium', 'low'] as const) {
    if (stats[level].total >= 3) {
      stats[level].accuracy = Math.round(
        (stats[level].correct / stats[level].total) * 100
      );
    }
  }
  
  // Calculate calibration score
  // Well-calibrated: high confidence → high accuracy, low confidence → lower accuracy
  const insights: string[] = [];
  let calibrationScore: number | null = null;
  
  if (records.length >= 10) {
    let score = 50;
    
    // High confidence should have high accuracy (>75%)
    if (stats.high.accuracy !== null) {
      if (stats.high.accuracy >= 80) {
        score += 20;
        insights.push('Your quick, confident answers are usually correct');
      } else if (stats.high.accuracy < 60) {
        score -= 20;
        insights.push('Consider slowing down - quick answers are often wrong');
      }
    }
    
    // Low confidence having decent accuracy = underconfidence
    if (stats.low.accuracy !== null && stats.low.accuracy >= 60) {
      score += 10;
      insights.push('Trust yourself more - you know more than you think');
    }
    
    // Answer changes with low accuracy = need to trust first instinct
    const changedRecords = records.filter(r => r.answerChangeCount > 0);
    if (changedRecords.length >= 5) {
      const changedAccuracy = changedRecords.filter(r => r.wasCorrect).length / changedRecords.length;
      if (changedAccuracy < 0.5) {
        insights.push('When you change answers, you often change to wrong ones');
      }
    }
    
    calibrationScore = Math.max(0, Math.min(100, score));
  }
  
  return {
    ...stats,
    calibrationScore,
    insights,
  };
}

/**
 * Reset behavioral confidence records
 */
export function resetBehavioralRecords(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Get comprehensive behavioral insights for session analytics
 */
export function getBehavioralInsights(): {
  avgConfidence: number | null;
  rushingTendency: number | null;
  rushingAccuracy: number | null;
  deliberateAccuracy: number | null;
  early10Accuracy: number | null;
  late10Accuracy: number | null;
  staminaFade: number | null;
} | null {
  const records = getBehavioralRecords();
  
  if (records.length < 5) return null;
  
  // Average confidence score
  const avgConfidence = records.reduce((sum, r) => sum + r.confidenceScore, 0) / records.length;
  
  // Rushing tendency (how often under 60% of par)
  const rushingRecords = records.filter(r => r.timeSpentMs < r.parTimeMs * 0.6);
  const rushingTendency = rushingRecords.length / records.length;
  
  // Accuracy when rushing
  const rushingAccuracy = rushingRecords.length >= 3
    ? (rushingRecords.filter(r => r.wasCorrect).length / rushingRecords.length) * 100
    : null;
  
  // Accuracy when deliberate (over par)
  const deliberateRecords = records.filter(r => r.timeSpentMs > r.parTimeMs);
  const deliberateAccuracy = deliberateRecords.length >= 3
    ? (deliberateRecords.filter(r => r.wasCorrect).length / deliberateRecords.length) * 100
    : null;
  
  // Stamina/fatigue analysis
  let early10Accuracy: number | null = null;
  let late10Accuracy: number | null = null;
  let staminaFade: number | null = null;
  
  if (records.length >= 20) {
    const early10 = records.slice(0, 10);
    const late10 = records.slice(-10);
    
    early10Accuracy = (early10.filter(r => r.wasCorrect).length / 10) * 100;
    late10Accuracy = (late10.filter(r => r.wasCorrect).length / 10) * 100;
    staminaFade = late10Accuracy - early10Accuracy; // Negative = fatigue
  }
  
  return {
    avgConfidence,
    rushingTendency,
    rushingAccuracy,
    deliberateAccuracy,
    early10Accuracy,
    late10Accuracy,
    staminaFade,
  };
}
