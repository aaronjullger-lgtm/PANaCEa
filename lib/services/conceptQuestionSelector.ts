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

import type { PrismaClient } from '@prisma/client';
import type { LearnerStage } from './learnerStageBlueprint';
import { batchGetLeastSeenQuestions } from './batchVariantService';

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

  // Step 5: Combine and interleave
  const combined = interleaveQuestions(
    selectedDue.map(q => ({ ...q, source: 'due_review' as const })),
    selectedNew.map(q => ({ ...q, source: 'new_card' as const }))
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
    progressWhere.conditionId = scope.conditionId;
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
  const questionWhere: any = {
    conditionId: { in: conditionIds },
  };

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
    },
  });

  // Group questions by conditionId, pick one per condition
  const byCondition = new Map<string, typeof questions>();
  for (const q of questions) {
    if (!q.conditionId) continue;
    const existing = byCondition.get(q.conditionId) ?? [];
    existing.push(q);
    byCondition.set(q.conditionId, existing);
  }

  const result: SelectedQuestion[] = [];
  const usedQuestionIds = new Set<string>();

  // Batch pre-fetch least-seen questions for all conditions (3 queries instead of 3×N)
  const leastSeenMap = await batchGetLeastSeenQuestions(
    prisma, userId, conditionIds
  ).catch(() => new Map<string, string | null>());

  for (const progress of dueProgress) {
    const leastSeenId = leastSeenMap.get(progress.conditionId) ?? null;
    const candidates = byCondition.get(progress.conditionId) ?? [];

    // If leastSeenId points to a Question we already fetched, use it
    const leastSeenCandidate = leastSeenId
      ? candidates.find(c => c.id === leastSeenId && !usedQuestionIds.has(c.id))
      : null;

    if (leastSeenCandidate) {
      usedQuestionIds.add(leastSeenCandidate.id);
      result.push(normalizeQuestion(leastSeenCandidate, 'due_review'));
      continue;
    }

    // Fallback: pick from available candidates (random)
    const available = candidates.filter(c => !usedQuestionIds.has(c.id));
    if (available.length === 0) continue;

    const picked = available[Math.floor(Math.random() * available.length)];
    usedQuestionIds.add(picked.id);
    result.push(normalizeQuestion(picked, 'due_review'));
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
    return fetchScopedNew(prisma, count, attemptedSet, {
      conditionId: options.conditionId,
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
  filter: { system?: string; subcategory?: string; conditionId?: string }
): Promise<SelectedQuestion[]> {
  const where: any = {};
  if (filter.system) where.system = filter.system;
  if (filter.subcategory) where.subcategory = filter.subcategory;
  if (filter.conditionId) where.conditionId = filter.conditionId;

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
  return shuffled.slice(0, count).map(q => normalizeQuestion(q, 'new_card'));
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
      where: { system: sys },
      select: QUESTION_SELECT,
      take: targetCount * 3,
    });

    const unseen = candidates.filter(q => !attemptedSet.has(q.id));
    const pool = unseen.length >= targetCount
      ? unseen
      : [...unseen, ...candidates.filter(q => attemptedSet.has(q.id))];

    const shuffled = shuffleArray(pool);
    const selected = shuffled.slice(0, targetCount);
    allQuestions.push(...selected.map(q => normalizeQuestion(q, 'new_card')));
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUESTION_SELECT = {
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
} as const;

function normalizeQuestion(
  raw: any,
  source: 'due_review' | 'new_card'
): SelectedQuestion {
  // Normalize options: DB stores as {"A":"...", "B":"..."} — convert to array
  const rawOpts = raw.options;
  const opts: string[] = Array.isArray(rawOpts)
    ? rawOpts
    : rawOpts && typeof rawOpts === 'object'
      ? Object.values(rawOpts as Record<string, string>)
      : [];

  // Derive correctAnswerIndex from letter key (A=0, B=1, ...) or string match
  const correctIdx =
    typeof raw.correctAnswer === 'string' && /^[A-E]$/.test(raw.correctAnswer)
      ? raw.correctAnswer.charCodeAt(0) - 65
      : opts.findIndex((o) => o === raw.correctAnswer);

  return {
    id: raw.id,
    question: raw.question,
    vignette: raw.vignette ?? null,
    options: opts,
    correctAnswer: raw.correctAnswer,
    correctAnswerIndex: Math.max(0, correctIdx),
    explanation: raw.explanation ?? null,
    system: raw.system ?? null,
    category: raw.category ?? null,
    topic: raw.topic ?? null,
    difficulty: raw.difficulty ?? null,
    conditionId: raw.conditionId ?? null,
    source,
  };
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
