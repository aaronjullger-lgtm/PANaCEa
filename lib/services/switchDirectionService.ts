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
  /** Direction of the first switch: 'WR' | 'RW' | 'WW' | null */
  firstSwitchDirection: 'WR' | 'RW' | 'WW' | null;
  /** Total number of switches (for downstream first-only weighting) */
  totalSwitches: number;
  /**
   * Grade penalty recommendation based on switch direction analysis.
   * Accounts for research finding that only first change is informative
   * and subsequent changes approach guessing probability.
   * Range: -0.30 (strong RW penalty) to +0.10 (clean WR correction).
   */
  gradePenaltyRecommendation: number;
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

/**
 * Grade penalty constants based on switch direction research.
 * Research (ScienceDirect 2022, Bauer et al. BMC Med Ed 2007):
 * - Only first change is informative; subsequent changes approach guessing
 * - WR ratio is ~3:1 (62% of changes are wrong→right)
 * - RW is strong negative signal (initial correct may have been lucky)
 * - Second+ changes carry no positive signal
 */
const FIRST_SWITCH_WR_BONUS = 0.10;    // First change was wrong→right: metacognitive recovery
const FIRST_SWITCH_RW_PENALTY = -0.25; // First change was right→wrong: knowledge fragility
const FIRST_SWITCH_WW_PENALTY = -0.10; // First change was wrong→wrong: no anchor
const SUBSEQUENT_SWITCH_PENALTY = -0.05; // Each additional switch beyond first (diminishing signal)

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
      firstSwitchDirection: null,
      totalSwitches: 0,
      gradePenaltyRecommendation: 0,
    };
  }

  let wrongToRight = 0;
  let rightToWrong = 0;
  let wrongToWrong = 0;
  let firstSwitchDirection: 'WR' | 'RW' | 'WW' | null = null;

  for (let i = 1; i < interactions.length; i++) {
    const prevCorrect = interactions[i - 1].option_id === correctOptionId;
    const currCorrect = interactions[i].option_id === correctOptionId;

    if (!prevCorrect && currCorrect) {
      wrongToRight++;
      if (!firstSwitchDirection) firstSwitchDirection = 'WR';
    } else if (prevCorrect && !currCorrect) {
      rightToWrong++;
      if (!firstSwitchDirection) firstSwitchDirection = 'RW';
    } else if (!prevCorrect && !currCorrect) {
      wrongToWrong++;
      if (!firstSwitchDirection) firstSwitchDirection = 'WW';
    }
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

  // ── Grade penalty recommendation (research-backed first-change weighting) ──
  // Research: only the first answer change improves scores; additional changes
  // approach guessing probability (ScienceDirect, 2022).
  let gradePenalty = 0;
  if (firstSwitchDirection === 'WR') {
    gradePenalty = FIRST_SWITCH_WR_BONUS;
  } else if (firstSwitchDirection === 'RW') {
    gradePenalty = FIRST_SWITCH_RW_PENALTY;
  } else if (firstSwitchDirection === 'WW') {
    gradePenalty = FIRST_SWITCH_WW_PENALTY;
  }
  // Subsequent switches beyond the first: diminishing penalty
  const subsequentSwitches = Math.max(0, totalSwitches - 1);
  gradePenalty += subsequentSwitches * SUBSEQUENT_SWITCH_PENALTY;

  return {
    wrongToRight,
    rightToWrong,
    wrongToWrong,
    netSwitchValue,
    metacognitivePrecision: metacognitivePrecision != null
      ? Math.round(metacognitivePrecision * 1000) / 1000
      : null,
    confidenceMultiplier: Math.round(Math.max(MIN_MULTIPLIER, multiplier) * 1000) / 1000,
    firstSwitchDirection,
    totalSwitches,
    gradePenaltyRecommendation: Math.round(gradePenalty * 1000) / 1000,
  };
}
