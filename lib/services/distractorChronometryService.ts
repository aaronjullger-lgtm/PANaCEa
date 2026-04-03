/**
 * Distractor Interaction Chronometry Service (Wave 2A)
 *
 * Analyzes the full sequence of option interactions — which options were selected,
 * in what order, and for how long — to derive a confidence multiplier.
 *
 * Key signals:
 * - Correct answer was selected then abandoned → fragile knowledge (penalty)
 * - Many distinct options tried → high uncertainty (penalty)
 * - Decisive single selection → confident recall (no penalty)
 * - Long dwell on distractors → attraction to wrong reasoning (logged, not penalized directly)
 *
 * Integration: Applied to implicitConfidence after deriveContinuousRating() in drillReviewService.ts
 * Only activates when telemetry.option_interactions[] is present (backward compatible).
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 2A
 */

// ── Types ──

export interface OptionInteractionRecord {
  option_id: string;
  selected_at_ms: number;
  deselected_at_ms: number | null;
  dwell_ms: number | null;
}

export interface DistractorChronometryResult {
  /** Count of distinct options the learner selected */
  uniqueOptionsConsidered: number;
  /** Was the correct answer ever selected then abandoned? */
  correctOptionAbandoned: boolean;
  /** Max dwell time on any single wrong option (ms) */
  longestDistractorDwellMs: number;
  /** Confidence modifier: 0.75–1.0 */
  confidenceMultiplier: number;
}

// ── Constants ──

/** Floor for the confidence multiplier — never penalize more than 25% */
const MIN_MULTIPLIER = 0.75;

/** Penalty when correct answer was selected then switched away */
const CORRECT_ABANDONED_PENALTY = 0.85;

/** Penalty when 3+ distinct options were tried (high uncertainty) */
const HIGH_UNCERTAINTY_PENALTY = 0.95;

// ── Main function ──

/**
 * Analyze the sequence of option interactions to derive a confidence multiplier.
 *
 * @param interactions - Ordered array of option interaction records from client telemetry
 * @param correctOptionId - The correct answer option ID (e.g. 'B')
 * @param finalSelectedId - The option the learner submitted as their answer
 * @returns Chronometry analysis result with confidence multiplier
 */
export function analyzeDistractorChronometry(
  interactions: OptionInteractionRecord[],
  correctOptionId: string,
  finalSelectedId: string
): DistractorChronometryResult {
  // No interactions → neutral (no signal)
  if (!interactions || interactions.length === 0) {
    return {
      uniqueOptionsConsidered: finalSelectedId ? 1 : 0,
      correctOptionAbandoned: false,
      longestDistractorDwellMs: 0,
      confidenceMultiplier: 1.0,
    };
  }

  const uniqueOptions = new Set(interactions.map(i => i.option_id));
  const correctEverSelected = interactions.some(i => i.option_id === correctOptionId);
  const correctAbandoned = correctEverSelected && finalSelectedId !== correctOptionId;

  let longestDistractorDwell = 0;
  for (const interaction of interactions) {
    if (interaction.option_id !== correctOptionId && interaction.dwell_ms != null) {
      longestDistractorDwell = Math.max(longestDistractorDwell, interaction.dwell_ms);
    }
  }

  let multiplier = 1.0;

  // Correct answer was selected then abandoned — fragile knowledge
  if (correctAbandoned) {
    multiplier *= CORRECT_ABANDONED_PENALTY;
  }

  // Many options tried — high uncertainty
  if (uniqueOptions.size >= 3) {
    multiplier *= HIGH_UNCERTAINTY_PENALTY;
  }
  // Single decisive selection → no penalty (multiplier stays at 1.0)

  return {
    uniqueOptionsConsidered: uniqueOptions.size,
    correctOptionAbandoned: correctAbandoned,
    longestDistractorDwellMs: longestDistractorDwell,
    confidenceMultiplier: Math.round(Math.max(MIN_MULTIPLIER, multiplier) * 1000) / 1000,
  };
}
