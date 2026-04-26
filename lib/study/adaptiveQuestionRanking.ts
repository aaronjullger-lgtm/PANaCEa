/**
 * Adaptive question ranking helpers.
 *
 * This module is intentionally pure and deterministic so every study mode can
 * reuse the same ranking behavior without hiding logic inside the selector.
 * The selector is responsible for fetching candidate questions; this file is
 * responsible for turning existing study history into explainable priorities.
 */

export type AdaptiveQuestionSource = 'due_review' | 'new_card' | 'missed_resurface';

export interface AdaptiveProgressSignal {
  conditionId: string;
  system?: string | null;
  nextReviewAt?: Date | null;
  stability?: number | null;
  accuracy?: number | null;
  totalAttempts?: number | null;
  correctCount?: number | null;
}

export interface AdaptiveConditionAccuracySignal {
  conditionId: string;
  attemptCount: number;
  correctCount: number;
  lastAttemptedAt?: Date | null;
}

export interface AdaptiveReviewSignal {
  conditionId?: string | null;
  system?: string | null;
  wasCorrect: boolean;
  reviewedAt: Date;
}

export interface AdaptiveAttemptSignal {
  questionId: string;
  conditionId?: string | null;
  system?: string | null;
  wasCorrect: boolean;
  createdAt: Date;
}

export interface AdaptiveProfileInput {
  now?: Date;
  progress: AdaptiveProgressSignal[];
  conditionAccuracy: AdaptiveConditionAccuracySignal[];
  reviewSignals: AdaptiveReviewSignal[];
  attemptSignals: AdaptiveAttemptSignal[];
}

export interface AdaptiveQuestionProfile {
  questionId: string;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  lastAttemptAt: Date | null;
  lastCorrectAt: Date | null;
  lastIncorrectAt: Date | null;
  resurfacingEligible: boolean;
  resurfacingUrgency: number;
  overexposureScore: number;
}

export interface AdaptiveConditionProfile {
  conditionId: string;
  system: string;
  totalAttempts: number;
  correctAttempts: number;
  recentAttempts: number;
  recentCorrect: number;
  recentAccuracy: number | null;
  overallAccuracy: number | null;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lastAttemptAt: Date | null;
  lastCorrectAt: Date | null;
  lastIncorrectAt: Date | null;
  dueNow: boolean;
  overdueDays: number;
  nextReviewAt: Date | null;
  stability: number | null;
  masteryScore: number;
  growthScore: number;
  weaknessScore: number;
  mastered: boolean;
}

export interface AdaptiveSystemProfile {
  system: string;
  totalAttempts: number;
  recentAttempts: number;
  recentAccuracy: number | null;
  dueCount: number;
  overdueCount: number;
  masteredConditions: number;
  trackedConditions: number;
  weaknessScore: number;
  growthScore: number;
  overexposureScore: number;
}

export interface AdaptiveProfileSnapshot {
  generatedAt: Date;
  systems: Record<string, AdaptiveSystemProfile>;
  conditions: Record<string, AdaptiveConditionProfile>;
  questions: Record<string, AdaptiveQuestionProfile>;
}

export interface AdaptiveCandidateDescriptor {
  questionId: string;
  system?: string | null;
  conditionId?: string | null;
  source: AdaptiveQuestionSource;
  blueprintWeight?: number;
  overdueDays?: number;
}

export interface AdaptiveCandidateScore {
  total: number;
  breakdown: {
    blueprint: number;
    systemWeakness: number;
    conditionWeakness: number;
    growth: number;
    overdue: number;
    resurfacing: number;
    masteryPenalty: number;
    overexposurePenalty: number;
    exposurePenalty: number;
    unseenBonus: number;
  };
}

export interface AdaptiveScoredCandidate<T extends AdaptiveCandidateDescriptor> {
  candidate: T;
  score: AdaptiveCandidateScore;
}

