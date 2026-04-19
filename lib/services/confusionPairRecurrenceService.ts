/**
 * Confusion Pair Recurrence Rate Service (Wave 3D)
 *
 * Tracks repeated confusion between the same pair of conditions and escalates
 * when the count crosses thresholds. Builds on the existing ConfusionPair upsert
 * in drillReviewService — this service adds recurrence analysis and escalation logic.
 *
 * Escalation tiers:
 * - Mild (≥3 confusions): Difficulty boost +0.5, queue contrastive drill
 * - Severe (≥5 confusions): Difficulty boost +1.0, queue contrastive drill + generate differentiation
 *
 * Integration: Called after the existing ConfusionPair upsert in drillReviewService.
 * Uses the updated count from the upsert result.
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 3D (Feature #10)
 */

// ── Types ──

export interface ConfusionPairAction {
  /** How many times this exact pair has been confused */
  pairCount: number;
  /** Whether this triggers escalation */
  escalate: boolean;
  /** Difficulty boost to apply to both conditions */
  difficultyBoost: number;
  /** Whether to queue a contrastive drill */
  queueContrastiveDrill: boolean;
  /** Whether to generate a Gemini differentiation explanation */
  generateDifferentiation: boolean;
}

// ── Constants ──

/** Threshold for mild escalation */
const ESCALATION_THRESHOLD_MILD = 3;

/** Threshold for severe escalation */
const ESCALATION_THRESHOLD_SEVERE = 5;

/** Difficulty boost at mild escalation */
const MILD_DIFFICULTY_BOOST = 0.5;

/** Difficulty boost at severe escalation */
const SEVERE_DIFFICULTY_BOOST = 1.0;

// ── Main functions ──

/**
 * Analyze confusion pair recurrence and determine escalation action.
 *
 * This is a pure function that takes the current pair count and returns the action.
 * The actual DB upsert is handled by the existing code in drillReviewService.
 *
 * @param pairCount - Current count of confusions for this pair (after increment)
 * @returns Escalation action to take
 */
export function analyzeConfusionRecurrence(pairCount: number): ConfusionPairAction {
  if (pairCount <= 0) {
    return {
      pairCount: 0,
      escalate: false,
      difficultyBoost: 0,
      queueContrastiveDrill: false,
      generateDifferentiation: false,
    };
  }

  const isMild = pairCount >= ESCALATION_THRESHOLD_MILD;
  const isSevere = pairCount >= ESCALATION_THRESHOLD_SEVERE;

  return {
    pairCount,
    escalate: isMild,
    difficultyBoost: isSevere
      ? SEVERE_DIFFICULTY_BOOST
      : isMild
        ? MILD_DIFFICULTY_BOOST
        : 0,
    queueContrastiveDrill: isMild,
    generateDifferentiation: isSevere,
  };
}

/**
 * Record a confusion occurrence and return the updated count with escalation action.
 *
 * Wraps the existing confusion pair upsert pattern from drillReviewService with
 * recurrence analysis. Uses bidirectional normalization (sorted condition IDs).
 *
 * @param prisma - Prisma client
 * @param userId - User ID
 * @param correctConditionId - The correct condition's medical content ID
 * @param selectedConditionId - The incorrectly selected condition's medical content ID
 * @returns Escalation action based on updated count
 */
export async function recordAndAnalyzeConfusion(
  prisma: any,
  userId: string,
  correctConditionId: string,
  selectedConditionId: string
): Promise<ConfusionPairAction> {
  // Skip if same condition (not a confusion — just wrong answer on same topic)
  if (correctConditionId === selectedConditionId || !selectedConditionId || !correctConditionId) {
    return {
      pairCount: 0,
      escalate: false,
      difficultyBoost: 0,
      queueContrastiveDrill: false,
      generateDifferentiation: false,
    };
  }

  // Look up the existing confusion pair to get the current count
  // The upsert itself is already done by drillReviewService — we just need the count
  try {
    const existing = await prisma.confusionPair.findFirst({
      where: {
        userId,
        OR: [
          { correctConditionId, selectedConditionId },
          { correctConditionId: selectedConditionId, selectedConditionId: correctConditionId },
        ],
      },
      select: { count: true },
    });

    const pairCount = existing?.count ?? 0;
    return analyzeConfusionRecurrence(pairCount);
  } catch (err) {
    console.debug('[confusionPairRecurrenceService] lookup failed, assuming 0 pairs', err);
    return analyzeConfusionRecurrence(0);
  }
}
