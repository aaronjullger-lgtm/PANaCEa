/**
 * Daily Study Load Recommendation Service
 *
 * Determines optimal daily study volume (new cards + reviews) personalized
 * to the learner's capacity, fatigue, and blueprint coverage gaps.
 *
 * Research basis:
 *   - Kornell (2009): 15–20 new items/day optimal for long-term retention
 *   - Cepeda et al. (2006): Distributed practice > massed practice
 *   - Rohrer & Taylor (2007): Interleaving improves discriminative contrast
 *
 * The service balances three competing pressures:
 *   1. Review debt: overdue cards must be reviewed to prevent forgetting
 *   2. New card intake: steady flow of new material for blueprint coverage
 *   3. Fatigue: burnout prevention via load capping
 *
 * Architecture:
 *   Pure computation — no database access. Caller provides learner metrics.
 *   Output feeds into reservoir policy and dashboard "Today's Plan" widget.
 *
 * Sprint 20 — Daily study load recommendations
 * @module lib/services/dailyLoadRecommendationService
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** Input metrics for load recommendation */
export interface LearnerLoadProfile {
  /** Average daily questions over last 30 days */
  avgDailyQuestions: number;
  /** Standard deviation of daily questions */
  dailyQuestionStdDev: number;
  /** Cards due for review today */
  reviewsDueToday: number;
  /** Cards becoming due in next 24h */
  reviewsDueNext24h: number;
  /** Total overdue reviews (past due date) */
  overdueReviews: number;
  /** Burnout risk from UserStudyPhenotype (0-1) */
  burnoutRisk: number;
  /** Current streak length (days) */
  currentStreak: number;
  /** Average accuracy over last 50 questions */
  recentAccuracy: number;
  /** Average time per question in ms */
  avgTimePerQuestionMs: number;
  /** Blueprint systems with coverage fraction (0-1) */
  systemCoverage: Record<string, number>;
  /** Blueprint weights per system */
  blueprintWeights: Record<string, number>;
  /** Days until exam (null if no exam date set) */
  daysUntilExam: number | null;
  /** Questions completed today so far */
  questionsCompletedToday: number;
  /** User's preferred daily goal (if set) */
  userDailyGoal: number | null;
}

/** A recommended study load for today */
export interface DailyLoadRecommendation {
  /** Total recommended questions today */
  totalRecommended: number;
  /** How many should be reviews of due/overdue cards */
  reviewCount: number;
  /** How many should be new cards */
  newCardCount: number;
  /** Remaining to do today (total - completed) */
  remaining: number;
  /** System priority order for new cards */
  systemPriority: SystemPriority[];
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  /** Human-readable rationale */
  rationale: string;
  /** Load intensity label */
  intensity: 'light' | 'moderate' | 'heavy' | 'recovery';
  /** Warning if user is overloading */
  overloadWarning: string | null;
}

/** Priority ordering for which systems to study */
export interface SystemPriority {
  system: string;
  /** Blueprint weight for this system */
  blueprintWeight: number;
  /** Current coverage fraction (0-1) */
  coverage: number;
  /** Gap = blueprintWeight - proportional coverage */
  gap: number;
  /** Recommended number of new cards from this system */
  recommendedNewCards: number;
}

/** Configuration constants */
export interface LoadConfig {
  /** Base new cards per day at zero fatigue */
  baseNewCardsPerDay: number;
  /** Maximum new cards per day (hard cap) */
  maxNewCardsPerDay: number;
  /** Maximum total questions per day */
  maxTotalPerDay: number;
  /** Minimum reviews before new cards are introduced */
  minReviewsFirst: number;
  /** Review-to-new ratio target */
  reviewToNewRatio: number;
  /** Burnout risk threshold to trigger recovery mode */
  burnoutThreshold: number;
  /** Accuracy threshold below which to reduce new cards */
  accuracyFloor: number;
  /** Exam proximity boost start (days) */
  examProximityDays: number;
}