export interface AdaptiveSystemAllocationInput {
  totalCount: number;
  blueprintWeights: Record<string, number>;
  systems: string[];
  snapshot: AdaptiveProfileSnapshot;
  boostSystems?: string[];
  suppressSystems?: string[];
  perSystemCaps?: Record<string, number>;
  maxSingleSystemFraction?: number;
}

const DEFAULT_SYSTEM = 'Unknown';
const RECENT_SIGNAL_WINDOW = 5;
const DEFAULT_UNKNOWN_ACCURACY = 0.55;
const MASTERY_MIN_ATTEMPTS = 5;
const MASTERY_STABILITY_DAYS = 21;
const RESURFACE_DELAY_HOURS = 8;
const RESURFACE_WINDOW_DAYS = 14;

type MutableConditionState = {
  conditionId: string;
  system: string;
  totalAttempts: number;
  correctAttempts: number;
  recentAttempts: number;
  recentCorrect: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  lastAttemptAt: Date | null;
  lastCorrectAt: Date | null;
  lastIncorrectAt: Date | null;
  dueNow: boolean;
  overdueDays: number;
  nextReviewAt: Date | null;
  stability: number | null;
  progressAccuracy: number | null;
};

function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeSystem(system?: string | null): string {
  return system?.trim() || DEFAULT_SYSTEM;
}

function sortDescendingByDate<T extends { at: Date; wasCorrect: boolean }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.at.getTime() - left.at.getTime());
}

function getRecentAccuracy(correct: number, attempts: number): number | null {
  return attempts > 0 ? correct / attempts : null;
}

function getOverallAccuracy(correct: number, attempts: number): number | null {
  return attempts > 0 ? correct / attempts : null;
}

function buildRecentSequence(
  reviewSignals: AdaptiveReviewSignal[],
  attemptSignals: AdaptiveAttemptSignal[]
): Array<{ at: Date; wasCorrect: boolean }> {
  if (reviewSignals.length > 0) {
    return sortDescendingByDate(
      reviewSignals
        .filter((signal): signal is AdaptiveReviewSignal & { conditionId: string } => Boolean(signal.conditionId))
        .map((signal) => ({
          at: signal.reviewedAt,
          wasCorrect: signal.wasCorrect,
        }))
    );
  }

  return sortDescendingByDate(
    attemptSignals.map((signal) => ({
      at: signal.createdAt,
      wasCorrect: signal.wasCorrect,
    }))
  );
}

function applySequenceSignals(
  state: MutableConditionState,
  sequence: Array<{ at: Date; wasCorrect: boolean }>
): void {
  if (sequence.length === 0) return;

  state.lastAttemptAt = sequence[0]?.at ?? state.lastAttemptAt;

  const recent = sequence.slice(0, RECENT_SIGNAL_WINDOW);
  state.recentAttempts = recent.length;
  state.recentCorrect = recent.filter((signal) => signal.wasCorrect).length;

  for (const signal of sequence) {
    if (!state.lastCorrectAt && signal.wasCorrect) {
      state.lastCorrectAt = signal.at;
    }
    if (!state.lastIncorrectAt && !signal.wasCorrect) {
      state.lastIncorrectAt = signal.at;
    }
  }

  for (const signal of sequence) {
    if (signal.wasCorrect) {
      state.consecutiveCorrect += 1;
      if (state.consecutiveIncorrect > 0) break;
    } else {
      break;
    }
  }

  for (const signal of sequence) {
    if (!signal.wasCorrect) {
      state.consecutiveIncorrect += 1;
      if (state.consecutiveCorrect > 0) break;
    } else {
      break;
    }
  }
}

