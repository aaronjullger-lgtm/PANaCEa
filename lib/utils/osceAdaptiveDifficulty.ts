/**
 * OSCE Adaptive Difficulty Calculator
 * 
 * Auto-scales encounter difficulty based on learner performance.
 * Provides confidence-adjusted recommendations for case selection.
 */

export interface AdaptiveDifficultyResult {
  recommended: 'cooperative' | 'difficult' | 'very_difficult';
  reason: string;
  performanceLevel: 'novice' | 'developing' | 'competent' | 'proficient';
  confidence: number; // 0-1 based on sample size
}

/**
 * Calculates adaptive difficulty recommendation from recent scores.
 * 
 * Logic:
 * - Requires 3+ scores for meaningful recommendation; returns cooperative with low confidence otherwise
 * - Evaluates trend: compares last 3 scores vs previous 3 scores
 * - Performance levels drive recommendations:
 *   * Proficient (avg >= 85, stable/improving) → very_difficult
 *   * Competent (avg >= 70, improving) → difficult
 *   * Developing (avg 55-70, declining) → cooperative with boost
 *   * Novice (avg < 55) → cooperative with explanation
 * - Confidence increases with sample size, capped at 0.95 for safety
 * 
 * @param recentScores - Array of performance scores (0-100), most recent last
 * @returns AdaptiveDifficultyResult with recommendation, reason, and confidence
 */
export function calculateAdaptiveDifficulty(
  recentScores: number[]
): AdaptiveDifficultyResult {
  // Minimum sample: 3 scores
  if (recentScores.length < 3) {
    return {
      recommended: 'cooperative',
      reason: `Build baseline with at least 3 encounters (you have ${recentScores.length}).`,
      performanceLevel: 'novice',
      confidence: Math.max(0.2, recentScores.length * 0.25),
    };
  }

  // Calculate average
  const average = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

  // Calculate trend (last 3 vs previous 3 or all before last 3)
  const lastThree = recentScores.slice(-3);
  const beforeLastThree = recentScores.slice(0, -3);
  const lastThreeAvg = lastThree.reduce((a, b) => a + b, 0) / 3;
  const priorAvg =
    beforeLastThree.length > 0
      ? beforeLastThree.reduce((a, b) => a + b, 0) / beforeLastThree.length
      : lastThreeAvg;

  const isTrendingUp = lastThreeAvg > priorAvg + 2; // >2 point improvement
  const isTrendingDown = lastThreeAvg < priorAvg - 2; // >2 point decline
  const isTrendingStable = !isTrendingUp && !isTrendingDown;

  // Determine performance level and recommendation
  let performanceLevel: 'novice' | 'developing' | 'competent' | 'proficient';
  let recommended: 'cooperative' | 'difficult' | 'very_difficult';
  let reason: string;

  if (average >= 85) {
    if (isTrendingUp || isTrendingStable) {
      performanceLevel = 'proficient';
      recommended = 'very_difficult';
      reason = `Excellent performance (${average.toFixed(1)}%, stable/improving). Ready for complex cases.`;
    } else {
      performanceLevel = 'competent';
      recommended = 'difficult';
      reason = `Strong performance (${average.toFixed(1)}%, slight decline). Maintain challenge with difficult cases.`;
    }
  } else if (average >= 70) {
    if (isTrendingUp) {
      performanceLevel = 'competent';
      recommended = 'difficult';
      reason = `Solid progress (${average.toFixed(1)}%, trending up). Step up to difficult cases.`;
    } else {
      performanceLevel = 'developing';
      recommended = 'cooperative';
      reason = `Developing (${average.toFixed(1)}%). Using cooperative cases to build confidence.`;
    }
  } else if (average >= 55) {
    performanceLevel = 'developing';
    recommended = 'cooperative';
    reason = `Building foundations (${average.toFixed(1)}%). Cooperative cases reinforce core skills.`;
  } else {
    performanceLevel = 'novice';
    recommended = 'cooperative';
    reason = `Early learning phase (${average.toFixed(1)}%). Start with cooperative cases to build fundamentals.`;
  }

  // Confidence: scales with sample size, capped at 0.95
  // Formula: min(0.95, 0.3 + (sampleSize / 20))
  const confidence = Math.min(0.95, 0.3 + recentScores.length / 20);

  return {
    recommended,
    reason,
    performanceLevel,
    confidence,
  };
}

/**
 * Prioritizes systems by weakness for case selection.
 * 
 * Sorts systems by average score (weakest first).
 * Only counts systems with 2+ attempts to avoid noise.
 * 
 * @param systemScores - Object mapping system name to {avg, count}
 * @returns Array of system names sorted by priority (weakest first)
 */
export function getAdaptiveSystemPriority(
  systemScores: Record<string, { avg: number; count: number }>
): string[] {
  return Object.entries(systemScores)
    .filter(([, data]) => data.count >= 2) // Minimum 2 attempts
    .sort(([, a], [, b]) => a.avg - b.avg) // Weakest first
    .map(([system]) => system);
}
