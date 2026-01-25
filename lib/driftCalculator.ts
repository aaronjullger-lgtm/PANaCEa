/**
 * driftCalculator.ts
 *
 * Calculates the "Drift Vector" - a projection of how knowledge will decay
 * over time without review. Uses FSRS retrievability decay formula.
 *
 * Formula: R(t) = exp(-t/S)
 * Where:
 * - R(t) = Retrievability at time t (0.0 to 1.0)
 * - t = Days since last review
 * - S = Stability (days until R drops to ~37%)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FSRSCardData {
  conditionId: string;
  stability: number; // FSRS stability (S)
  retrievability: number; // Current R
  lastReviewedAt: Date | string;
  system?: string;
  blueprintWeight?: number;
}

export interface DriftProjection {
  day: number; // Days from now
  retrievability: number; // Expected average R
  predictedAccuracy: number; // Mapped to accuracy percentage
  predictedScore: number; // PANCE score (200-800)
}

export interface DriftVector {
  currentScore: number;
  projectedScoreDay7: number;
  projectedScoreDay14: number;
  dailyDecayRate: number; // Points/day
  daysUntilDanger: number; // Days until score drops below 350
  urgency: 'low' | 'medium' | 'high' | 'critical';
  projections: DriftProjection[];
}

export interface SystemDrift {
  system: string;
  currentR: number;
  projectedR7: number;
  decayRate: number;
  cardsAtRisk: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// PANCE passing threshold
const PASSING_SCORE = 350;

// FSRS default stability for new cards (days)
const DEFAULT_STABILITY = 1;

// Score mapping: Linear interpolation from accuracy to PANCE score
// 0% accuracy = 200, 100% accuracy = 800
const SCORE_MIN = 200;
const SCORE_MAX = 800;

// =============================================================================
// CORE CALCULATIONS
// =============================================================================

/**
 * Calculate retrievability at a given time using FSRS decay formula
 * R(t) = exp(-t/S)
 */
export function calculateRetrievability(daysSinceReview: number, stability: number): number {
  if (stability <= 0) stability = DEFAULT_STABILITY;
  return Math.exp(-daysSinceReview / stability);
}

/**
 * Calculate aggregate retrievability across all cards for a target date
 * Optionally weighted by blueprint importance
 */
