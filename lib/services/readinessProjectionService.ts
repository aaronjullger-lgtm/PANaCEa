/**
 * Readiness Projection Service
 *
 * Aggregates FSRS card-level data into exam readiness estimates
 * with calibrated confidence intervals and forward projection.
 *
 * Layers:
 *   Card R,S,D → Topic mastery → Organ system readiness → Overall exam readiness
 *
 * Statistical methods:
 *   - Beta-Binomial posterior for mastery (handles small samples)
 *   - Harmonic mean stability (weakest cards dominate)
 *   - FSRS v6 power-law forward projection
 *   - Blueprint-weighted hierarchical aggregation
 *
 * @see lib/services/panceReadinessService.ts — Heuristic companion (Phase 1)
 * @see lib/constants/blueprint.ts — NCCPA 2025 Blueprint weights
 * @module lib/services/readinessProjectionService
 */

import { NCCPA_2025_BLUEPRINT } from '@/lib/constants/blueprint';

// ─── FSRS v6 Forgetting Curve Constants ───────────────────────────
/** FSRS v6 decay parameter (w[20] default) */
const FSRS_DECAY = -0.5;
/** Derived factor: 0.9^(1/DECAY) - 1 = 19/81 ≈ 0.2346 */
const FSRS_FACTOR = 19 / 81;

// ─── Types ────────────────────────────────────────────────────────

export interface CardState {
  conditionId: string;
  system: string;
  stability: number;
  difficulty: number;
  retrievability: number;
  lastReviewAt: Date;
  totalAttempts: number;
  correctCount: number;
}

export interface TopicReadiness {
  conditionId: string;
  system: string;
  meanRetrievability: number;
  harmonicStability: number;
  masteryEstimate: number;
  masteryCI: [number, number];
  cardCount: number;
}

export interface SystemReadinessProjection {
  system: string;
  blueprintWeight: number;
  currentReadiness: number;
  projectedReadiness: number;
  projectedCI: [number, number];
  weakTopics: string[];
  topicCount: number;
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface ExamReadinessProjection {
  overallReadiness: number;
  projectedAtExam: number;
  confidenceInterval: [number, number];
  estimatedScoreRange: [number, number];
  systems: SystemReadinessProjection[];
  riskLevel: RiskLevel;
  criticalSystems: string[];
  daysUntilExam: number | null;
  projectedAt: string;
}

// ─── Statistical Primitives ───────────────────────────────────────

/**
 * Beta-Binomial posterior for mastery estimation.
 * Handles small sample sizes gracefully via prior shrinkage.
 *
 * @param successes - Number of correct responses
 * @param trials - Total responses
 * @param priorAlpha - Prior alpha (default 1 = uniform)
 * @param priorBeta - Prior beta (default 1 = uniform)
 */
export function betaBinomialPosterior(
  successes: number,
  trials: number,
  priorAlpha: number = 1,
  priorBeta: number = 1
): { mean: number; lower95: number; upper95: number } {
  const alpha = priorAlpha + successes;
  const beta = priorBeta + (trials - successes);
  const mean = alpha / (alpha + beta);

  // Normal approximation for 95% credible interval
  // Var(Beta) = αβ / ((α+β)²(α+β+1))
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const sd = Math.sqrt(variance);
  const z = 1.96;

  return {
    mean,
    lower95: Math.max(0, mean - z * sd),
    upper95: Math.min(1, mean + z * sd),
  };
}

/**
 * Harmonic mean of stability values.
 * Weakest cards dominate — appropriate because topic readiness
 * is bottlenecked by the least stable knowledge.
 */
export function harmonicMeanStability(stabilities: number[]): number {
  const valid = stabilities.filter((s) => s > 0);
  if (valid.length === 0) return 0;
  return valid.length / valid.reduce((sum, s) => sum + 1 / s, 0);
}

/**
 * Project retrievability forward using FSRS v6 power-law forgetting curve.
 * R(t, S) = (1 + FACTOR * t / S) ^ DECAY
 *
 * At t=S: R = (1 + 19/81)^(-0.5) = 0.9 (desired retention)
 */
export function projectRetrievability(
  stability: number,
  elapsedDays: number,
  additionalDays: number = 0
): number {
  if (stability <= 0) return 0;
  const totalElapsed = elapsedDays + additionalDays;
  if (totalElapsed <= 0) return 1;
  return Math.pow(1 + FSRS_FACTOR * totalElapsed / stability, FSRS_DECAY);
}

/**
 * Wilson score confidence interval for a proportion.
 * More robust than normal approximation for small samples.
 */
function wilsonScoreCI(
  successes: number,
  trials: number,
  z: number = 1.96
): [number, number] {
  if (trials === 0) return [0, 1];
  const p = successes / trials;
  const denominator = 1 + z * z / trials;
  const centre = p + z * z / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * trials)) / trials);
  return [
    Math.max(0, (centre - margin) / denominator),
    Math.min(1, (centre + margin) / denominator),
  ];
}

