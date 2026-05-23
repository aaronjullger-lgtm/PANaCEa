/**
 * Concept-Level Question Selector
 *
 * The core question selection engine for study sessions. Consumes blueprint
 * weights from learnerStageBlueprint.ts + distribution constraints from
 * antiGamingDistribution.ts, and selects an optimal mix of:
 *
 *   1. Due reviews (FSRS nextReviewAt <= now) — ordered by overdue ratio
 *   2. New cards — sampled proportional to blueprint weights
 *
 * Supports four session modes:
 *   - adaptive: Full blueprint-weighted selection (default)
 *   - system: All questions from one system
 *   - subcategory: Narrower filter within a system
 *   - condition: Drill into one specific condition
 *
 * Research backing:
 *   - 85% Rule (Wilson et al., 2019): difficulty mix auto-calibrates
 *   - Interleaving (Brunmair & Richter, 2019): questions are interleaved across systems
 *   - FSRS v6: due cards prioritized by overdue ratio for optimal retention
 *
 * @module lib/services/conceptQuestionSelector
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type { LearnerStage } from './learnerStageBlueprint';
import { batchGetLeastSeenQuestions } from './batchVariantService';
import { letterToIndex, ANSWER_LETTERS } from '../answerLetterMap';
import { logger } from '../logger';
import {
  buildBanditArm,
  rankCandidates,
  type BanditState,
  type BanditConfig,
  type QuestionMetadata,
  type ScoredArm,
} from './contextualBanditService';
import { withProductionQuestionSafety } from './questionServingSafety';

const LOG_SCOPE = 'ConceptQuestionSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionMode = 'adaptive' | 'system' | 'subcategory' | 'condition' | 'review' | 'focused';

export interface SessionRequest {
  userId: string;
  mode: SessionMode;
  size: number;

  /** Blueprint weights by system (sum ≈ 1.0) */
  blueprintWeights: Record<string, number>;

  // ── Filters (used in scoped modes) ──
  system?: string;
  subcategory?: string;
  conditionId?: string;

  // ── Distribution constraints from check-distribution ──
  boostSystems?: string[];
  suppressSystems?: string[];
  perSystemCaps?: Record<string, number>;

  // ── Learner context ──
  blueprintStage: LearnerStage;
  urgencyMultiplier: number;
  /** Systems the learner hasn't been exposed to yet (didactic gating) */
  gatedSystems?: string[];

  // ── Bandit reranking (optional) ──
  /** Bandit state for LinUCB reranking. If provided, candidates are reranked. */
  banditState?: BanditState;
  /** Per-system weakness scores (0=strong, 1=weakest) for bandit context */
  systemWeaknesses?: Record<string, number>;
  /** Per-question mastery scores (0=new, 1=mastered) for bandit context */
  topicMasteryMap?: Record<string, number>;
  /** Override bandit config */
  banditConfig?: BanditConfig;
}

export interface SelectedQuestion {
  id: string;
  question: string;
  vignette: string | null;
  options: string[];
  correctAnswer: string;
  correctAnswerIndex: number;
  explanation: string | null;
  system: string | null;
  category: string | null;
  topic: string | null;
  difficulty: string | null;
  conditionId: string | null;
  medicalContentId: string | null;
  source: 'due_review' | 'new_card';
}

