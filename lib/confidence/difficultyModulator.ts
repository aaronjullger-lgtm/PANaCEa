/**
 * Confidence-Weighted Difficulty Modulator
 *
 * FSRS updates difficulty uniformly for all "Good" ratings, but two "Good"
 * ratings can mean very different things: one with 0.92 confidence (easy recall)
 * vs one with 0.45 confidence (barely scraped through). This module modulates
 * how aggressively difficulty shifts based on the confidence of the answer.
 *
 * Research basis:
 * - Metcalfe & Kornell (2005): Region of proximal learning — studying items
 *   that are "just right" difficulty yields optimal learning
 * - Pyc & Rawson (2009): Criterion difficulty levels affect subsequent retention
 * - Finley et al. (2012): Self-regulated learners allocate more time to harder items,
 *   but the learning system should track this to adjust scheduling
 *
 * Design:
 * - Does NOT modify FSRS core math (fsrs.ts is untouched)
 * - Operates on the difficulty DELTA after FSRS computes the new difficulty
 * - High-confidence correct: amplifies the difficulty decrease (item was easier than rated)
 * - Low-confidence correct: dampens the difficulty decrease (item was harder than rated)
 * - Incorrect answers: amplifies the difficulty increase (was genuinely hard)
 * - Modulation factor range: [0.5, 1.5] — never inverts the direction of change
 */

// ── Types ──

export interface DifficultyModulationConfig {
  /** Confidence at which modulation is neutral (1.0) — default: 0.6 */
  neutralConfidence: number;
  /** Maximum amplification factor for high-confidence answers — default: 1.5 */
  maxAmplification: number;
  /** Maximum dampening factor for low-confidence answers — default: 0.5 */
  maxDampening: number;
  /** Whether to apply modulation to incorrect answers — default: true */
  modulateIncorrect: boolean;
}

export interface DifficultyModulationResult {
  /** Original difficulty delta from FSRS */
  originalDelta: number;
  /** Modulated difficulty delta */
  modulatedDelta: number;
  /** The modulation factor applied */
  modulationFactor: number;
}

// ── Defaults ──

export const DEFAULT_DIFFICULTY_CONFIG: DifficultyModulationConfig = {
  neutralConfidence: 0.6,
  maxAmplification: 1.5,
  maxDampening: 0.5,
  modulateIncorrect: true,
};

// ── Core function ──

/**
 * Modulate the difficulty delta based on confidence.
 *
 * For correct answers:
 * - High confidence (>0.6): amplify difficulty decrease (item easier than rated)
 *   factor = 1.0 + (confidence - 0.6) / (0.95 - 0.6) * 0.5 → up to 1.5
 * - Low confidence (<0.6): dampen difficulty decrease (item harder than rated)
 *   factor = 0.5 + (confidence - 0.3) / (0.6 - 0.3) * 0.5 → down to 0.5
 *
 * For incorrect answers:
 * - High confidence (item was surprisingly wrong): amplify difficulty increase
 * - Low confidence (expected to get it wrong): dampen difficulty increase
 *
 * @param baseDelta - The difficulty change computed by FSRS (negative = easier, positive = harder)
 * @param confidence - Adjusted confidence [0.3, 0.95]
 * @param isCorrect - Whether the answer was correct
 * @param config - Optional configuration overrides
 * @returns Modulated delta and metadata
 */
export function modulateDifficultyDelta(
  baseDelta: number,
  confidence: number,
  isCorrect: boolean,
  config: DifficultyModulationConfig = DEFAULT_DIFFICULTY_CONFIG
): DifficultyModulationResult {
  // Guard: no modulation if delta is zero or near-zero
  if (Math.abs(baseDelta) < 0.001) {
    return {
      originalDelta: baseDelta,
      modulatedDelta: baseDelta,
      modulationFactor: 1.0,
    };
  }

  // Don't modulate incorrect if disabled
  if (!isCorrect && !config.modulateIncorrect) {
    return {
      originalDelta: baseDelta,
      modulatedDelta: baseDelta,
      modulationFactor: 1.0,
    };
  }

  const clampedConfidence = Math.max(0.3, Math.min(0.95, confidence));
  let modulationFactor: number;

  if (clampedConfidence >= config.neutralConfidence) {
    // Above neutral: amplify the delta
    const range = 0.95 - config.neutralConfidence;
    const amplificationRange = config.maxAmplification - 1.0;
    modulationFactor = 1.0 + ((clampedConfidence - config.neutralConfidence) / range) * amplificationRange;
  } else {
    // Below neutral: dampen the delta
    const range = config.neutralConfidence - 0.3;
    const dampeningRange = 1.0 - config.maxDampening;
    modulationFactor = config.maxDampening + ((clampedConfidence - 0.3) / range) * dampeningRange;
  }

  modulationFactor = Math.max(config.maxDampening, Math.min(config.maxAmplification, modulationFactor));

  return {
    originalDelta: baseDelta,
    modulatedDelta: baseDelta * modulationFactor,
    modulationFactor: Math.round(modulationFactor * 1000) / 1000,
  };
}
