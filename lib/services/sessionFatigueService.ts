/**
 * Session Fatigue Service
 *
 * Detects within-session cognitive fatigue from question position and applies
 * a par time correction so later questions aren't over-penalized by the
 * latency ratio when the student is tired, not confused.
 *
 * Model: After a fatigue threshold (default Q15), par time is progressively
 * relaxed using a logarithmic ramp. The correction is multiplicative:
 *   adjustedParTime = parTime * fatigueCorrectionFactor
 *
 * The factor starts at 1.0 (no adjustment) and increases gently:
 *   factor = 1.0 + FATIGUE_RATE * ln(1 + questionsOverThreshold)
 *
 * At Q20 (5 over threshold): factor ≈ 1.06 (6% longer par)
 * At Q30 (15 over threshold): factor ≈ 1.10 (10% longer par)
 * At Q40 (25 over threshold): factor ≈ 1.12 (12% longer par)
 *
 * Capped at 1.20 (20% max relaxation) to prevent gaming.
 */

/** Question number after which fatigue correction kicks in */
export const FATIGUE_THRESHOLD = 15;

/** Rate of fatigue accumulation (controls steepness of the log curve) */
export const FATIGUE_RATE = 0.035;

/** Maximum fatigue correction factor (20% par time increase) */
export const MAX_FATIGUE_FACTOR = 1.20;

/**
 * Compute the fatigue correction factor for a given question position.
 *
 * @param questionNumber - 1-based position in the session
 * @returns Multiplicative factor for par time (1.0 = no adjustment)
 */
export function computeFatigueFactor(questionNumber: number): number {
  if (!Number.isFinite(questionNumber) || questionNumber <= FATIGUE_THRESHOLD) {
    return 1.0;
  }

  const questionsOverThreshold = questionNumber - FATIGUE_THRESHOLD;
  const factor = 1.0 + FATIGUE_RATE * Math.log(1 + questionsOverThreshold);

  return Math.min(factor, MAX_FATIGUE_FACTOR);
}

/**
 * Apply fatigue correction to par time.
 *
 * @param parTimeMs - Base par time in milliseconds
 * @param questionNumber - 1-based position in session (from telemetry)
 * @returns Fatigue-adjusted par time in milliseconds
 */
export function applyFatigueCorrection(parTimeMs: number, questionNumber: number | undefined | null): number {
  if (questionNumber == null || questionNumber <= 0) return parTimeMs;

  const factor = computeFatigueFactor(questionNumber);
  return Math.round(parTimeMs * factor);
}

/**
 * Compute a confidence dampener based on session position.
 *
 * Late-session reviews produce behavioral signals under cognitive fatigue
 * (Warm, 1984; Helton & Russell, 2015). A correct answer at Q35 feels
 * fluent because the student is on "autopilot," not because memory is strong.
 *
 * Dampener ramps from 1.0 (no adjustment) to 0.85 (15% confidence reduction)
 * using the same logarithmic shape as the par time correction.
 *
 * At Q15 or below: factor = 1.0 (no dampening)
 * At Q20: factor ≈ 0.94
 * At Q30: factor ≈ 0.90
 * At Q40+: factor ≈ 0.88
 * Floor: 0.85 (15% max reduction)
 *
 * Research basis:
 * - Warm (1984): Sustained attention task performance declines after ~15 min
 * - Helton & Russell (2015): Vigilance decrement reflects cognitive resource depletion
 * - Pattyn et al. (2008): Task-unrelated thoughts increase with time-on-task
 *
 * @param questionNumber - 1-based position in the session
 * @returns Multiplicative confidence dampener [0.85, 1.0]
 */
export function computeFatigueConfidenceDampener(questionNumber: number): number {
  if (!Number.isFinite(questionNumber) || questionNumber <= FATIGUE_THRESHOLD) {
    return 1.0;
  }

  const questionsOverThreshold = questionNumber - FATIGUE_THRESHOLD;
  // Mirror the par time fatigue curve but invert for confidence dampening
  const fatiguePenalty = FATIGUE_RATE * Math.log(1 + questionsOverThreshold);
  const dampener = 1.0 - fatiguePenalty;

  return Math.max(0.85, dampener);
}