export function calculateAggregateRetrievability(
  cards: FSRSCardData[],
  targetDate: Date,
  useWeights: boolean = false
): number {
  if (cards.length === 0) return 0;

  let weightedSumR = 0;
  let totalWeight = 0;

  for (const card of cards) {
    const lastReview =
      typeof card.lastReviewedAt === 'string' ? new Date(card.lastReviewedAt) : card.lastReviewedAt;

    const daysSinceReview = (targetDate.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);

    // Use current R if date is in past, calculate decay if future
    const retrievability =
      daysSinceReview >= 0
        ? calculateRetrievability(daysSinceReview, card.stability)
        : card.retrievability;

    const weight = useWeights ? card.blueprintWeight || 1 : 1;

    weightedSumR += retrievability * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSumR / totalWeight : 0;
}

/**
 * Map retrievability to accuracy percentage
 * Assumes R ≈ probability of correct recall
 */
export function retrievabilityToAccuracy(r: number): number {
  // R of 0.9 → 90% accuracy (linear mapping with floor/ceiling)
  return Math.max(0, Math.min(100, r * 100));
}

/**
 * Map accuracy to PANCE score (200-800 scale)
 */
export function accuracyToScore(accuracy: number): number {
  return Math.round(SCORE_MIN + (accuracy / 100) * (SCORE_MAX - SCORE_MIN));
}

/**
 * Map PANCE score to accuracy
 */
export function scoreToAccuracy(score: number): number {
  return ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;
}

// =============================================================================
// DRIFT VECTOR CALCULATION
// =============================================================================

/**
 * Calculate drift projections for the next N days
 */
export function calculateDriftProjections(
  cards: FSRSCardData[],
  daysAhead: number = 14
): DriftProjection[] {
  const projections: DriftProjection[] = [];
  const now = new Date();

  for (let day = 0; day <= daysAhead; day++) {
    const targetDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const avgR = calculateAggregateRetrievability(cards, targetDate, true);
    const predictedAccuracy = retrievabilityToAccuracy(avgR);
    const predictedScore = accuracyToScore(predictedAccuracy);

    projections.push({
      day,
      retrievability: avgR,
      predictedAccuracy,
      predictedScore,
    });
  }

  return projections;
}

/**
 * Calculate the complete drift vector from projections
 */
export function calculateDriftVector(cards: FSRSCardData[]): DriftVector {
  const projections = calculateDriftProjections(cards, 14);

  if (projections.length === 0) {
    return {
      currentScore: SCORE_MIN,
      projectedScoreDay7: SCORE_MIN,
      projectedScoreDay14: SCORE_MIN,
      dailyDecayRate: 0,
      daysUntilDanger: 0,
      urgency: 'critical',
      projections: [],
    };
  }

  const current = projections[0];
  const lastProjection = projections[projections.length - 1];
  const day7 = projections[7] ?? lastProjection;
  const day14 = projections[14] ?? lastProjection;

  // Handle case where current is undefined (shouldn't happen but TypeScript requires it)
  if (!current || !day7 || !day14) {
    return {
      currentScore: SCORE_MIN,
      projectedScoreDay7: SCORE_MIN,
      projectedScoreDay14: SCORE_MIN,
      dailyDecayRate: 0,
      daysUntilDanger: 0,
      urgency: 'critical',
      projections,
    };
  }

  // Calculate decay rate
  const decayDay7 = current.predictedScore - day7.predictedScore;
  const dailyDecayRate = Math.round((decayDay7 / 7) * 10) / 10;

  // Find when score crosses passing threshold
  let daysUntilDanger = Infinity;
  for (const p of projections) {
    if (p.predictedScore < PASSING_SCORE) {
      daysUntilDanger = p.day;
      break;
    }
  }

  // Determine urgency level
  let urgency: DriftVector['urgency'] = 'low';
  if (current.predictedScore < PASSING_SCORE) {
    urgency = 'critical';
  } else if (daysUntilDanger <= 3) {
    urgency = 'critical';
  } else if (daysUntilDanger <= 7) {
    urgency = 'high';
  } else if (daysUntilDanger <= 14) {
    urgency = 'medium';
  }

  return {
    currentScore: current.predictedScore,
    projectedScoreDay7: day7.predictedScore,
    projectedScoreDay14: day14.predictedScore,
    dailyDecayRate,
    daysUntilDanger: daysUntilDanger === Infinity ? 999 : daysUntilDanger,
    urgency,
    projections,
  };
}

// =============================================================================
// SYSTEM-LEVEL DRIFT
// =============================================================================

/**
 * Calculate drift by system to identify which systems are decaying fastest
 */
export function calculateSystemDrift(cards: FSRSCardData[]): SystemDrift[] {
  const now = new Date();
  const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Group cards by system
  const systemCards: Record<string, FSRSCardData[]> = {};
  for (const card of cards) {
    const system = card.system || 'UNKNOWN';
    if (!systemCards[system]) systemCards[system] = [];
    systemCards[system].push(card);
  }

  const results: SystemDrift[] = [];

  for (const [system, sysCards] of Object.entries(systemCards)) {
    const currentR = calculateAggregateRetrievability(sysCards, now);
    const projectedR7 = calculateAggregateRetrievability(sysCards, day7);
    const decayRate = (currentR - projectedR7) / 7;

    // Count cards that will drop below 0.9 R (due for review)
    const cardsAtRisk = sysCards.filter((card) => {
      const lastReview =
        typeof card.lastReviewedAt === 'string'
          ? new Date(card.lastReviewedAt)
          : card.lastReviewedAt;
      const daysSince = (day7.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
      const futureR = calculateRetrievability(daysSince, card.stability);
      return futureR < 0.9;
    }).length;

    results.push({
      system,
      currentR,
      projectedR7,
      decayRate,
      cardsAtRisk,
    });
  }

  // Sort by decay rate (fastest decaying first)
  return results.sort((a, b) => b.decayRate - a.decayRate);
}

// =============================================================================
// MESSAGING
// =============================================================================

/**
 * Generate human-readable drift message
 */
export function getDriftMessage(drift: DriftVector): string {
  if (drift.urgency === 'critical') {
    if (drift.currentScore < PASSING_SCORE) {
      return `⚠️ Your current score is below passing. Study now to improve!`;
    }
    return `⚠️ URGENT: Your score will drop below passing in ${drift.daysUntilDanger} day${drift.daysUntilDanger !== 1 ? 's' : ''}!`;
  }

  if (drift.urgency === 'high') {
    return `Your knowledge is decaying at ${drift.dailyDecayRate} pts/day. Study today to prevent drop.`;
  }

  if (drift.urgency === 'medium') {
    const drop = drift.currentScore - drift.projectedScoreDay7;
    return `Projected ${drop} point drop in 7 days without review.`;
  }

  return `Your knowledge is stable. Keep up the consistent reviews!`;
}

/**
 * Generate short status label
 */
export function getDriftStatusLabel(drift: DriftVector): string {
  switch (drift.urgency) {
    case 'critical':
      return '🔴 Critical';
    case 'high':
      return '🟠 At Risk';
    case 'medium':
      return '🟡 Watch';
    case 'low':
      return '🟢 Stable';
  }
}

// =============================================================================
// SESSION IMPACT CALCULATIONS (for Post-Mortem)
// =============================================================================

export interface SessionImpact {
  scoreDelta: number;
  memoriesStabilized: number;
  decayPrevented: number; // Percentage
  projectionImprovement: number; // Days of buffer added
}

/**
 * Calculate the impact of a review session
 * Compares before/after state
 */
export function calculateSessionImpact(
  cardsBefore: FSRSCardData[],
  cardsAfter: FSRSCardData[],
  reviewedCardIds: string[]
): SessionImpact {
  const driftBefore = calculateDriftVector(cardsBefore);
  const driftAfter = calculateDriftVector(cardsAfter);

  const scoreDelta = driftAfter.currentScore - driftBefore.currentScore;

  // Count stabilized memories (cards with increased stability)
  let memoriesStabilized = 0;
  for (const cardId of reviewedCardIds) {
    const before = cardsBefore.find((c) => c.conditionId === cardId);
    const after = cardsAfter.find((c) => c.conditionId === cardId);
    if (before && after && after.stability > before.stability) {
      memoriesStabilized++;
    }
  }

  // Calculate decay prevented
  // Compare day7 projections before and after
  const decayBeforeDay7 = driftBefore.currentScore - driftBefore.projectedScoreDay7;
  const decayAfterDay7 = driftAfter.currentScore - driftAfter.projectedScoreDay7;
  const decayPrevented = Math.max(0, decayBeforeDay7 - decayAfterDay7);
  const decayPreventedPct = decayBeforeDay7 > 0 ? (decayPrevented / decayBeforeDay7) * 100 : 0;

  // Calculate projection improvement (days of buffer added)
  const daysBefore = driftBefore.daysUntilDanger;
  const daysAfter = driftAfter.daysUntilDanger;
  const projectionImprovement = Math.max(0, daysAfter - daysBefore);

  return {
    scoreDelta,
    memoriesStabilized,
    decayPrevented: Math.round(decayPreventedPct * 10) / 10,
    projectionImprovement,
  };
}

export default {
  calculateRetrievability,
  calculateAggregateRetrievability,
  calculateDriftProjections,
  calculateDriftVector,
  calculateSystemDrift,
  calculateSessionImpact,
  getDriftMessage,
  getDriftStatusLabel,
  retrievabilityToAccuracy,
  accuracyToScore,
  scoreToAccuracy,
};
