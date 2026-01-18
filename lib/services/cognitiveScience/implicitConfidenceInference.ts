/**
 * Implicit Confidence Inference System
 *
 * Automatically infers FSRS ratings (Again, Hard, Good, Easy) from behavioral signals
 * WITHOUT requiring any user self-assessment. This eliminates the cognitive overhead
 * of rating confidence and removes the bias of subjective self-reporting.
 *
 * ## Research Foundation
 *
 * ### Response Time Analysis (Metcalfe & Kornell, 2003)
 * - Fast correct answers indicate strong memory traces
 * - Slow correct answers indicate effortful retrieval (desirable difficulty)
 * - Very slow answers may indicate uncertainty or confusion
 *
 * ### Answer Revision Patterns (Koriat & Goldsmith, 1996)
 * - Answer changes from wrong→right indicate partial knowledge
 * - Answer changes from right→wrong indicate uncertainty
 * - Stable first answers indicate stronger confidence
 *
 * ### Hesitation Patterns (Nelson & Narens, 1990)
 * - Pauses before answering correlate with metacognitive uncertainty
 * - Time spent reviewing options indicates difficulty level
 *
 * ### Forgetting Curve Prediction (Ebbinghaus, 1885; Wozniak, 1995)
 * - Historical performance predicts future forgetting
 * - Spacing effects modify retention curves
 *
 * @module lib/services/cognitiveScience/implicitConfidenceInference
 */

import { Rating, State } from '../../fsrs';

export interface BehavioralSignals {
  // Timing signals
  responseTimeMs: number;
  timeToFirstInteraction: number; // Time before clicking anything
  timeBetweenClicks: number[]; // Array of intervals between clicks
  totalSessionTimeMs: number;

  // Answer behavior
  isCorrect: boolean;
  answerChanged: boolean;
  numberOfAnswerChanges: number;
  finalAnswerWasFirstChoice: boolean;
  timeSpentOnEachOption?: number[]; // Time hovering/viewing each option

  // Session context
  questionNumber: number; // Position in session
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  sessionAccuracySoFar: number;

  // Historical context (from database)
  previousAttempts: number;
  previousCorrectRate: number;
  averageResponseTimeForItem: number;
  daysSinceLastReview: number;
  currentStability: number;
  currentDifficulty: number;
}

export interface InferredRating {
  rating: Rating; // 1-4 (Again, Hard, Good, Easy)
  confidence: number; // How confident we are in this inference (0-1)
  signals: {
    name: string;
    weight: number;
    value: number;
    contribution: number;
  }[];
  explanation: string;
  recommendedStabilityMultiplier: number;
  recommendedDifficultyAdjustment: number;
}

export interface PerformanceProfile {
  baselineResponseTime: number; // User's typical response time
  responseTimeVariance: number;
  accuracyByTimeOfDay: Record<string, number>;
  accuracyBySessionPosition: number[];
  fatigueThreshold: number; // Questions before fatigue impacts performance
  optimalDifficulty: number;
  learningVelocity: number;
}

/**
 * Calculate normalized response time relative to baseline
 * Uses z-score normalization
 */
function normalizeResponseTime(
  responseTimeMs: number,
  baselineMs: number,
  stdDevMs: number
): number {
  if (stdDevMs === 0) return 0;
  return (responseTimeMs - baselineMs) / stdDevMs;
}

/**
 * Calculate time-based signal
 * Fast = confident, Slow = uncertain, Very slow = confusion
 */