// ─── Aggregation Pipeline ─────────────────────────────────────────

/**
 * Aggregate cards into topic-level readiness.
 */
export function aggregateTopicReadiness(
  conditionId: string,
  system: string,
  cards: CardState[]
): TopicReadiness {
  if (cards.length === 0) {
    return {
      conditionId,
      system,
      meanRetrievability: 0,
      harmonicStability: 0,
      masteryEstimate: 0,
      masteryCI: [0, 0],
      cardCount: 0,
    };
  }

  const meanR =
    cards.reduce((sum, c) => sum + c.retrievability, 0) / cards.length;
  const hStability = harmonicMeanStability(cards.map((c) => c.stability));

  const totalAttempts = cards.reduce((sum, c) => sum + c.totalAttempts, 0);
  const totalCorrect = cards.reduce((sum, c) => sum + c.correctCount, 0);
  const posterior = betaBinomialPosterior(totalCorrect, totalAttempts);

  return {
    conditionId,
    system,
    meanRetrievability: meanR,
    harmonicStability: hStability,
    masteryEstimate: posterior.mean,
    masteryCI: [posterior.lower95, posterior.upper95],
    cardCount: cards.length,
  };
}

/**
 * Aggregate topics into system-level readiness with forward projection.
 */
export function aggregateSystemReadiness(
  system: string,
  topics: TopicReadiness[],
  daysForward: number = 0
): SystemReadinessProjection {
  const blueprintEntry = Object.entries(NCCPA_2025_BLUEPRINT).find(
    ([key]) => key.toLowerCase() === system.toLowerCase()
  );
  const blueprintWeight = blueprintEntry ? (blueprintEntry[1] as number) / 100 : 0.05;

  if (topics.length === 0) {
    return {
      system,
      blueprintWeight,
      currentReadiness: 0,
      projectedReadiness: 0,
      projectedCI: [0, 0],
      weakTopics: [],
      topicCount: 0,
    };
  }

  // Weight topics by card count
  const totalCards = topics.reduce((sum, t) => sum + t.cardCount, 0);
  const currentReadiness = totalCards > 0
    ? topics.reduce((sum, t) => sum + t.meanRetrievability * t.cardCount, 0) / totalCards
    : 0;

  // Project forward using harmonic stability across topics
  const systemHarmonicS = harmonicMeanStability(
    topics.filter((t) => t.harmonicStability > 0).map((t) => t.harmonicStability)
  );
  const currentElapsed = 0; // Assume R values are current
  const projectedR = systemHarmonicS > 0
    ? projectRetrievability(systemHarmonicS, currentElapsed, daysForward)
    : currentReadiness * 0.5; // Rough decay for unmeasured

  // Aggregate mastery CIs
  const totalAttempts = topics.reduce((sum, t) => {
    const cards = t.cardCount;
    return sum + cards;
  }, 0);
  const avgMastery = topics.reduce((sum, t) => sum + t.masteryEstimate * t.cardCount, 0) / Math.max(totalCards, 1);
  const ci = wilsonScoreCI(
    Math.round(avgMastery * totalAttempts),
    totalAttempts
  );

  // Projected CI accounts for decay uncertainty
  const decayUncertainty = daysForward > 0 ? 0.05 * Math.sqrt(daysForward / 30) : 0;
  const projectedCI: [number, number] = [
    Math.max(0, ci[0] * (projectedR / Math.max(currentReadiness, 0.01)) - decayUncertainty),
    Math.min(1, ci[1] * (projectedR / Math.max(currentReadiness, 0.01)) + decayUncertainty),
  ];

  const WEAK_THRESHOLD = 0.60;
  const weakTopics = topics
    .filter((t) => t.meanRetrievability < WEAK_THRESHOLD)
    .map((t) => t.conditionId);

  return {
    system,
    blueprintWeight,
    currentReadiness,
    projectedReadiness: Math.min(1, Math.max(0, projectedR)),
    projectedCI,
    weakTopics,
    topicCount: topics.length,
  };
}

