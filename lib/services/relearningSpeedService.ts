/**
 * Relearning Speed (Savings Score) Service (Wave 3C)
 *
 * When a card re-enters learning after a lapse, compares relearning RT to original
 * learning RT for residual memory detection (Ebbinghaus "savings" paradigm).
 *
 * Positive savings = the learner relearned faster than they originally learned,
 * indicating residual memory traces even after the lapse. This earns a post-lapse
 * stability bonus (up to 1.25).
 *
 * Integration: Apply postLapseStabilityBonus to modifiedStability only when
 * !isCorrect and card has lapsed (lapses ≥ 1).
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 3C (Feature #6)
 */

// ── Types ──

export interface RelearningSpeedResult {
  /** 1 - (relearningRT / originalRT). Positive = savings exist. */
  savingsRatio: number | null;
  /** Stability bonus for post-lapse card (1.0–1.25) */
  postLapseStabilityBonus: number;
  /** Whether savings could be computed */
  hasSavings: boolean;
}

// ── Constants ──

/** Minimum savings ratio to trigger a bonus */
const SAVINGS_THRESHOLD = 0.3;

/** Maximum savings ratio considered for bonus calculation */
const MAX_SAVINGS_RATIO = 0.5;

/** Scaling factor: savings ratio → stability bonus */
const SAVINGS_BONUS_SCALE = 0.5;

// ── Main function ──

/**
 * Compute relearning speed (savings) for a lapsed card.
 *
 * @param currentRtMs - Current response time (relearning attempt)
 * @param originalLearningRtMs - Response time from the card's first-ever review (null if unavailable)
 * @param cardLapses - Number of times this card has lapsed
 * @returns Savings analysis with post-lapse stability bonus
 */
export function computeRelearningSpeed(
  currentRtMs: number,
  originalLearningRtMs: number | null,
  cardLapses: number
): RelearningSpeedResult {
  // Only applies to relapsed cards with original learning data
  if (originalLearningRtMs == null || originalLearningRtMs <= 0 || cardLapses < 1) {
    return { savingsRatio: null, postLapseStabilityBonus: 1.0, hasSavings: false };
  }

  // Guard: if current RT is 0 or negative, can't compute meaningful savings
  if (currentRtMs <= 0) {
    return { savingsRatio: null, postLapseStabilityBonus: 1.0, hasSavings: false };
  }

  const savings = 1 - (currentRtMs / originalLearningRtMs);

  // Positive savings = residual memory → faster recovery
  let bonus = 1.0;
  if (savings > SAVINGS_THRESHOLD) {
    bonus = 1.0 + Math.min(savings, MAX_SAVINGS_RATIO) * SAVINGS_BONUS_SCALE; // Max 1.25
  }

  return {
    savingsRatio: Math.round(savings * 1000) / 1000,
    postLapseStabilityBonus: Math.round(bonus * 1000) / 1000,
    hasSavings: true,
  };
}

/**
 * Retrieve the original learning RT for a (userId, questionId) pair.
 * Queries the first-ever ReviewLog entry for this card.
 *
 * @param prisma - Prisma client
 * @param userId - User ID
 * @param questionId - Question ID
 * @returns Original learning RT in ms, or null if unavailable
 */
export async function getOriginalLearningRt(
  prisma: any,
  userId: string,
  questionId: string
): Promise<number | null> {
  try {
    const firstReview = await prisma.reviewLog.findFirst({
      where: { userId, questionId },
      orderBy: { reviewedAt: 'asc' },
      select: { responseTimeMs: true },
    });
    return firstReview?.responseTimeMs ?? null;
  } catch (err) {
    console.debug('[relearningSpeedService] original learning RT lookup failed', err);
    return null;
  }
}