function calculateTimingSignal(
  responseTimeMs: number,
  averageForItem: number,
  isCorrect: boolean
): { signal: number; interpretation: string } {
  const ratio = responseTimeMs / Math.max(averageForItem, 10000);

  if (isCorrect) {
    // Correct answers
    if (ratio < 0.5) {
      return { signal: 1.0, interpretation: 'Very fast correct - strong recall' };
    } else if (ratio < 0.8) {
      return { signal: 0.85, interpretation: 'Fast correct - confident recall' };
    } else if (ratio < 1.2) {
      return { signal: 0.7, interpretation: 'Normal speed correct - standard recall' };
    } else if (ratio < 1.8) {
      return { signal: 0.5, interpretation: 'Slow correct - effortful recall' };
    } else {
      return { signal: 0.35, interpretation: 'Very slow correct - struggled to recall' };
    }
  } else {
    // Incorrect answers
    if (ratio < 0.5) {
      return { signal: 0.0, interpretation: 'Fast incorrect - complete confusion' };
    } else if (ratio < 1.0) {
      return { signal: 0.1, interpretation: 'Normal speed incorrect - wrong knowledge' };
    } else {
      return { signal: 0.15, interpretation: 'Slow incorrect - tried but failed' };
    }
  }
}

/**
 * Calculate answer stability signal
 * Stable first choice = more confident
 */
function calculateAnswerStabilitySignal(
  answerChanged: boolean,
  numberOfChanges: number,
  finalWasFirst: boolean,
  isCorrect: boolean
): { signal: number; interpretation: string } {
  if (!answerChanged) {
    // No changes
    if (isCorrect) {
      return { signal: 0.9, interpretation: 'Stable correct first choice' };
    } else {
      return { signal: 0.1, interpretation: 'Stable incorrect first choice' };
    }
  }

  // Answer was changed
  if (finalWasFirst) {
    // Changed but came back to first choice
    if (isCorrect) {
      return { signal: 0.7, interpretation: 'Returned to correct first choice' };
    } else {
      return { signal: 0.05, interpretation: 'Returned to incorrect first choice' };
    }
  }

  // Changed to different answer
  const changesPenalty = Math.max(0, 1 - numberOfChanges * 0.2);
  if (isCorrect) {
    return {
      signal: 0.5 * changesPenalty,
      interpretation: `Changed to correct answer (${numberOfChanges} changes)`,
    };
  } else {
    return {
      signal: 0.1 * changesPenalty,
      interpretation: `Changed to incorrect answer (${numberOfChanges} changes)`,
    };
  }
}

/**
 * Calculate historical performance signal
 * How well has this item been remembered before?
 */
function calculateHistoricalSignal(
  previousAttempts: number,
  previousCorrectRate: number,
  currentStability: number,
  daysSinceLastReview: number,
  isCorrect: boolean
): { signal: number; interpretation: string } {
  if (previousAttempts === 0) {
    // New item - use correctness only
    return isCorrect
      ? { signal: 0.7, interpretation: 'First attempt - correct' }
      : { signal: 0.2, interpretation: 'First attempt - incorrect' };
  }

  // Calculate expected retention based on stability and time
  const expectedRetention = Math.pow(0.9, daysSinceLastReview / currentStability);

  if (isCorrect) {
    if (expectedRetention < 0.5) {
      // Remembered despite low expected retention - very strong
      return { signal: 0.95, interpretation: 'Remembered despite high forgetting risk' };
    } else if (expectedRetention < 0.7) {
      return { signal: 0.8, interpretation: 'Remembered at moderate forgetting risk' };
    } else {
      return { signal: 0.7, interpretation: 'Remembered as expected' };
    }
  } else {
    if (expectedRetention > 0.8) {
      // Forgot despite high expected retention - concerning
      return { signal: 0.1, interpretation: 'Forgot despite high expected retention' };
    } else if (expectedRetention > 0.5) {
      return { signal: 0.2, interpretation: 'Forgot at moderate retention level' };
    } else {
      return { signal: 0.3, interpretation: 'Forgot as expected (was due for review)' };
    }
  }
}

/**
 * Calculate session context signal
 * Account for fatigue, momentum, and position effects
 */