export const DEFAULT_LOAD_CONFIG: LoadConfig = {
  baseNewCardsPerDay: 18,
  maxNewCardsPerDay: 30,
  maxTotalPerDay: 120,
  minReviewsFirst: 5,
  reviewToNewRatio: 3.0, // 3 reviews per 1 new card
  burnoutThreshold: 0.7,
  accuracyFloor: 0.55,
  examProximityDays: 60,
};

// ─── Core Algorithm ─────────────────────────────────────────────────────

/**
 * Compute the recommended daily study load.
 *
 * Algorithm:
 *   1. Start with base capacity (historical average or default 18)
 *   2. Adjust for burnout risk (scale down if fatigued)
 *   3. Allocate reviews first (overdue > due today > upcoming)
 *   4. Fill remaining capacity with new cards
 *   5. Apply exam proximity boost if applicable
 *   6. Prioritize new cards by blueprint gap
 */
export function recommendDailyLoad(
  profile: LearnerLoadProfile,
  config: LoadConfig = DEFAULT_LOAD_CONFIG
): DailyLoadRecommendation {
  // Step 1: Determine base capacity
  const historicalBase = profile.avgDailyQuestions > 0
    ? profile.avgDailyQuestions
    : config.baseNewCardsPerDay;
  // Use 1.2× historical average as ceiling, but not below base
  const capacityCeiling = Math.max(
    config.baseNewCardsPerDay,
    Math.round(historicalBase * 1.2)
  );

  // Step 2: Burnout adjustment
  let adjustedCapacity = capacityCeiling;
  let intensity: DailyLoadRecommendation['intensity'] = 'moderate';
  let overloadWarning: string | null = null;

  if (profile.burnoutRisk >= config.burnoutThreshold) {
    // Recovery mode: 60% of normal capacity
    adjustedCapacity = Math.round(capacityCeiling * 0.6);
    intensity = 'recovery';
    overloadWarning = `Burnout risk elevated (${Math.round(profile.burnoutRisk * 100)}%). Reducing load to prevent fatigue.`;
  } else if (profile.burnoutRisk >= config.burnoutThreshold * 0.7) {
    // Light mode: 80% capacity
    adjustedCapacity = Math.round(capacityCeiling * 0.8);
    intensity = 'light';
  }

  // Step 3: Accuracy gate — if struggling, reduce new cards
  const accuracyPenalty = profile.recentAccuracy < config.accuracyFloor
    ? 0.5 // halve new cards if accuracy is too low
    : profile.recentAccuracy < 0.65
      ? 0.75
      : 1.0;

  // Step 4: Exam proximity boost
  let examBoost = 1.0;
  if (profile.daysUntilExam != null && profile.daysUntilExam <= config.examProximityDays) {
    // Linear ramp from 1.0 to 1.3 as exam approaches
    const proximity = 1 - (profile.daysUntilExam / config.examProximityDays);
    examBoost = 1.0 + (0.3 * proximity);
  }

  // Step 5: Allocate reviews first
  const totalReviews = profile.overdueReviews + profile.reviewsDueToday;
  const reviewCount = Math.min(totalReviews, adjustedCapacity);

  // Step 6: Remaining capacity for new cards
  const remainingAfterReviews = Math.max(0, adjustedCapacity - reviewCount);
  const rawNewCards = Math.round(
    Math.min(
      remainingAfterReviews,
      config.baseNewCardsPerDay * accuracyPenalty * examBoost
    )
  );
  const newCardCount = Math.min(rawNewCards, config.maxNewCardsPerDay);

  // Step 7: Final total (capped)
  const totalRecommended = Math.min(
    reviewCount + newCardCount,
    config.maxTotalPerDay
  );
  const remaining = Math.max(0, totalRecommended - profile.questionsCompletedToday);

  // Step 8: Determine intensity
  if (intensity !== 'recovery') {
    const ratio = totalRecommended / Math.max(historicalBase, 1);
    if (ratio > 1.3) intensity = 'heavy';
    else if (ratio > 0.8) intensity = 'moderate';
    else intensity = 'light';
  }

  // Step 9: System priority for new cards
  const systemPriority = computeSystemPriority(
    profile.systemCoverage,
    profile.blueprintWeights,
    newCardCount
  );

  // Step 10: Rationale
  const rationale = buildRationale(
    totalRecommended,
    reviewCount,
    newCardCount,
    profile,
    intensity
  );

  // Confidence based on data quality
  const confidence = computeConfidence(profile);

  return {
    totalRecommended,
    reviewCount,
    newCardCount,
    remaining,
    systemPriority,
    confidence,
    rationale,
    intensity,
    overloadWarning,
  };
}

