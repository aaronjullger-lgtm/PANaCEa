/**
 * Desirable Difficulty Bonus
 *
 * Correct answers achieved with low confidence (effortful retrieval) should
 * receive a stability *bonus*, not a penalty. The current pipeline penalizes
 * slow/hesitant correct answers via the graduated stability multiplier, but
 * effortful successful retrieval is the strongest predictor of durable memory.
 *
 * Research basis:
 * - Bjork & Bjork (2011): "Desirable difficulties" — conditions that make
 *   learning harder during acquisition but improve long-term retention
 * - Kornell & Bjork (2009): Generation effect — effortful production strengthens
 *   memory traces more than passive recognition
 * - Pyc & Rawson (2009): Difficulty at retrieval practice predicts retention
 *   better than fluency at retrieval practice
 *
 * Design:
 * - Only applies to CORRECT answers with BELOW-AVERAGE confidence
 * - Bonus increases with elapsed days (spaced effortful retrieval > massed)
 * - Capped at 1.25× stability bonus (25% max increase)
 * - Zero bonus for incorrect answers or high-confidence correct answers
 *
 * The bonus is additive with the graduated stability multiplier. Net effect:
 * - High confidence correct: stability × ~1.2 (from graduated multiplier alone)
 * - Low confidence correct:  stability × ~0.8 × ~1.15 = ~0.92 (partially offset)
 * - Very low confidence + long spacing: stability × ~0.75 × ~1.25 = ~0.94 (mostly offset)
 *
 * This prevents the paradox where the hardest successful retrievals
 * (which produce the strongest memory) get the shortest intervals.
 */

// ── Types ──

export interface DesirableDifficultyConfig {
  /** Confidence threshold below which the bonus activates (default: 0.55) */
  confidenceThreshold: number;
  /** Maximum stability bonus multiplier (default: 1.25) */
  maxBonus: number;
  /** Minimum elapsed days for full bonus (default: 3.0) */
  spacingThresholdDays: number;
  /** Base bonus at threshold confidence with minimal spacing (default: 1.05) */
  baseBonus: number;
}

export interface DesirableDifficultyResult {
  /** Stability multiplier to apply (1.0 = no bonus, up to maxBonus) */
  multiplier: number;
  /** Whether the bonus was activated */
  activated: boolean;
  /** Components for logging/debugging */
  components: {
    effortSignal: number;
    spacingSignal: number;
  };
}

// ── Defaults ──

export const DEFAULT_DD_CONFIG: DesirableDifficultyConfig = {
  confidenceThreshold: 0.55,
  maxBonus: 1.25,
  spacingThresholdDays: 3.0,
  baseBonus: 1.05,
};

// ── Core function ──

/**
 * Compute the desirable difficulty stability bonus.
 *
 * @param confidence - Adjusted confidence after Bayesian accumulation + calibration
 * @param isCorrect - Whether the answer was correct
 * @param elapsedDays - Days since last review of this card
 * @param config - Optional configuration overrides
 * @returns Stability multiplier and activation metadata
 */
export function computeDesirableDifficultyBonus(
  confidence: number,
  isCorrect: boolean,
  elapsedDays: number,
  config: DesirableDifficultyConfig = DEFAULT_DD_CONFIG
): DesirableDifficultyResult {
  // Only applies to correct answers with below-threshold confidence
  if (!isCorrect || confidence >= config.confidenceThreshold) {
    return {
      multiplier: 1.0,
      activated: false,
      components: { effortSignal: 0, spacingSignal: 0 },
    };
  }

  // Effort signal: how far below the threshold (0 = at threshold, 1 = at minimum confidence)
  // confidence 0.55 → 0; confidence 0.30 → 1.0
  const effortSignal = Math.min(1.0,
    (config.confidenceThreshold - confidence) / (config.confidenceThreshold - 0.3)
  );

  // Spacing signal: longer spacing → stronger bonus (spaced effortful retrieval is king)
  // 0 days → 0; 3+ days → 1.0
  const spacingSignal = Math.min(1.0,
    Math.max(0, elapsedDays) / config.spacingThresholdDays
  );

  // Combined bonus: effort × spacing, scaled between baseBonus and maxBonus
  // Both signals contribute: high effort + long spacing = maximum bonus
  const combinedSignal = effortSignal * 0.6 + spacingSignal * 0.4;
  const bonusRange = config.maxBonus - config.baseBonus;
  const multiplier = config.baseBonus + combinedSignal * bonusRange;

  return {
    multiplier: Math.min(config.maxBonus, multiplier),
    activated: true,
    components: {
      effortSignal: Math.round(effortSignal * 1000) / 1000,
      spacingSignal: Math.round(spacingSignal * 1000) / 1000,
    },
  };
}