function calculateSessionContextSignal(
  questionNumber: number,
  consecutiveCorrect: number,
  consecutiveIncorrect: number,
  sessionAccuracy: number,
  isCorrect: boolean,
  fatigueThreshold: number = 30
): { signal: number; interpretation: string } {
  // Fatigue adjustment
  const fatigueMultiplier =
    questionNumber > fatigueThreshold
      ? Math.max(0.8, 1 - (questionNumber - fatigueThreshold) * 0.02)
      : 1;

  // Momentum effects
  let momentumMultiplier = 1;
  if (consecutiveCorrect >= 5) {
    momentumMultiplier = 1.1; // Hot streak bonus
  } else if (consecutiveIncorrect >= 3) {
    momentumMultiplier = 0.9; // Cold streak penalty
  }

  // Base signal
  let baseSignal = isCorrect ? 0.7 : 0.2;

  // Adjust for session position
  if (questionNumber <= 3) {
    // Warm-up period - slightly easier context
    baseSignal *= 0.95;
  } else if (questionNumber > fatigueThreshold) {
    // Fatigue territory - correct answers more impressive
    if (isCorrect) baseSignal *= 1.1;
  }

  const signal = Math.min(1, Math.max(0, baseSignal * fatigueMultiplier * momentumMultiplier));

  return {
    signal,
    interpretation: `Q${questionNumber}, streak: ${consecutiveCorrect}C/${consecutiveIncorrect}I, session: ${(sessionAccuracy * 100).toFixed(0)}%`,
  };
}

/**
 * Calculate hesitation signal from interaction timing
 */
function calculateHesitationSignal(
  timeToFirstInteraction: number,
  timeBetweenClicks: number[],
  responseTimeMs: number
): { signal: number; interpretation: string } {
  // Long delay before any interaction = uncertainty
  const hesitationRatio = timeToFirstInteraction / responseTimeMs;

  // Lots of clicking around = indecision
  const avgClickInterval =
    timeBetweenClicks.length > 0
      ? timeBetweenClicks.reduce((a, b) => a + b, 0) / timeBetweenClicks.length
      : 0;

  const rapidClicking = timeBetweenClicks.filter((t) => t < 500).length;
  const isSearchingBehavior = rapidClicking > 2;

  let signal = 1.0;
  let interpretation = '';

  if (hesitationRatio > 0.4) {
    signal *= 0.7;
    interpretation = 'Long initial hesitation';
  } else if (hesitationRatio < 0.1) {
    signal *= 1.1;
    interpretation = 'Quick to engage';
  }

  if (isSearchingBehavior) {
    signal *= 0.8;
    interpretation += (interpretation ? ', ' : '') + 'searching behavior detected';
  }

  return {
    signal: Math.min(1, Math.max(0, signal)),
    interpretation: interpretation || 'Normal interaction pattern',
  };
}

/**
 * Main inference function - combines all signals to produce FSRS rating
 */
