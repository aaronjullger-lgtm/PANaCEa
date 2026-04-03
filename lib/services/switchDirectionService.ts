/**
 * Answer-Switch Direction Tracking Service (Wave 2B)
 *
 * Classifies each answer switch by whether it was right→wrong, wrong→right, or wrong→wrong,
 * then computes a metacognitive precision score and confidence multiplier.
 *
 * Key signals:
 * - wrong→right (beneficial): Good self-correction, metacognitive awareness
 * - right→wrong (harmful): Second-guessing, knowledge fragility
 * - wrong→wrong (lateral): Flailing, no clear retrieval anchor
 *
 * Integration: Applied to implicitConfidence after distractor chronometry in drillReviewService.ts.
 * Uses the same option_interactions[] data — purely server-side analysis since the client
 * cannot know correctness at switch time.
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 2B
 */

// ── Types ──

export interface SwitchDirectionResult {
  /** Beneficial switches: wrong → right */
  wrongToRight: number;
  /** Harmful switches: right → wrong */
  rightToWrong: number;
  /** Lateral confusion: wrong → wrong */
  wrongToWrong: number;
  /** Net switch value (positive = good metacognition) */
  netSwitchValue: number;
  /** Proportion of beneficial switches (0–1), null if no switches */
  metacognitivePrecision: number | null;
  /** Confidence modifier based on switch quality: 0.80–1.03 */
  confidenceMultiplier: number;
}

// ── Constants ──

/** Floor for confidence multiplier */
const MIN_MULTIPLIER = 0.80;

/** Penalty when learner switches away from correct answer */
const RIGHT_TO_WRONG_PENALTY = 0.90;

/** Penalty for ≥2 wrong→wrong switches (flailing) */
const FLAILING_PENALTY = 0.95;

/** Bonus for clean self-correction (wrong→right with no right→wrong) */
const GOOD_METACOGNITION_BONUS = 1.03;

// ── Main function ──

/**
 * Analyze the direction of answer switches to derive a metacognitive precision
 * score and confidence multiplier.
 *
 * @param interactions - Ordered array of option selections (only option_id needed)
 * @param correctOptionId - The correct answer option ID
 * @returns Switch direction analysis with confidence multiplier
 */
export function analyzeSwitchDirections(
  interactions: Array<{ option_id: string }>,
  correctOptionId: string
): SwitchDirectionResult {
  // Fewer than 2 interactions = no switches occurred
  if (!interactions || interactions.length < 2) {
    return {
      wrongToRight: 0,
      rightToWrong: 0,
      wrongToWrong: 0,
      netSwitchValue: 0,
      metacognitivePrecision: null,
      confidenceMultiplier: 1.0,
    };
  }

  let wrongToRight = 0;
  let rightToWrong = 0;
  let wrongToWrong = 0;

  for (let i = 1; i < interactions.length; i++) {
    const prevCorrect = interactions[i - 1].option_id === correctOptionId;
    const currCorrect = interactions[i].option_id === correctOptionId;

    if (!prevCorrect && currCorrect) wrongToRight++;
    else if (prevCorrect && !currCorrect) rightToWrong++;
    else if (!prevCorrect && !currCorrect) wrongToWrong++;
    // right → right = re-selected same correct option, not a meaningful switch
  }

  const totalSwitches = wrongToRight + rightToWrong + wrongToWrong;
  const netSwitchValue = wrongToRight - rightToWrong;
  const metacognitivePrecision = totalSwitches > 0
    ? wrongToRight / totalSwitches
    : null;

  let multiplier = 1.0;

  // Right → wrong is the strongest negative signal
  if (rightToWrong > 0) multiplier *= RIGHT_TO_WRONG_PENALTY;

  // Multiple wrong → wrong = flailing
  if (wrongToWrong >= 2) multiplier *= FLAILING_PENALTY;

  // Good metacognitive revision gets a small boost
  if (wrongToRight > 0 && rightToWrong === 0) multiplier *= GOOD_METACOGNITION_BONUS;

  return {
    wrongToRight,
    rightToWrong,
    wrongToWrong,
    netSwitchValue,
    metacognitivePrecision: metacognitivePrecision != null
      ? Math.round(metacognitivePrecision * 1000) / 1000
      : null,
    confidenceMultiplier: Math.round(Math.max(MIN_MULTIPLIER, multiplier) * 1000) / 1000,
  };
}