/**
 * Compute full exam readiness projection from card-level data.
 */
export function computeExamReadiness(
  cards: CardState[],
  daysUntilExam: number | null = null
): ExamReadinessProjection {
  // Group cards by system → condition
  const systemMap = new Map<string, Map<string, CardState[]>>();
  for (const card of cards) {
    if (!systemMap.has(card.system)) systemMap.set(card.system, new Map());
    const condMap = systemMap.get(card.system)!;
    if (!condMap.has(card.conditionId)) condMap.set(card.conditionId, []);
    condMap.get(card.conditionId)!.push(card);
  }

  // Aggregate per system
  const systemResults: SystemReadinessProjection[] = [];
  for (const [system, condMap] of systemMap) {
    const topics: TopicReadiness[] = [];
    for (const [condId, condCards] of condMap) {
      topics.push(aggregateTopicReadiness(condId, system, condCards));
    }
    systemResults.push(
      aggregateSystemReadiness(system, topics, daysUntilExam ?? 0)
    );
  }

  // Blueprint-weighted overall readiness
  const totalWeight = systemResults.reduce((sum, s) => sum + s.blueprintWeight, 0);
  const overallCurrent = totalWeight > 0
    ? systemResults.reduce((sum, s) => sum + s.currentReadiness * s.blueprintWeight, 0) / totalWeight
    : 0;
  const overallProjected = totalWeight > 0
    ? systemResults.reduce((sum, s) => sum + s.projectedReadiness * s.blueprintWeight, 0) / totalWeight
    : 0;

  // Aggregate CI
  const ciLower = totalWeight > 0
    ? systemResults.reduce((sum, s) => sum + s.projectedCI[0] * s.blueprintWeight, 0) / totalWeight
    : 0;
  const ciUpper = totalWeight > 0
    ? systemResults.reduce((sum, s) => sum + s.projectedCI[1] * s.blueprintWeight, 0) / totalWeight
    : 1;

  // PANCE score mapping: readiness 0-1 → score 300-800
  const scoreCenter = 300 + 500 * overallProjected;
  const scoreRange: [number, number] = [
    Math.max(300, Math.round(300 + 500 * ciLower)),
    Math.min(800, Math.round(300 + 500 * ciUpper)),
  ];

  // Risk assessment
  const criticalSystems = systemResults
    .filter((s) => s.currentReadiness < 0.40)
    .map((s) => s.system);

  const { level: riskLevel } = detectRisk(
    overallProjected,
    criticalSystems.length,
    systemResults
  );

  return {
    overallReadiness: overallCurrent,
    projectedAtExam: overallProjected,
    confidenceInterval: [ciLower, ciUpper],
    estimatedScoreRange: scoreRange,
    systems: systemResults,
    riskLevel,
    criticalSystems,
    daysUntilExam,
    projectedAt: new Date().toISOString(),
  };
}