// ─── System Priority ────────────────────────────────────────────────────

/**
 * Rank systems by blueprint coverage gap and allocate new cards proportionally.
 */
export function computeSystemPriority(
  systemCoverage: Record<string, number>,
  blueprintWeights: Record<string, number>,
  totalNewCards: number
): SystemPriority[] {
  const systems = Object.keys(blueprintWeights);
  if (systems.length === 0) return [];

  // Compute total blueprint weight for normalization
  const totalWeight = Object.values(blueprintWeights).reduce((s, w) => s + w, 0) || 1;

  // Compute gap for each system
  const withGaps = systems.map((system) => {
    const weight = blueprintWeights[system] ?? 0;
    const coverage = systemCoverage[system] ?? 0;
    const proportionalWeight = weight / totalWeight;
    // Gap = how far behind this system is relative to its blueprint importance
    const gap = Math.max(0, proportionalWeight - coverage * proportionalWeight);
    return { system, blueprintWeight: weight, coverage, gap };
  });

  // Sort by gap descending (biggest gaps first)
  withGaps.sort((a, b) => b.gap - a.gap);

  // Allocate new cards proportionally to gap
  const totalGap = withGaps.reduce((s, w) => s + w.gap, 0) || 1;
  let allocated = 0;

  const result: SystemPriority[] = withGaps.map((entry) => {
    const proportion = entry.gap / totalGap;
    const recommended = Math.round(proportion * totalNewCards);
    const capped = Math.min(recommended, totalNewCards - allocated);
    allocated += capped;
    return {
      ...entry,
      recommendedNewCards: capped,
    };
  });

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function computeConfidence(profile: LearnerLoadProfile): number {
  let confidence = 0.5;

  // More historical data → higher confidence
  if (profile.avgDailyQuestions > 0) confidence += 0.2;
  if (profile.dailyQuestionStdDev < profile.avgDailyQuestions * 0.5) confidence += 0.1;

  // Exam date set → higher confidence in urgency weighting
  if (profile.daysUntilExam != null) confidence += 0.1;

  // Blueprint weights available → better system prioritization
  if (Object.keys(profile.blueprintWeights).length > 5) confidence += 0.1;

  return Math.min(1, confidence);
}

function buildRationale(
  total: number,
  reviews: number,
  newCards: number,
  profile: LearnerLoadProfile,
  intensity: DailyLoadRecommendation['intensity']
): string {
  const parts: string[] = [];

  if (intensity === 'recovery') {
    parts.push('Recovery mode active due to elevated burnout risk.');
  }

  if (profile.overdueReviews > 0) {
    parts.push(`${profile.overdueReviews} overdue reviews need attention.`);
  }

  if (reviews > 0) {
    parts.push(`${reviews} reviews to maintain retention.`);
  }

  if (newCards > 0) {
    parts.push(`${newCards} new cards for blueprint coverage.`);
  }

  if (profile.daysUntilExam != null && profile.daysUntilExam <= 60) {
    parts.push(`Exam in ${profile.daysUntilExam} days — pace slightly increased.`);
  }

  if (profile.recentAccuracy < 0.55) {
    parts.push('Accuracy below target — new card intake reduced to focus on mastery.');
  }

  return parts.join(' ') || `${total} questions recommended today.`;
}