export interface SessionGenerationResult {
  sessionId: string;
  questions: SelectedQuestion[];
  metadata: {
    dueReviewCount: number;
    newCardCount: number;
    systemDistribution: Record<string, number>;
    estimatedMinutes: number;
    mode: SessionMode;
    blueprintStage: LearnerStage;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Target ratio of due reviews to new cards */
const DUE_REVIEW_RATIO = 0.7;

/** Minimum new cards even when many reviews are due (prevents stagnation) */
const MIN_NEW_CARD_RATIO = 0.15;

/** Average seconds per question for time estimation */
const AVG_SECONDS_PER_QUESTION = 90;

/** Maximum system concentration in adaptive mode */
const MAX_SINGLE_SYSTEM_FRACTION = 0.40;

// ─── Core Selector ───────────────────────────────────────────────────────────

/**
 * Generate a study session by selecting questions through the concept-level
 * FSRS pipeline.
 */
export async function selectSessionQuestions(
  prisma: PrismaClient,
  request: SessionRequest
): Promise<SessionGenerationResult> {
  const {
    userId,
    mode,
    size,
    blueprintWeights,
    system,
    subcategory,
    conditionId,
    boostSystems = [],
    suppressSystems = [],
    perSystemCaps = {},
    gatedSystems = [],
    blueprintStage,
    urgencyMultiplier,
  } = request;

  // ── Review mode: 100% due reviews, no new cards ──
  if (mode === 'review') {
    const dueCards = await fetchDueReviews(prisma, userId, mode, {
      system, subcategory, conditionId, gatedSystems,
    });
    const selected = dueCards.slice(0, size);
    const sessionId = generateSessionId();
    const systemDist: Record<string, number> = {};
    for (const q of selected) {
      const sys = q.system ?? 'Unknown';
      systemDist[sys] = (systemDist[sys] ?? 0) + 1;
    }
    return {
      sessionId, questions: selected,
      metadata: {
        dueReviewCount: selected.length, newCardCount: 0,
        systemDistribution: systemDist,
        estimatedMinutes: Math.round((selected.length * AVG_SECONDS_PER_QUESTION) / 60),
        mode, blueprintStage,
      },
    };
  }

  // ── Focused mode: weak-system boost, higher new card ratio ──
  const focusedNewRatio = mode === 'focused' ? 0.50 : MIN_NEW_CARD_RATIO;

  // Step 1: Find due review cards
  const dueCards = await fetchDueReviews(prisma, userId, mode, {
    system,
    subcategory,
    conditionId,
    gatedSystems,
  });

  // Step 2: Calculate the split between due reviews and new cards
  const maxDueSlots = Math.floor(size * DUE_REVIEW_RATIO);
  const minNewSlots = Math.max(1, Math.floor(size * focusedNewRatio));
  const dueCount = Math.min(dueCards.length, maxDueSlots);
  const newCount = Math.max(minNewSlots, size - dueCount);

  // Step 3: Select due review cards (sorted by overdue ratio — most overdue first)
  const selectedDue = dueCards.slice(0, dueCount);

  // Step 4: Select new cards based on mode
  const selectedNew = await fetchNewCards(prisma, userId, newCount, mode, {
    blueprintWeights,
    system,
    subcategory,
    conditionId,
    boostSystems,
    suppressSystems,
    perSystemCaps,
    gatedSystems,
  });

  // Step 5: Combine candidates
  const allCandidates = [
    ...selectedDue.map(q => ({ ...q, source: 'due_review' as const })),
    ...selectedNew.map(q => ({ ...q, source: 'new_card' as const })),
  ];

  // Step 5b: Bandit reranking (if state provided)
  const rerankedCandidates = request.banditState
    ? banditRerankQuestions(allCandidates, request)
    : allCandidates;

  // Step 5c: Interleave across systems
  const combined = interleaveQuestions(
    rerankedCandidates.filter(q => q.source === 'due_review') as (SelectedQuestion & { source: 'due_review' })[],
    rerankedCandidates.filter(q => q.source === 'new_card') as (SelectedQuestion & { source: 'new_card' })[],
  );

  // Step 6: Create session record
  const sessionId = generateSessionId();

  // Step 7: Compute metadata
  const systemDist: Record<string, number> = {};
  for (const q of combined) {
    const sys = q.system ?? 'Unknown';
    systemDist[sys] = (systemDist[sys] ?? 0) + 1;
  }

  return {
    sessionId,
    questions: combined,
    metadata: {
      dueReviewCount: dueCount,
      newCardCount: selectedNew.length,
      systemDistribution: systemDist,
      estimatedMinutes: Math.round((combined.length * AVG_SECONDS_PER_QUESTION) / 60),
      mode,
      blueprintStage,
    },
  };
}

// ─── Due Review Fetcher ──────────────────────────────────────────────────────

interface ScopeFilter {
  system?: string;
  subcategory?: string;
  conditionId?: string;
  gatedSystems: string[];
}

interface ResolvedConditionScope {
  progressConditionIds: string[];
  questionConditionIds: string[];
  medicalContentIds: string[];
  conditionToMedicalContentId: Map<string, string>;
  medicalContentToConditionId: Map<string, string | null>;
}

async function resolveConditionScope(
  prisma: PrismaClient,
  conditionIds: string[]
): Promise<ResolvedConditionScope> {
  const uniqueIds = [...new Set(conditionIds.filter(Boolean))];
  const result: ResolvedConditionScope = {
    progressConditionIds: [],
    questionConditionIds: [],
    medicalContentIds: [],
    conditionToMedicalContentId: new Map(),
    medicalContentToConditionId: new Map(),
  };

  if (uniqueIds.length === 0) return result;

  const rows = await prisma.medicalContent.findMany({
    where: {
      OR: [
        { id: { in: uniqueIds } },
        { conditionId: { in: uniqueIds } },
      ],
    },
    select: {
      id: true,
      conditionId: true,
    },
  });

  for (const row of rows) {
    result.progressConditionIds.push(row.id);
    result.medicalContentIds.push(row.id);
    result.medicalContentToConditionId.set(row.id, row.conditionId ?? null);
    if (row.conditionId) {
      result.questionConditionIds.push(row.conditionId);
      if (!result.conditionToMedicalContentId.has(row.conditionId)) {
        result.conditionToMedicalContentId.set(row.conditionId, row.id);
      }
    }
  }

  for (const id of uniqueIds) {
    if (!result.progressConditionIds.includes(id)) {
      result.progressConditionIds.push(id);
    }
    if (!result.medicalContentIds.includes(id) && !result.questionConditionIds.includes(id)) {
      result.questionConditionIds.push(id);
    }
  }

  result.progressConditionIds = [...new Set(result.progressConditionIds)];
  result.questionConditionIds = [...new Set(result.questionConditionIds)];
  result.medicalContentIds = [...new Set(result.medicalContentIds)];

  return result;
}

async function fetchDueReviews(
  prisma: PrismaClient,
  userId: string,
  mode: SessionMode,
  scope: ScopeFilter
): Promise<SelectedQuestion[]> {
  const now = new Date();

  // Build UserProgress filter for due cards
  const progressWhere: any = {
    userId,
    nextReviewAt: { lte: now },
  };

  // Apply scope filters to the joined condition
  if (scope.system && (mode === 'system' || mode === 'subcategory')) {
    progressWhere.system = scope.system;
  }

  if (scope.conditionId && mode === 'condition') {
    const scopedConditionDomain = await resolveConditionScope(prisma, [scope.conditionId]);
    progressWhere.conditionId = {
      in: scopedConditionDomain.progressConditionIds.length > 0
        ? scopedConditionDomain.progressConditionIds
        : [scope.conditionId],
    };
  }

  // Exclude gated systems (didactic students)
  if (scope.gatedSystems.length > 0) {
    progressWhere.system = {
      ...(typeof progressWhere.system === 'string'
        ? { equals: progressWhere.system }
        : progressWhere.system),
      notIn: scope.gatedSystems,
    };
  }

  // Fetch due UserProgress entries with their linked questions
  const dueProgress = await prisma.userProgress.findMany({
    where: progressWhere,
    orderBy: [
      { nextReviewAt: 'asc' }, // Most overdue first
    ],
    take: 100, // Cap to prevent huge queries
    select: {
      conditionId: true,
      system: true,
      fsrsStability: true,
      nextReviewAt: true,
    },
  });

  if (dueProgress.length === 0) return [];

  // For each due concept, find a question
  const conditionIds = dueProgress.map(p => p.conditionId);
  const dueConditionDomain = await resolveConditionScope(prisma, conditionIds);
  const questionScopeOr: Array<Record<string, unknown>> = [];
  if (dueConditionDomain.questionConditionIds.length > 0) {
    questionScopeOr.push({ conditionId: { in: dueConditionDomain.questionConditionIds } });
  }
  if (dueConditionDomain.medicalContentIds.length > 0) {
    questionScopeOr.push({ medicalContentId: { in: dueConditionDomain.medicalContentIds } });
  }
  if (questionScopeOr.length === 0) {
    questionScopeOr.push({ conditionId: { in: conditionIds } });
  }
  const questionWhere: any = withProductionQuestionSafety(
    questionScopeOr.length === 1 ? questionScopeOr[0]! : { OR: questionScopeOr }
  );

  if (scope.subcategory && mode === 'subcategory') {
    questionWhere.subcategory = scope.subcategory;
  }

  const questions = await prisma.question.findMany({
    where: questionWhere,
    select: {
      id: true,
      question: true,
      vignette: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      system: true,
      category: true,
      topic: true,
      difficulty: true,
      conditionId: true,
      medicalContentId: true,
    },
  });

  // Group questions by conditionId, pick one per condition
  const byCondition = new Map<string, typeof questions>();
  for (const q of questions) {
    const conditionKeys = new Set(
      [
        q.medicalContentId,
        q.conditionId ? dueConditionDomain.conditionToMedicalContentId.get(q.conditionId) : undefined,
        q.conditionId,
      ].filter((key): key is string => typeof key === 'string' && key.length > 0)
    );
    for (const key of conditionKeys) {
      const existing = byCondition.get(key) ?? [];
      existing.push(q);
      byCondition.set(key, existing);
    }
  }

  const result: SelectedQuestion[] = [];
  const usedQuestionIds = new Set<string>();

  // Batch pre-fetch least-seen questions for all conditions (3 queries instead of 3×N)
  const leastSeenMap = await batchGetLeastSeenQuestions(
    prisma,
    userId,
    dueConditionDomain.questionConditionIds.length > 0
      ? dueConditionDomain.questionConditionIds
      : conditionIds
  ).catch(() => new Map<string, string | null>());

  for (const progress of dueProgress) {
    const mappedQuestionConditionId =
      dueConditionDomain.medicalContentToConditionId.get(progress.conditionId) ?? progress.conditionId;
    const leastSeenId = mappedQuestionConditionId
      ? leastSeenMap.get(mappedQuestionConditionId) ?? null
      : null;
    const candidates = byCondition.get(progress.conditionId) ?? [];

    // If leastSeenId points to a Question we already fetched, use it
    const leastSeenCandidate = leastSeenId
      ? candidates.find(c => c.id === leastSeenId && !usedQuestionIds.has(c.id))
      : null;

    if (leastSeenCandidate) {
      usedQuestionIds.add(leastSeenCandidate.id);
      const normalized = normalizeQuestion(leastSeenCandidate, 'due_review');
      if (isUsableSelectedQuestion(normalized)) {
        result.push(normalized);
      }
      continue;
    }

    // Fallback: pick from available candidates (random)
    const available = candidates.filter(c => !usedQuestionIds.has(c.id));
    if (available.length === 0) continue;

    const picked = available[Math.floor(Math.random() * available.length)];
    usedQuestionIds.add(picked.id);
    const normalized = normalizeQuestion(picked, 'due_review');
    if (isUsableSelectedQuestion(normalized)) {
      result.push(normalized);
    }
  }

  return result;
}

// ─── New Card Fetcher ────────────────────────────────────────────────────────

interface NewCardOptions {
  blueprintWeights: Record<string, number>;
  system?: string;
  subcategory?: string;
  conditionId?: string;
  boostSystems: string[];
  suppressSystems: string[];
  perSystemCaps: Record<string, number>;
  gatedSystems: string[];
}

async function fetchNewCards(
  prisma: PrismaClient,
  userId: string,
  count: number,
  mode: SessionMode,
  options: NewCardOptions
): Promise<SelectedQuestion[]> {
  if (count <= 0) return [];

  // Get IDs of questions the user has already attempted (avoid repeating in session)
  const attemptedIds = await prisma.questionAttempt.findMany({
    where: { userId },
    select: { questionId: true },
    distinct: ['questionId'],
    take: 2000,
  });
  const attemptedSet = new Set(attemptedIds.map(a => a.questionId).filter(Boolean));

  if (mode === 'condition' && options.conditionId) {
    // Condition-scoped: all questions for this condition
    const scopedConditionDomain = await resolveConditionScope(prisma, [options.conditionId]);
    return fetchScopedNew(prisma, count, attemptedSet, {
      conditionIds: scopedConditionDomain.questionConditionIds.length > 0
        ? scopedConditionDomain.questionConditionIds
        : [options.conditionId],
      medicalContentIds: scopedConditionDomain.medicalContentIds,
    });
  }

  if (mode === 'subcategory' && options.system && options.subcategory) {
    // Subcategory-scoped
    return fetchScopedNew(prisma, count, attemptedSet, {
      system: options.system,
      subcategory: options.subcategory,
    });
  }

  if (mode === 'system' && options.system) {
    // System-scoped
    return fetchScopedNew(prisma, count, attemptedSet, {
      system: options.system,
    });
  }

  // Adaptive mode: distribute across systems proportional to blueprint weights
  return fetchAdaptiveNew(prisma, count, attemptedSet, options);
}

/**
 * Fetch new questions for a scoped session (system/subcategory/condition).
 */
async function fetchScopedNew(
  prisma: PrismaClient,
  count: number,
  attemptedSet: Set<string>,
  filter: {
    system?: string;
    subcategory?: string;
    conditionId?: string;
    conditionIds?: string[];
    medicalContentIds?: string[];
  }
): Promise<SelectedQuestion[]> {
  const where: any = withProductionQuestionSafety({});
  if (filter.system) where.system = filter.system;
  if (filter.subcategory) where.subcategory = filter.subcategory;
  const conditionOr: Array<Record<string, unknown>> = [];
  if (filter.conditionIds?.length) conditionOr.push({ conditionId: { in: filter.conditionIds } });
  if (filter.medicalContentIds?.length) {
    conditionOr.push({ medicalContentId: { in: filter.medicalContentIds } });
  }
  if (filter.conditionId) conditionOr.push({ conditionId: filter.conditionId });
  if (conditionOr.length === 1) {
    Object.assign(where, conditionOr[0]);
  } else if (conditionOr.length > 1) {
    where.OR = conditionOr;
  }

  // Fetch more than needed to filter out attempted questions
  const candidates = await prisma.question.findMany({
    where,
    select: QUESTION_SELECT,
    take: count * 3,
    orderBy: { id: 'asc' }, // Deterministic ordering for pagination
  });

  const unseen = candidates.filter(q => !attemptedSet.has(q.id));

  // If not enough unseen, allow some repeats (review is still valuable)
  const pool = unseen.length >= count ? unseen : [...unseen, ...candidates.filter(q => attemptedSet.has(q.id))];

  // Shuffle and take
  const shuffled = shuffleArray(pool);
  return shuffled
    .map(q => normalizeQuestion(q, 'new_card'))
    .filter(isUsableSelectedQuestion)
    .slice(0, count);
}

/**
 * Fetch new questions distributed across systems proportional to blueprint weights.
 * This is the "adaptive" mode where the system decides what mix to show.
 */
async function fetchAdaptiveNew(
  prisma: PrismaClient,
  totalCount: number,
  attemptedSet: Set<string>,
  options: NewCardOptions
): Promise<SelectedQuestion[]> {
  const { blueprintWeights, boostSystems, suppressSystems, perSystemCaps, gatedSystems } = options;

  // Adjust weights: boost under-represented, suppress over-represented
  const adjustedWeights = { ...blueprintWeights };

  for (const sys of boostSystems) {
    if (adjustedWeights[sys]) adjustedWeights[sys] *= 1.5;
  }
  for (const sys of suppressSystems) {
    if (adjustedWeights[sys]) adjustedWeights[sys] *= 0.5;
  }
  // Zero out gated systems
  for (const sys of gatedSystems) {
    delete adjustedWeights[sys];
  }

  // Renormalize
  const totalWeight = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return [];

  for (const sys of Object.keys(adjustedWeights)) {
    adjustedWeights[sys] /= totalWeight;
  }

  // Calculate per-system allocation
  const allocation: Record<string, number> = {};
  let allocated = 0;

  for (const [sys, weight] of Object.entries(adjustedWeights)) {
    let sysCount = Math.round(totalCount * weight);

    // Apply per-system caps from anti-gaming
    if (perSystemCaps[sys] !== undefined) {
      sysCount = Math.min(sysCount, perSystemCaps[sys]);
    }

    // Apply max concentration cap
    sysCount = Math.min(sysCount, Math.ceil(totalCount * MAX_SINGLE_SYSTEM_FRACTION));

    allocation[sys] = sysCount;
    allocated += sysCount;
  }

  // If under-allocated due to caps, distribute remainder to boosted systems
  let remainder = totalCount - allocated;
  if (remainder > 0) {
    const boostable = boostSystems.length > 0
      ? boostSystems
      : Object.keys(adjustedWeights);

    for (const sys of boostable) {
      if (remainder <= 0) break;
      const cap = perSystemCaps[sys] ?? Infinity;
      const maxAdd = cap - (allocation[sys] ?? 0);
      const add = Math.min(remainder, Math.max(0, maxAdd));
      allocation[sys] = (allocation[sys] ?? 0) + add;
      remainder -= add;
    }
  }

  // Fetch questions per system
  const allQuestions: SelectedQuestion[] = [];

  for (const [sys, targetCount] of Object.entries(allocation)) {
    if (targetCount <= 0) continue;

    const candidates = await prisma.question.findMany({
      where: withProductionQuestionSafety({ system: sys }),
      select: QUESTION_SELECT,
      take: targetCount * 3,
    });

    const unseen = candidates.filter(q => !attemptedSet.has(q.id));
    const pool = unseen.length >= targetCount
      ? unseen
      : [...unseen, ...candidates.filter(q => attemptedSet.has(q.id))];

    const shuffled = shuffleArray(pool);
    const selected = shuffled
      .map(q => normalizeQuestion(q, 'new_card'))
      .filter(isUsableSelectedQuestion)
      .slice(0, targetCount);
    allQuestions.push(...selected);
  }

  return allQuestions;
}

// ─── Interleaving ────────────────────────────────────────────────────────────

/**
 * Interleave questions to avoid system blocking.
 * Research: Brunmair & Richter (2019) — interleaved practice improves
 * discrimination learning by +9 percentage points vs blocked practice.
 *
 * Strategy: Round-robin across systems, mixing due reviews and new cards.
 * Never serve 3+ questions from the same system consecutively.
 */
function interleaveQuestions(
  dueReviews: (SelectedQuestion & { source: 'due_review' })[],
  newCards: (SelectedQuestion & { source: 'new_card' })[],
): SelectedQuestion[] {
  const all = [...shuffleArray(dueReviews), ...shuffleArray(newCards)];

  if (all.length <= 2) return all;

  // Group by system
  const bySystem = new Map<string, typeof all>();
  for (const q of all) {
    const sys = q.system ?? 'Unknown';
    const existing = bySystem.get(sys) ?? [];
    existing.push(q);
    bySystem.set(sys, existing);
  }

  // Round-robin across systems
  const result: SelectedQuestion[] = [];
  const iterators = Array.from(bySystem.values()).map(qs => ({ items: qs, idx: 0 }));

  // Shuffle the order of systems for variety
  shuffleArrayInPlace(iterators);

  while (result.length < all.length) {
    let addedThisRound = false;
    for (const iter of iterators) {
      if (iter.idx < iter.items.length) {
        result.push(iter.items[iter.idx]);
        iter.idx++;
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }

  return result;
}

// ─── Bandit Reranking ───────────────────────────────────────────────────────

/**
 * Re-rank selected questions using LinUCB contextual bandit.
 *
 * Builds a BanditArm for each question from available metadata,
 * scores them via the bandit, and returns questions in bandit-optimal order.
 * Pure function — no database calls.
 *
 * @see lib/services/contextualBanditService.ts
 */
export function banditRerankQuestions(
  questions: (SelectedQuestion & { source: 'due_review' | 'new_card' })[],
  request: Pick<SessionRequest, 'banditState' | 'systemWeaknesses' | 'topicMasteryMap' | 'blueprintWeights' | 'banditConfig' | 'size'>
): (SelectedQuestion & { source: 'due_review' | 'new_card' })[] {
  if (!request.banditState || questions.length <= 1) return questions;

  const arms = questions.map((q, idx) => {
    const meta: QuestionMetadata = {
      questionId: q.id,
      system: q.system,
      difficulty: q.difficulty,
      topic: q.topic,
      topicMastery: request.topicMasteryMap?.[q.conditionId ?? ''] ?? 0.5,
      overdueRatio: q.source === 'due_review' ? 1.0 : 0.0,
      systemWeakness: request.systemWeaknesses?.[q.system ?? ''] ?? 0.5,
      blueprintWeight: request.blueprintWeights[q.system ?? ''] ?? 0.08,
      daysSinceReview: q.source === 'due_review' ? 7 : undefined,
      sessionIndex: idx,
      sessionSize: request.size,
    };
    return buildBanditArm(meta);
  });

  const scored: ScoredArm[] = rankCandidates(arms, request.banditState, request.banditConfig);

  // Build a map from questionId → rank position
  const rankMap = new Map<string, number>();
  scored.forEach((s, i) => rankMap.set(s.questionId, i));

  // Sort questions by bandit rank (lower rank = higher UCB score)
  const sorted = [...questions].sort((a, b) => {
    const rankA = rankMap.get(a.id) ?? questions.length;
    const rankB = rankMap.get(b.id) ?? questions.length;
    return rankA - rankB;
  });

  return sorted;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUESTION_SELECT: Prisma.QuestionSelect = {
  id: true,
  question: true,
  vignette: true,
  options: true,
  correctAnswer: true,
  explanation: true,
  system: true,
  category: true,
  topic: true,
  difficulty: true,
  conditionId: true,
  medicalContentId: true,
  QuestionAnswerChoice: {
    select: {
      choiceKey: true,
      choiceText: true,
      isCorrect: true,
      rationale: true,
      displayOrder: true,
    },
  },
  QuestionExplanation: {
    where: { isActive: true },
    select: {
      explanationType: true,
      title: true,
      body: true,
      sourceCitation: true,
      version: true,
    },
  },
};

function normalizeQuestion(
  raw: any,
  source: 'due_review' | 'new_card'
): SelectedQuestion {
  const normalizedChoices = normalizeAnswerChoices(raw.QuestionAnswerChoice);
  const legacyOptions = normalizeLegacyOptions(raw.options);
  const opts = normalizedChoices.length > 0
    ? normalizedChoices.map((choice) => choice.choiceText)
    : legacyOptions;

  // Derive correctAnswerIndex from letter key (A=0, B=1, ..., E=4) or string match
  // Uses canonical converter — returns null on invalid input instead of silently falling back to 0
  let correctIdx = resolveCorrectAnswerIndex(raw.correctAnswer, opts, normalizedChoices);

  if (correctIdx === null) {
    // Log but don't crash — return with index -1 so callers can filter
    logger.warn(
      `[${LOG_SCOPE}] normalizeQuestion: could not resolve correctAnswerIndex`,
      {
        questionId: raw.id,
        correctAnswer: raw.correctAnswer,
        optionsCount: opts.length,
      }
    );
    correctIdx = -1;
  }

  const explanation = normalizeQuestionExplanation(raw.QuestionExplanation, raw.explanation);

  return {
    id: raw.id,
    question: raw.question,
    vignette: raw.vignette ?? null,
    options: opts,
    correctAnswer: opts[correctIdx] ?? raw.correctAnswer,
    correctAnswerIndex: correctIdx,
    explanation,
    system: raw.system ?? null,
    category: raw.category ?? null,
    topic: raw.topic ?? null,
    difficulty: raw.difficulty ?? null,
    conditionId: raw.conditionId ?? null,
    medicalContentId: raw.medicalContentId ?? null,
    source,
  };
}

interface NormalizedAnswerChoice {
  choiceKey: string | null;
  choiceText: string;
  isCorrect: boolean;
  displayOrder: number;
}

function normalizeAnswerChoices(rawChoices: unknown): NormalizedAnswerChoice[] {
  if (!Array.isArray(rawChoices)) return [];

  return rawChoices
    .map((choice) => {
      if (!choice || typeof choice !== 'object') return null;
      const record = choice as Record<string, unknown>;
      const choiceText = normalizeString(record.choiceText);
      if (!choiceText) return null;

      return {
        choiceKey: normalizeString(record.choiceKey),
        choiceText,
        isCorrect: record.isCorrect === true,
        displayOrder: typeof record.displayOrder === 'number' ? record.displayOrder : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((choice): choice is NormalizedAnswerChoice => choice !== null)
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return (a.choiceKey ?? '').localeCompare(b.choiceKey ?? '');
    });
}

function normalizeLegacyOptions(rawOptions: unknown): string[] {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((option) => normalizeString(option))
      .filter((option): option is string => option !== null);
  }

  if (rawOptions && typeof rawOptions === 'object') {
    return Object.entries(rawOptions as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, option]) => normalizeString(option))
      .filter((option): option is string => option !== null);
  }

  return [];
}

function resolveCorrectAnswerIndex(
  rawCorrectAnswer: unknown,
  options: string[],
  choices: NormalizedAnswerChoice[]
): number | null {
  const choiceCorrectIndex = choices.findIndex((choice) => choice.isCorrect);
  if (choiceCorrectIndex >= 0) return choiceCorrectIndex;

  if (typeof rawCorrectAnswer !== 'string') return null;
  const normalizedCorrectAnswer = rawCorrectAnswer.trim();
  if (!normalizedCorrectAnswer) return null;

  const choiceKeyIndex = choices.findIndex(
    (choice) => choice.choiceKey?.toLowerCase() === normalizedCorrectAnswer.toLowerCase()
  );
  if (choiceKeyIndex >= 0) return choiceKeyIndex;

  const letterIdx = letterToIndex(normalizedCorrectAnswer);
  if (letterIdx !== null && letterIdx < options.length) return letterIdx;

  const exactTextIndex = options.findIndex(
    (option) => option.trim().toLowerCase() === normalizedCorrectAnswer.toLowerCase()
  );
  if (exactTextIndex >= 0) return exactTextIndex;

  return null;
}

/**
 * Normalize question explanation for serving.
 *
 * Prefers structured rationale JSON when available (from question-generator.ts),
 * which preserves bottomLine, whyCorrect, whyIncorrectA-E, clinicalPearl, and
 * highYieldImageOrTable for rich rendering in ExplanationPanel.
 *
 * Falls back to QuestionExplanation records or legacy flat-string rationale.
 */
function normalizeQuestionExplanation(rawExplanations: unknown, legacyExplanation: unknown): string | null {
  // Phase 1: If legacyExplanation is structured rationale JSON, preserve it intact
  //   ExplanationPanel handles both string and object formats at render time
  if (typeof legacyExplanation === 'string') {
    try {
      const parsed = JSON.parse(legacyExplanation) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        ('whyCorrect' in (parsed as Record<string, unknown>) ||
          'bottomLine' in (parsed as Record<string, unknown>))
      ) {
        return legacyExplanation; // preserve structured JSON string
      }
    } catch {
      // Not JSON — treat as plain string rationale
    }
  }

  // Phase 2: Extract from QuestionExplanation records
  if (Array.isArray(rawExplanations)) {
    const explanations = rawExplanations
      .filter((explanation) => explanation && typeof explanation === 'object')
      .map((explanation) => explanation as Record<string, unknown>)
      .filter((explanation) => normalizeString(explanation.body) !== null)
      .sort((a, b) => {
        const aVersion = typeof a.version === 'number' ? a.version : 0;
        const bVersion = typeof b.version === 'number' ? b.version : 0;
        if (aVersion !== bVersion) return bVersion - aVersion;
        return String(a.explanationType ?? '').localeCompare(String(b.explanationType ?? ''));
      });

    const correctRationale =
      explanations.find((explanation) => explanation.explanationType === 'CORRECT_RATIONALE') ??
      explanations.find((explanation) => explanation.explanationType === 'TEACHING_POINT') ??
      explanations[0];

    const body = normalizeString(correctRationale?.body);
    if (body) return body;
  }

  // Phase 3: Plain string rationale
  return normalizeString(legacyExplanation);
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isUsableSelectedQuestion(question: SelectedQuestion): boolean {
  return (
    typeof question.question === 'string' &&
    question.question.trim().length > 0 &&
    question.options.length >= 2 &&
    question.correctAnswerIndex >= 0 &&
    question.correctAnswerIndex < question.options.length &&
    typeof question.explanation === 'string' &&
    question.explanation.trim().length > 0
  );
}

function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `ses_${ts}_${rand}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  shuffleArrayInPlace(copy);
  return copy;
}

function shuffleArrayInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