/**
 * Detect risk level based on readiness metrics.
 */
export function detectRisk(
  projectedReadiness: number,
  criticalSystemCount: number,
  systems: SystemReadinessProjection[]
): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];

  const belowHalf = systems.filter((s) => s.currentReadiness < 0.50).length;

  if (criticalSystemCount > 0) {
    reasons.push(`${criticalSystemCount} system(s) below 40% readiness`);
  }
  if (belowHalf > 2) {
    reasons.push(`${belowHalf} systems below 50% readiness`);
  }
  if (projectedReadiness < 0.65) {
    reasons.push(`Projected readiness ${(projectedReadiness * 100).toFixed(0)}% is below 65% threshold`);
  }
  if (projectedReadiness < 0.80 && projectedReadiness >= 0.65) {
    reasons.push(`Projected readiness ${(projectedReadiness * 100).toFixed(0)}% is below 80% target`);
  }

  let level: RiskLevel = 'low';
  if (criticalSystemCount > 0 || projectedReadiness < 0.50) {
    level = 'critical';
  } else if (projectedReadiness < 0.65 || belowHalf > 2) {
    level = 'high';
  } else if (projectedReadiness < 0.80) {
    level = 'moderate';
  }

  return { level, reasons };
}

// ─── Sprint 24: Forgetting Curve Projection to Exam Date ────────────

/**
 * Per-system intervention plan for reaching target readiness by exam.
 */
export interface SystemIntervention {
  system: string;
  currentReadiness: number;
  projectedAtExam: number;
  targetReadiness: number;
  /** Estimated additional reviews needed to reach target */
  reviewsNeeded: number;
  /** Daily review pace required to finish before exam */
  dailyReviewPace: number;
  /** Whether the target is achievable at realistic daily pace */
  achievable: boolean;
  /** Risk level for this system */
  risk: RiskLevel;
}

/**
 * Exam countdown projection.
 */
export interface ExamCountdownProjection {
  daysUntilExam: number;
  /** If you stop studying today */
  projectedScoreIfStop: number;
  /** If you maintain current pace */
  projectedScoreCurrentPace: number;
  /** Per-system intervention plan */
  interventions: SystemIntervention[];
  /** Total additional reviews needed across all systems */
  totalReviewsNeeded: number;
  /** Overall daily pace to hit 0.85 target */
  overallDailyPace: number;
}

/**
 * Project forgetting curves to exam date and generate intervention plans.
 *
 * For each system, computes:
 *   - Retrievability at exam date using FSRS power-law decay (no more study)
 *   - Reviews needed to push each card's stability high enough to survive to exam
 *   - Required daily pace to complete all reviews before exam
 *
 * @param cards All user cards with stability and elapsed days
 * @param daysUntilExam Days until the exam
 * @param targetReadiness Target readiness at exam (default 0.85)
 * @param avgReviewsPerDay Current average reviews per day (for pace comparison)
 */