export function inferRating(
  signals: BehavioralSignals,
  profile?: PerformanceProfile
): InferredRating {
  const weightedSignals: { name: string; weight: number; value: number; contribution: number }[] =
    [];

  // Default profile values
  const baselineTime = profile?.baselineResponseTime || 30000;
  const fatigueThreshold = profile?.fatigueThreshold || 30;

  // 1. Timing Signal (weight: 25%)
  const timingResult = calculateTimingSignal(
    signals.responseTimeMs,
    signals.averageResponseTimeForItem || baselineTime,
    signals.isCorrect
  );
  weightedSignals.push({
    name: 'Response Time',
    weight: 0.25,
    value: timingResult.signal,
    contribution: timingResult.signal * 0.25,
  });

  // 2. Answer Stability Signal (weight: 20%)
  const stabilityResult = calculateAnswerStabilitySignal(
    signals.answerChanged,
    signals.numberOfAnswerChanges,
    signals.finalAnswerWasFirstChoice,
    signals.isCorrect
  );
  weightedSignals.push({
    name: 'Answer Stability',
    weight: 0.2,
    value: stabilityResult.signal,
    contribution: stabilityResult.signal * 0.2,
  });

  // 3. Historical Performance Signal (weight: 25%)
  const historicalResult = calculateHistoricalSignal(
    signals.previousAttempts,
    signals.previousCorrectRate,
    signals.currentStability || 1,
    signals.daysSinceLastReview || 0,
    signals.isCorrect
  );
  weightedSignals.push({
    name: 'Historical Performance',
    weight: 0.25,
    value: historicalResult.signal,
    contribution: historicalResult.signal * 0.25,
  });

  // 4. Session Context Signal (weight: 15%)
  const contextResult = calculateSessionContextSignal(
    signals.questionNumber,
    signals.consecutiveCorrect,
    signals.consecutiveIncorrect,
    signals.sessionAccuracySoFar,
    signals.isCorrect,
    fatigueThreshold
  );
  weightedSignals.push({
    name: 'Session Context',
    weight: 0.15,
    value: contextResult.signal,
    contribution: contextResult.signal * 0.15,
  });

  // 5. Hesitation Signal (weight: 15%)
  const hesitationResult = calculateHesitationSignal(
    signals.timeToFirstInteraction,
    signals.timeBetweenClicks,
    signals.responseTimeMs
  );
  weightedSignals.push({
    name: 'Hesitation Pattern',
    weight: 0.15,
    value: hesitationResult.signal,
    contribution: hesitationResult.signal * 0.15,
  });

  // Calculate total weighted score
  const totalScore = weightedSignals.reduce((sum, s) => sum + s.contribution, 0);

  // Map score to FSRS Rating
  let rating: Rating;
  let explanation: string;

  if (!signals.isCorrect) {
    // Incorrect answers: Again or Hard
    if (totalScore < 0.15) {
      rating = Rating.Again;
      explanation = 'Incorrect with signs of complete confusion - needs immediate re-study';
    } else {
      rating = Rating.Hard;
      explanation = 'Incorrect but showed partial knowledge - review soon';
    }
  } else {
    // Correct answers: map to Hard, Good, or Easy
    if (totalScore < 0.45) {
      rating = Rating.Hard;
      explanation = 'Correct but with significant struggle - treat as hard pass';
    } else if (totalScore < 0.75) {
      rating = Rating.Good;
      explanation = 'Confident correct answer - normal good response';
    } else {
      rating = Rating.Easy;
      explanation = 'Very confident, fast, stable answer - easy recall';
    }
  }

  // Calculate confidence in our inference
  const signalAgreement = weightedSignals.map((s) => s.value);
  const variance = calculateVariance(signalAgreement);
  const inferenceConfidence = Math.max(0.5, 1 - variance * 2);

  // Calculate recommended adjustments
  const stabilityMultiplier = calculateStabilityMultiplier(rating, totalScore, signals);
  const difficultyAdjustment = calculateDifficultyAdjustment(rating, totalScore, signals);

  return {
    rating,
    confidence: inferenceConfidence,
    signals: weightedSignals,
    explanation,
    recommendedStabilityMultiplier: stabilityMultiplier,
    recommendedDifficultyAdjustment: difficultyAdjustment,
  };
}

/**
 * Calculate stability multiplier based on inferred performance
 */
function calculateStabilityMultiplier(
  rating: Rating,
  score: number,
  signals: BehavioralSignals
): number {
  const baseMultipliers: Record<Rating, number> = {
    [Rating.Again]: 0.5,
    [Rating.Hard]: 0.8,
    [Rating.Good]: 1.0,
    [Rating.Easy]: 1.3,
  };

  let multiplier = baseMultipliers[rating];

  // Bonus for beating expectations
  if (signals.daysSinceLastReview > signals.currentStability * 0.9 && signals.isCorrect) {
    multiplier *= 1.1;
  }

  // Penalty for unexpected forgetting
  if (signals.daysSinceLastReview < signals.currentStability * 0.5 && !signals.isCorrect) {
    multiplier *= 0.8;
  }

  // Adjust based on confidence in the score
  multiplier *= 0.8 + score * 0.4;

  return Math.max(0.3, Math.min(2.0, multiplier));
}

/**
 * Calculate difficulty adjustment based on performance
 */