function computeConditionProfile(
  state: MutableConditionState
): AdaptiveConditionProfile {
  const totalAttempts = Math.max(0, state.totalAttempts);
  const correctAttempts = Math.max(0, state.correctAttempts);
  const overallAccuracy =
    state.progressAccuracy ?? getOverallAccuracy(correctAttempts, totalAttempts);
  const recentAccuracy = getRecentAccuracy(state.recentCorrect, state.recentAttempts);
  const accuracyForScoring = recentAccuracy ?? overallAccuracy ?? DEFAULT_UNKNOWN_ACCURACY;
  const stability = state.stability ?? null;
  const duePressure = state.dueNow ? clamp(Math.max(0.25, state.overdueDays / 7)) : 0;
  const lowStability =
    stability == null ? 0.35 : 1 - clamp(stability / 14);
  const incorrectPressure = clamp(state.consecutiveIncorrect / 3);
  const masteryConfidence = clamp(totalAttempts / 8);
  const stabilityMastery = stability == null ? 0 : clamp(stability / MASTERY_STABILITY_DAYS);
  const streakMastery = clamp(state.consecutiveCorrect / 3);
  const baseMastery = clamp(
    0.5 * (overallAccuracy ?? DEFAULT_UNKNOWN_ACCURACY) +
      0.3 * stabilityMastery +
      0.2 * streakMastery
  );
  const masteryScore =
    totalAttempts >= MASTERY_MIN_ATTEMPTS ? baseMastery : baseMastery * (0.5 + 0.5 * masteryConfidence);
  const mastered =
    totalAttempts >= MASTERY_MIN_ATTEMPTS &&
    (overallAccuracy ?? 0) >= 0.85 &&
    (stabilityMastery >= 1 || state.consecutiveCorrect >= 2);
  const weaknessScore = totalAttempts === 0
    ? 0.35
    : clamp(
        0.45 * (1 - accuracyForScoring) +
          0.25 * duePressure +
          0.2 * incorrectPressure +
          0.1 * lowStability
      );
  const closenessToGrowthBand = 1 - clamp(Math.abs(accuracyForScoring - 0.72) / 0.45);
  const growthScore = mastered
    ? 0.1
    : totalAttempts === 0
      ? 0.3
      : clamp(0.2 + 0.5 * closenessToGrowthBand + 0.3 * clamp(totalAttempts / 8));

  return {
    conditionId: state.conditionId,
    system: state.system,
    totalAttempts,
    correctAttempts,
    recentAttempts: state.recentAttempts,
    recentCorrect: state.recentCorrect,
    recentAccuracy,
    overallAccuracy,
    consecutiveCorrect: state.consecutiveCorrect,
    consecutiveIncorrect: state.consecutiveIncorrect,
    lastAttemptAt: state.lastAttemptAt,
    lastCorrectAt: state.lastCorrectAt,
    lastIncorrectAt: state.lastIncorrectAt,
    dueNow: state.dueNow,
    overdueDays: state.overdueDays,
    nextReviewAt: state.nextReviewAt,
    stability,
    masteryScore,
    growthScore,
    weaknessScore,
    mastered,
  };
}

function computeSystemProfile(
  system: string,
  conditions: AdaptiveConditionProfile[]
): AdaptiveSystemProfile {
  const trackedConditions = conditions.length;
  const totalAttempts = conditions.reduce((sum, condition) => sum + condition.totalAttempts, 0);
  const recentAttempts = conditions.reduce((sum, condition) => sum + condition.recentAttempts, 0);
  const recentCorrect = conditions.reduce((sum, condition) => sum + condition.recentCorrect, 0);
  const recentAccuracy = getRecentAccuracy(recentCorrect, recentAttempts);
  const dueCount = conditions.filter((condition) => condition.dueNow).length;
  const overdueCount = conditions.filter((condition) => condition.overdueDays > 0).length;
  const masteredConditions = conditions.filter((condition) => condition.mastered).length;
  const masteryRate = trackedConditions > 0 ? masteredConditions / trackedConditions : 0;
  const avgWeakness =
    trackedConditions > 0
      ? conditions.reduce((sum, condition) => sum + condition.weaknessScore, 0) / trackedConditions
      : 0.35;
  const avgGrowth =
    trackedConditions > 0
      ? conditions.reduce((sum, condition) => sum + condition.growthScore, 0) / trackedConditions
      : 0.3;
  const duePressure = trackedConditions > 0 ? dueCount / trackedConditions : 0;
  const weaknessScore = clamp(
    0.55 * avgWeakness +
      0.2 * (1 - (recentAccuracy ?? DEFAULT_UNKNOWN_ACCURACY)) +
      0.15 * duePressure -
      0.1 * masteryRate
  );
  const overexposureScore = clamp(
    0.65 * masteryRate + 0.35 * (recentAccuracy ?? DEFAULT_UNKNOWN_ACCURACY)
  );

  return {
    system,
    totalAttempts,
    recentAttempts,
    recentAccuracy,
    dueCount,
    overdueCount,
    masteredConditions,
    trackedConditions,
    weaknessScore,
    growthScore: avgGrowth,
    overexposureScore,
  };
}