export function projectToExamDate(
  cards: CardState[],
  daysUntilExam: number,
  targetReadiness: number = 0.85,
  avgReviewsPerDay: number = 20
): ExamCountdownProjection {
  if (daysUntilExam <= 0) {
    // Exam is today or past
    const current = computeExamReadiness(cards, 0);
    return {
      daysUntilExam: 0,
      projectedScoreIfStop: 300 + 500 * current.overallReadiness,
      projectedScoreCurrentPace: 300 + 500 * current.overallReadiness,
      interventions: [],
      totalReviewsNeeded: 0,
      overallDailyPace: 0,
    };
  }

  // Group cards by system
  const systemCards = new Map<string, CardState[]>();
  for (const card of cards) {
    if (!systemCards.has(card.system)) systemCards.set(card.system, []);
    systemCards.get(card.system)!.push(card);
  }

  // Compute "if stop" scenario — project all cards forward by daysUntilExam
  let weightedStopReadiness = 0;
  let totalWeight = 0;

  const interventions: SystemIntervention[] = [];

  for (const [system, sCards] of systemCards) {
    // Current readiness
    const currentRetrievabilities = sCards.map((c) =>
      projectRetrievability(c.stability, c.elapsedDays)
    );
    const currentReadiness = currentRetrievabilities.length > 0
      ? currentRetrievabilities.reduce((s, r) => s + r, 0) / currentRetrievabilities.length
      : 0;

    // Projected readiness at exam (no more study)
    const stopRetrievabilities = sCards.map((c) =>
      projectRetrievability(c.stability, c.elapsedDays, daysUntilExam)
    );
    const stopReadiness = stopRetrievabilities.length > 0
      ? stopRetrievabilities.reduce((s, r) => s + r, 0) / stopRetrievabilities.length
      : 0;

    // How many reviews needed?
    // Each review roughly doubles stability. We need each card's retrievability
    // at exam date to be ≥ targetReadiness.
    let reviewsNeeded = 0;
    for (let i = 0; i < sCards.length; i++) {
      const card = sCards[i]!;
      const examR = stopRetrievabilities[i]!;
      if (examR < targetReadiness) {
        // How much must stability increase so R(daysUntilExam) ≥ target?
        // R = (1 + F * t / S)^D ≥ target
        // S ≥ F * t / (target^(1/D) - 1)
        const targetInverse = Math.pow(targetReadiness, 1 / FSRS_DECAY) - 1;
        if (targetInverse > 0) {
          const requiredStability = (FSRS_FACTOR * (card.elapsedDays + daysUntilExam)) / targetInverse;
          const stabilityGap = requiredStability - card.stability;
          if (stabilityGap > 0) {
            // Rough model: each successful review multiplies stability by ~2.5
            const reviewsForCard = Math.ceil(Math.log(requiredStability / Math.max(card.stability, 0.1)) / Math.log(2.5));
            reviewsNeeded += Math.max(0, reviewsForCard);
          }
        }
      }
    }

    const dailyReviewPace = daysUntilExam > 0 ? reviewsNeeded / daysUntilExam : reviewsNeeded;
    const achievable = dailyReviewPace <= avgReviewsPerDay * 1.5; // 1.5× current pace is realistic
    const bpWeight = sCards.length; // proxy for blueprint weight

    const risk: RiskLevel = stopReadiness < 0.4 ? 'critical'
      : stopReadiness < 0.6 ? 'high'
      : stopReadiness < 0.8 ? 'moderate'
      : 'low';

    interventions.push({
      system,
      currentReadiness,
      projectedAtExam: stopReadiness,
      targetReadiness,
      reviewsNeeded,
      dailyReviewPace: Math.round(dailyReviewPace * 10) / 10,
      achievable,
      risk,
    });

    weightedStopReadiness += stopReadiness * bpWeight;
    totalWeight += bpWeight;
  }

  // Sort interventions: most urgent first
  interventions.sort((a, b) => a.projectedAtExam - b.projectedAtExam);

  const overallStopReadiness = totalWeight > 0 ? weightedStopReadiness / totalWeight : 0;
  const projectedScoreIfStop = Math.round(300 + 500 * overallStopReadiness);

  // "Current pace" projection: assume daily reviews maintain current readiness
  const currentExam = computeExamReadiness(cards, daysUntilExam);
  const projectedScoreCurrentPace = Math.round(300 + 500 * currentExam.projectedAtExam);

  const totalReviewsNeeded = interventions.reduce((s, i) => s + i.reviewsNeeded, 0);
  const overallDailyPace = daysUntilExam > 0
    ? Math.round((totalReviewsNeeded / daysUntilExam) * 10) / 10
    : 0;

  return {
    daysUntilExam,
    projectedScoreIfStop,
    projectedScoreCurrentPace,
    interventions,
    totalReviewsNeeded,
    overallDailyPace,
  };
}