function calculateDifficultyAdjustment(
  rating: Rating,
  score: number,
  signals: BehavioralSignals
): number {
  // Positive = increase difficulty, Negative = decrease
  let adjustment = 0;

  switch (rating) {
    case Rating.Again:
      adjustment = 0.2; // Increase difficulty
      break;
    case Rating.Hard:
      adjustment = signals.isCorrect ? 0.05 : 0.15;
      break;
    case Rating.Good:
      adjustment = 0; // No change
      break;
    case Rating.Easy:
      adjustment = -0.1; // Decrease difficulty
      break;
  }

  // Amplify based on score confidence
  adjustment *= 0.5 + Math.abs(score - 0.5) * 2;

  return Math.max(-0.3, Math.min(0.3, adjustment));
}

/**
 * Utility: Calculate variance of an array
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Build performance profile from historical data
 * This should be called with aggregated user data from the database
 */
export function buildPerformanceProfile(
  historicalResponses: {
    responseTimeMs: number;
    isCorrect: boolean;
    timestamp: Date;
    questionNumber: number;
  }[]
): PerformanceProfile {
  if (historicalResponses.length === 0) {
    return {
      baselineResponseTime: 30000,
      responseTimeVariance: 10000,
      accuracyByTimeOfDay: {},
      accuracyBySessionPosition: [],
      fatigueThreshold: 30,
      optimalDifficulty: 5,
      learningVelocity: 1,
    };
  }

  // Calculate baseline response time (median)
  const times = historicalResponses.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const baselineResponseTime = times[Math.floor(times.length / 2)];
  const responseTimeVariance = calculateVariance(times);

  // Accuracy by time of day
  const accuracyByTimeOfDay: Record<string, number> = {};
  const hourBuckets: Record<string, { correct: number; total: number }> = {};

  for (const response of historicalResponses) {
    const hour = response.timestamp.getHours();
    const bucket = `${Math.floor(hour / 4) * 4}-${Math.floor(hour / 4) * 4 + 4}`;

    if (!hourBuckets[bucket]) {
      hourBuckets[bucket] = { correct: 0, total: 0 };
    }
    hourBuckets[bucket].total++;
    if (response.isCorrect) hourBuckets[bucket].correct++;
  }

  for (const [bucket, data] of Object.entries(hourBuckets)) {
    accuracyByTimeOfDay[bucket] = data.correct / data.total;
  }

  // Accuracy by session position
  const positionBuckets: Record<number, { correct: number; total: number }> = {};
  for (const response of historicalResponses) {
    const bucket = Math.floor(response.questionNumber / 10) * 10;
    if (!positionBuckets[bucket]) {
      positionBuckets[bucket] = { correct: 0, total: 0 };
    }
    positionBuckets[bucket].total++;
    if (response.isCorrect) positionBuckets[bucket].correct++;
  }

  const accuracyBySessionPosition = Object.entries(positionBuckets)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, data]) => data.correct / data.total);

  // Find fatigue threshold (where accuracy drops significantly)
  let fatigueThreshold = 30;
  for (let i = 1; i < accuracyBySessionPosition.length; i++) {
    if (accuracyBySessionPosition[i] < accuracyBySessionPosition[0] * 0.85) {
      fatigueThreshold = i * 10;
      break;
    }
  }

  // Calculate learning velocity (improvement over time)
  const correctRate =
    historicalResponses.filter((r) => r.isCorrect).length / historicalResponses.length;
  const learningVelocity = Math.max(0.5, Math.min(2, correctRate * 1.5));

  return {
    baselineResponseTime,
    responseTimeVariance: Math.sqrt(responseTimeVariance),
    accuracyByTimeOfDay,
    accuracyBySessionPosition,
    fatigueThreshold,
    optimalDifficulty: 5 + (correctRate - 0.7) * 5, // 5 ± 2.5 based on accuracy
    learningVelocity,
  };
}

/**
 * Batch process multiple responses and infer ratings
 */
export function inferBatchRatings(
  responses: BehavioralSignals[],
  profile?: PerformanceProfile
): InferredRating[] {
  return responses.map((signals) => inferRating(signals, profile));
}

export default {
  inferRating,
  buildPerformanceProfile,
  inferBatchRatings,
};