function computeQuestionProfile(
  questionId: string,
  attempts: AdaptiveAttemptSignal[],
  now: Date
): AdaptiveQuestionProfile {
  const ordered = [...attempts].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const totalAttempts = ordered.length;
  const correctAttempts = ordered.filter((attempt) => attempt.wasCorrect).length;
  const incorrectAttempts = totalAttempts - correctAttempts;
  const lastAttemptAt = ordered[0]?.createdAt ?? null;
  const lastCorrectAt = ordered.find((attempt) => attempt.wasCorrect)?.createdAt ?? null;
  const lastIncorrectAt = ordered.find((attempt) => !attempt.wasCorrect)?.createdAt ?? null;
  const hoursSinceMiss = lastIncorrectAt
    ? (now.getTime() - lastIncorrectAt.getTime()) / (1000 * 60 * 60)
    : Infinity;
  const recovered =
    lastIncorrectAt != null &&
    lastCorrectAt != null &&
    lastCorrectAt.getTime() > lastIncorrectAt.getTime();
  const resurfacingEligible =
    Boolean(lastIncorrectAt) &&
    !recovered &&
    hoursSinceMiss >= RESURFACE_DELAY_HOURS &&
    hoursSinceMiss <= RESURFACE_WINDOW_DAYS * 24;
  const freshness = resurfacingEligible
    ? 1 -
      clamp(
        (hoursSinceMiss - RESURFACE_DELAY_HOURS) /
          (RESURFACE_WINDOW_DAYS * 24 - RESURFACE_DELAY_HOURS)
      )
    : 0;
  const resurfacingUrgency = resurfacingEligible
    ? clamp(0.7 * freshness + 0.3 * clamp(incorrectAttempts / 3))
    : 0;

  return {
    questionId,
    totalAttempts,
    correctAttempts,
    incorrectAttempts,
    lastAttemptAt,
    lastCorrectAt,
    lastIncorrectAt,
    resurfacingEligible,
    resurfacingUrgency,
    overexposureScore: clamp(Math.max(0, totalAttempts - 1) / 6),
  };
}

