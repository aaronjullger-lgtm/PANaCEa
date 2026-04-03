/**
 * Difficulty Calibrator — The 85% Rule
 *
 * Research: Wilson, R.C. et al. (2019). "The Eighty Five Percent Rule for
 * Optimal Learning." Nature Communications, 10, 4646.
 *
 * Key finding: Learning is maximized when the error rate is ~15.87%,
 * corresponding to ~85% accuracy. When students drift into easier territory
 * (>90% accuracy) or harder territory (<75% accuracy), learning slows.
 *
 * This service monitors a student's rolling accuracy and adjusts the
 * difficulty mix for new questions to maintain the optimal zone.
 *
 * @module lib/services/difficultyCalibrator
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DifficultyMix {
  /** Fraction of questions that should be easy (0-1) */
  easy: number;
  /** Fraction of questions that should be medium (0-1) */
  medium: number;
  /** Fraction of questions that should be hard (0-1) */
  hard: number;
}

export interface CalibrationResult {
  /** Adjusted difficulty mix */
  mix: DifficultyMix;
  /** Student's current rolling accuracy (0-1) */
  accuracy: number;
  /** Which zone the student is in */
  zone: 'too_easy' | 'optimal' | 'too_hard' | 'insufficient_data';
  /** Human-readable description */
  message: string;
}

export interface AttemptRecord {
  wasCorrect: boolean;
  difficulty: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Window size for rolling accuracy calculation */
const ROLLING_WINDOW = 30;

/** Minimum attempts before calibration kicks in */
const MIN_ATTEMPTS = 15;

/** Accuracy thresholds defining the zones */
const OPTIMAL_LOW = 0.78;   // Below this → too hard
const OPTIMAL_HIGH = 0.90;  // Above this → too easy
const OPTIMAL_TARGET = 0.85; // The sweet spot

/** Step size for difficulty mix adjustments */
const ADJUSTMENT_STEP = 0.08;

/** Bounds for any single difficulty level */
const MIN_FRACTION = 0.10;
const MAX_FRACTION = 0.55;

/** Default mix when no calibration data exists */
const DEFAULT_MIX: DifficultyMix = {
  easy: 0.30,
  medium: 0.45,
  hard: 0.25,
};

// ─── Core Calibrator ─────────────────────────────────────────────────────────

/**
 * Calibrate the difficulty mix based on the student's recent performance.
 *
 * @param recentAttempts - The student's recent attempts (most recent last)
 * @param currentMix - The current difficulty distribution (optional)
 * @returns CalibrationResult with adjusted mix and diagnostic info
 */
export function calibrateDifficulty(
  recentAttempts: AttemptRecord[],
  currentMix: DifficultyMix = DEFAULT_MIX
): CalibrationResult {
  // Need enough data to calibrate
  if (recentAttempts.length < MIN_ATTEMPTS) {
    return {
      mix: currentMix,
      accuracy: recentAttempts.length > 0
        ? recentAttempts.filter(a => a.wasCorrect).length / recentAttempts.length
        : 0,
      zone: 'insufficient_data',
      message: `Need ${MIN_ATTEMPTS - recentAttempts.length} more questions before difficulty adapts.`,
    };
  }

  // Calculate rolling accuracy over the window
  const window = recentAttempts.slice(-ROLLING_WINDOW);
  const accuracy = window.filter(a => a.wasCorrect).length / window.length;

  // Determine zone and adjust
  if (accuracy > OPTIMAL_HIGH) {
    // Too easy — shift toward harder questions
    const newMix = shiftHarder(currentMix);
    return {
      mix: newMix,
      accuracy,
      zone: 'too_easy',
      message: `Accuracy ${pct(accuracy)} — increasing challenge to optimize learning.`,
    };
  }

  if (accuracy < OPTIMAL_LOW) {
    // Too hard — shift toward easier questions
    const newMix = shiftEasier(currentMix);
    return {
      mix: newMix,
      accuracy,
      zone: 'too_hard',
      message: `Accuracy ${pct(accuracy)} — adjusting difficulty for better retention.`,
    };
  }

  // Optimal zone — maintain current mix
  return {
    mix: currentMix,
    accuracy,
    zone: 'optimal',
    message: `Accuracy ${pct(accuracy)} — right in the optimal learning zone.`,
  };
}

/**
 * Calculate the optimal difficulty mix for a given system based on
 * the student's per-system performance.
 */
export function calibrateForSystem(
  systemAttempts: AttemptRecord[],
  globalMix: DifficultyMix
): DifficultyMix {
  if (systemAttempts.length < MIN_ATTEMPTS) {
    return globalMix; // Not enough system-specific data
  }

  const result = calibrateDifficulty(systemAttempts, globalMix);
  return result.mix;
}

// ─── Mix Adjustment Helpers ──────────────────────────────────────────────────

function shiftHarder(mix: DifficultyMix): DifficultyMix {
  return normalizeMix({
    easy: Math.max(MIN_FRACTION, mix.easy - ADJUSTMENT_STEP),
    medium: mix.medium,
    hard: Math.min(MAX_FRACTION, mix.hard + ADJUSTMENT_STEP),
  });
}

function shiftEasier(mix: DifficultyMix): DifficultyMix {
  return normalizeMix({
    easy: Math.min(MAX_FRACTION, mix.easy + ADJUSTMENT_STEP),
    medium: mix.medium,
    hard: Math.max(MIN_FRACTION, mix.hard - ADJUSTMENT_STEP),
  });
}

/**
 * Ensure the mix sums to 1.0 and all values are within bounds.
 */
function normalizeMix(mix: DifficultyMix): DifficultyMix {
  const clamped = {
    easy: clamp(mix.easy, MIN_FRACTION, MAX_FRACTION),
    medium: clamp(mix.medium, MIN_FRACTION, MAX_FRACTION),
    hard: clamp(mix.hard, MIN_FRACTION, MAX_FRACTION),
  };

  const total = clamped.easy + clamped.medium + clamped.hard;
  return {
    easy: clamped.easy / total,
    medium: clamped.medium / total,
    hard: clamped.hard / total,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function pct(val: number): string {
  return `${Math.round(val * 100)}%`;
}