export function buildAdaptiveProfileSnapshot(
  input: AdaptiveProfileInput
): AdaptiveProfileSnapshot {
  const now = input.now ?? new Date();
  const conditionStates = new Map<string, MutableConditionState>();

  const ensureConditionState = (conditionId: string, system?: string | null): MutableConditionState => {
    const existing = conditionStates.get(conditionId);
    if (existing) {
      if (existing.system === DEFAULT_SYSTEM && system) {
        existing.system = normalizeSystem(system);
      }
      return existing;
    }

    const created: MutableConditionState = {
      conditionId,
      system: normalizeSystem(system),
      totalAttempts: 0,
      correctAttempts: 0,
      recentAttempts: 0,
      recentCorrect: 0,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      lastAttemptAt: null,
      lastCorrectAt: null,
      lastIncorrectAt: null,
      dueNow: false,
      overdueDays: 0,
      nextReviewAt: null,
      stability: null,
      progressAccuracy: null,
    };
    conditionStates.set(conditionId, created);
    return created;
  };

  for (const row of input.progress) {
    const state = ensureConditionState(row.conditionId, row.system);
    const totalAttempts = row.totalAttempts ?? 0;
    const correctCount = row.correctCount ?? 0;
    if (totalAttempts > 0) {
      state.totalAttempts = Math.max(state.totalAttempts, totalAttempts);
      state.correctAttempts = Math.max(state.correctAttempts, correctCount);
    }
    if (row.accuracy != null) {
      state.progressAccuracy = row.accuracy > 1 ? row.accuracy / 100 : row.accuracy;
    }
    state.nextReviewAt = row.nextReviewAt ?? state.nextReviewAt;
    state.stability = row.stability ?? state.stability;
    if (row.nextReviewAt && row.nextReviewAt.getTime() <= now.getTime()) {
      state.dueNow = true;
      state.overdueDays = Math.max(
        state.overdueDays,
        (now.getTime() - row.nextReviewAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  for (const row of input.conditionAccuracy) {
    const state = ensureConditionState(row.conditionId);
    if (row.attemptCount > state.totalAttempts) {
      state.totalAttempts = row.attemptCount;
      state.correctAttempts = row.correctCount;
    }
    if (!state.lastAttemptAt && row.lastAttemptedAt) {
      state.lastAttemptAt = row.lastAttemptedAt;
    }
  }

  const reviewSignalsByCondition = new Map<string, AdaptiveReviewSignal[]>();
  for (const signal of input.reviewSignals) {
    if (!signal.conditionId) continue;
    const key = signal.conditionId;
    const existing = reviewSignalsByCondition.get(key) ?? [];
    existing.push(signal);
    reviewSignalsByCondition.set(key, existing);
    ensureConditionState(key, signal.system);
  }

  const attemptsByCondition = new Map<string, AdaptiveAttemptSignal[]>();
  const attemptsByQuestion = new Map<string, AdaptiveAttemptSignal[]>();
  for (const signal of input.attemptSignals) {
    const existingQuestion = attemptsByQuestion.get(signal.questionId) ?? [];
    existingQuestion.push(signal);
    attemptsByQuestion.set(signal.questionId, existingQuestion);

    if (!signal.conditionId) continue;
    const key = signal.conditionId;
    const existingCondition = attemptsByCondition.get(key) ?? [];
    existingCondition.push(signal);
    attemptsByCondition.set(key, existingCondition);
    ensureConditionState(key, signal.system);
  }

  for (const [conditionId, state] of Array.from(conditionStates.entries())) {
    const reviewSignals = reviewSignalsByCondition.get(conditionId) ?? [];
    const attemptSignals = attemptsByCondition.get(conditionId) ?? [];

    if (state.totalAttempts === 0 && attemptSignals.length > 0) {
      state.totalAttempts = attemptSignals.length;
      state.correctAttempts = attemptSignals.filter((signal) => signal.wasCorrect).length;
    }

    applySequenceSignals(state, buildRecentSequence(reviewSignals, attemptSignals));
  }

  const conditions = Object.fromEntries(
    Array.from(conditionStates.values()).map((state) => {
      const profile = computeConditionProfile(state);
      return [profile.conditionId, profile];
    })
  );

  const conditionsBySystem = new Map<string, AdaptiveConditionProfile[]>();
  for (const condition of Object.values(conditions)) {
    const existing = conditionsBySystem.get(condition.system) ?? [];
    existing.push(condition);
    conditionsBySystem.set(condition.system, existing);
  }

  const systems = Object.fromEntries(
    Array.from(conditionsBySystem.entries()).map(([system, conditionProfiles]) => {
      const profile = computeSystemProfile(system, conditionProfiles);
      return [system, profile];
    })
  );

  const questions = Object.fromEntries(
    Array.from(attemptsByQuestion.entries()).map(([questionId, attempts]) => {
      const profile = computeQuestionProfile(questionId, attempts, now);
      return [questionId, profile];
    })
  );

  return {
    generatedAt: now,
    systems,
    conditions,
    questions,
  };
}

function getSourceBaseScore(source: AdaptiveQuestionSource): number {
  switch (source) {
    case 'due_review':
      return 100;
    case 'missed_resurface':
      return 78;
    case 'new_card':
    default:
      return 42;
  }
}

function getScoreBreakdown(
  descriptor: AdaptiveCandidateDescriptor,
  snapshot: AdaptiveProfileSnapshot
): AdaptiveCandidateScore {
  const systemName = normalizeSystem(descriptor.system);
  const system = snapshot.systems[systemName];
  const condition = descriptor.conditionId
    ? snapshot.conditions[descriptor.conditionId]
    : undefined;
  const question = snapshot.questions[descriptor.questionId];
  const systemWeakness = condition?.weaknessScore ?? system?.weaknessScore ?? 0.3;
  const conditionWeakness = condition?.weaknessScore ?? systemWeakness;
  const growth = condition?.growthScore ?? system?.growthScore ?? 0.3;
  const masteryPenalty = condition?.masteryScore ?? system?.overexposureScore ?? 0;
  const overexposurePenalty = system?.overexposureScore ?? 0;
  const exposurePenalty = question?.overexposureScore ?? 0;
  const resurfacing = question?.resurfacingUrgency ?? 0;
  const overdue = clamp((descriptor.overdueDays ?? condition?.overdueDays ?? 0) / 7);
  const blueprint = clamp(descriptor.blueprintWeight ?? 0);
  const unseenBonus = question?.totalAttempts ? 0 : 1;

  const breakdown = {
    blueprint: blueprint * (descriptor.source === 'new_card' ? 30 : 10),
    systemWeakness: systemWeakness * (descriptor.source === 'new_card' ? 24 : 18),
    conditionWeakness: conditionWeakness * (descriptor.source === 'new_card' ? 36 : 28),
    growth: growth * (descriptor.source === 'new_card' ? 18 : 12),
    overdue: overdue * (descriptor.source === 'due_review' ? 24 : 6),
    resurfacing: resurfacing * (descriptor.source === 'missed_resurface' ? 45 : 10),
    masteryPenalty: masteryPenalty * (descriptor.source === 'due_review' ? 8 : 28),
    overexposurePenalty: overexposurePenalty * (descriptor.source === 'due_review' ? 6 : 14),
    exposurePenalty: exposurePenalty * (descriptor.source === 'due_review' ? 6 : 18),
    unseenBonus: unseenBonus * (descriptor.source === 'new_card' ? 8 : 0),
  };

  return {
    total:
      getSourceBaseScore(descriptor.source) +
      breakdown.blueprint +
      breakdown.systemWeakness +
      breakdown.conditionWeakness +
      breakdown.growth +
      breakdown.overdue +
      breakdown.resurfacing +
      breakdown.unseenBonus -
      breakdown.masteryPenalty -
      breakdown.overexposurePenalty -
      breakdown.exposurePenalty,
    breakdown,
  };
}

export function scoreAdaptiveCandidate(
  descriptor: AdaptiveCandidateDescriptor,
  snapshot: AdaptiveProfileSnapshot
): AdaptiveCandidateScore {
  return getScoreBreakdown(descriptor, snapshot);
}

function compareCandidates(
  left: AdaptiveScoredCandidate<AdaptiveCandidateDescriptor>,
  right: AdaptiveScoredCandidate<AdaptiveCandidateDescriptor>
): number {
  if (right.score.total !== left.score.total) {
    return right.score.total - left.score.total;
  }

  if (right.score.breakdown.conditionWeakness !== left.score.breakdown.conditionWeakness) {
    return right.score.breakdown.conditionWeakness - left.score.breakdown.conditionWeakness;
  }

  if (right.score.breakdown.overdue !== left.score.breakdown.overdue) {
    return right.score.breakdown.overdue - left.score.breakdown.overdue;
  }

  const leftSystem = normalizeSystem(left.candidate.system);
  const rightSystem = normalizeSystem(right.candidate.system);
  if (leftSystem !== rightSystem) {
    return leftSystem.localeCompare(rightSystem);
  }

  const leftCondition = left.candidate.conditionId ?? '';
  const rightCondition = right.candidate.conditionId ?? '';
  if (leftCondition !== rightCondition) {
    return leftCondition.localeCompare(rightCondition);
  }

  return left.candidate.questionId.localeCompare(right.candidate.questionId);
}

export function sortAdaptiveCandidates<T extends AdaptiveCandidateDescriptor>(
  candidates: T[],
  snapshot: AdaptiveProfileSnapshot
): AdaptiveScoredCandidate<T>[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreAdaptiveCandidate(candidate, snapshot),
    }))
    .sort((left, right) =>
      compareCandidates(
        left as AdaptiveScoredCandidate<AdaptiveCandidateDescriptor>,
        right as AdaptiveScoredCandidate<AdaptiveCandidateDescriptor>
      )
    );
}

export function allocateAdaptiveSystemCounts(
  input: AdaptiveSystemAllocationInput
): Record<string, number> {
  const {
    totalCount,
    blueprintWeights,
    systems,
    snapshot,
    boostSystems = [],
    suppressSystems = [],
    perSystemCaps = {},
    maxSingleSystemFraction = 0.4,
  } = input;

  if (totalCount <= 0 || systems.length === 0) return {};

  const priorities = systems.map((system) => {
    const profile = snapshot.systems[system];
    const blueprintWeight = blueprintWeights[system] ?? 0;
    const weaknessBoost = 1 + (profile?.weaknessScore ?? 0.3) * 0.9;
    const growthBoost = 1 + (profile?.growthScore ?? 0.3) * 0.15;
    const masterySuppression = 1 - (profile?.overexposureScore ?? 0) * 0.45;
    const manualBoost = boostSystems.includes(system) ? 1.25 : 1;
    const manualSuppression = suppressSystems.includes(system) ? 0.6 : 1;
    const priority = Math.max(
      blueprintWeight * 0.15,
      blueprintWeight * weaknessBoost * growthBoost * masterySuppression * manualBoost * manualSuppression
    );

    return {
      system,
      priority,
      cap: Math.min(
        perSystemCaps[system] ?? Number.POSITIVE_INFINITY,
        Math.max(1, Math.ceil(totalCount * maxSingleSystemFraction))
      ),
    };
  });

  const totalPriority = priorities.reduce((sum, item) => sum + item.priority, 0);
  if (totalPriority <= 0) {
    return Object.fromEntries(systems.map((system) => [system, 0]));
  }

  const allocation = new Map<string, number>();
  const desired = new Map<string, number>();

  for (const item of priorities) {
    const normalized = item.priority / totalPriority;
    const rawDesired = totalCount * normalized;
    desired.set(item.system, rawDesired);
    allocation.set(item.system, Math.min(item.cap, Math.floor(rawDesired)));
  }

  let remaining = totalCount - Array.from(allocation.values()).reduce((sum, count) => sum + count, 0);

  while (remaining > 0) {
    const next = priorities
      .filter((item) => (allocation.get(item.system) ?? 0) < item.cap)
      .sort((left, right) => {
        const leftRemainder = (desired.get(left.system) ?? 0) - (allocation.get(left.system) ?? 0);
        const rightRemainder = (desired.get(right.system) ?? 0) - (allocation.get(right.system) ?? 0);
        if (rightRemainder !== leftRemainder) {
          return rightRemainder - leftRemainder;
        }
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return left.system.localeCompare(right.system);
      })[0];

    if (!next) break;
    allocation.set(next.system, (allocation.get(next.system) ?? 0) + 1);
    remaining -= 1;
  }

  return Object.fromEntries(
    systems.map((system) => [system, allocation.get(system) ?? 0])
  );
}

export function buildAdaptiveTopicMasteryMap(
  snapshot: AdaptiveProfileSnapshot
): Record<string, number> {
  return Object.fromEntries(
    Object.values(snapshot.conditions).map((condition) => [
      condition.conditionId,
      condition.masteryScore,
    ])
  );
}

export function buildAdaptiveSystemWeaknessMap(
  snapshot: AdaptiveProfileSnapshot
): Record<string, number> {
  return Object.fromEntries(
    Object.values(snapshot.systems).map((system) => [
      system.system,
      system.weaknessScore,
    ])
  );
}
