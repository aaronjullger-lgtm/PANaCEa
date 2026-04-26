/**
 * Concept-Level Question Selector
 *
 * The core question selection engine for study sessions. This version keeps
 * the selector orchestration thin and pushes adaptive weighting into a shared,
 * deterministic scoring layer so every study mode can reuse the same ranking
 * behavior.
 *
 * Candidate sources:
 *   1. Due reviews from UserProgress
 *   2. Missed-question resurfacing from QuestionAttempt history
 *   3. New/exploratory questions from the question bank
 *
 * @module lib/services/conceptQuestionSelector
 */

import type { PrismaClient } from '@prisma/client';
import type { SessionMetadata } from '@/lib/api/types/sessions';
import type { LearnerStage } from './learnerStageBlueprint';
import { batchGetLeastSeenQuestions } from './batchVariantService';
import { letterToIndex } from '../answerLetterMap';
import { logger } from '../logger';
import {
  buildBanditArm,
  rankCandidates,
  type BanditState,
  type BanditConfig,
  type QuestionMetadata,
  type ScoredArm,
} from './contextualBanditService';
import {
  allocateAdaptiveSystemCounts,
  buildAdaptiveProfileSnapshot,
  buildAdaptiveSystemWeaknessMap,
  buildAdaptiveTopicMasteryMap,
  scoreAdaptiveCandidate,
  type AdaptiveCandidateDescriptor,
  type AdaptiveProfileSnapshot,
  type AdaptiveQuestionSource,
} from '../study/adaptiveQuestionRanking';

const LOG_SCOPE = 'ConceptQuestionSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionMode =
  | 'adaptive'
  | 'system'
  | 'subcategory'
  | 'condition'
  | 'review'
  | 'focused';

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
  banditState?: BanditState;
  systemWeaknesses?: Record<string, number>;
  topicMasteryMap?: Record<string, number>;
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
  source: AdaptiveQuestionSource;
}

export interface SessionGenerationResult {
  sessionId: string;
  questions: SelectedQuestion[];
  metadata: SessionMetadata;
}

type QuestionRow = {
  id: string;
  question: string;
  vignette: string | null;
  options: unknown;
  correctAnswer: string | null;
  explanation: string | null;
  system: string | null;
  category: string | null;
  topic: string | null;
  difficulty: string | null;
  conditionId: string | null;
};

interface ScopeFilter {
  system?: string;
  subcategory?: string;
  conditionId?: string;
  gatedSystems: string[];
}

interface NewCardOptions extends ScopeFilter {
  blueprintWeights: Record<string, number>;
  boostSystems: string[];
  suppressSystems: string[];
  perSystemCaps: Record<string, number>;
  snapshot: AdaptiveProfileSnapshot;
  excludeQuestionIds: Set<string>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DUE_REVIEW_RATIO = 0.7;
const MIN_NEW_CARD_RATIO = 0.15;
const MAX_RESURFACE_RATIO = 0.2;
const AVG_SECONDS_PER_QUESTION = 90;
const MAX_SINGLE_SYSTEM_FRACTION = 0.4;
const ADAPTIVE_LOOKBACK_DAYS = 45;

// ─── Core Selector ───────────────────────────────────────────────────────────

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
  } = request;

  const snapshot = await loadAdaptiveSelectionSnapshot(prisma, userId);
  const derivedSystemWeaknesses = buildAdaptiveSystemWeaknessMap(snapshot);
  const derivedTopicMasteryMap = buildAdaptiveTopicMasteryMap(snapshot);
  const scope: ScopeFilter = { system, subcategory, conditionId, gatedSystems };

  if (mode === 'review') {
    const dueCards = await fetchDueReviews(prisma, userId, mode, scope, snapshot, blueprintWeights);
    const selected = dueCards.slice(0, size);
    return {
      sessionId: generateSessionId(),
      questions: selected,
      metadata: buildMetadata(selected, selected.length, 0, 0, mode, blueprintStage),
    };
  }

  const focusedNewRatio = mode === 'focused' ? 0.5 : MIN_NEW_CARD_RATIO;
  const maxDueSlots = Math.floor(size * DUE_REVIEW_RATIO);
  const minNewSlots = Math.max(1, Math.floor(size * focusedNewRatio));
  const resurfaceCap = Math.max(1, Math.floor(size * MAX_RESURFACE_RATIO));

  const dueCards = await fetchDueReviews(prisma, userId, mode, scope, snapshot, blueprintWeights);
  const dueCount = Math.min(dueCards.length, maxDueSlots);
  const selectedDue = dueCards.slice(0, dueCount);

  const resurfaceSlots = Math.max(0, Math.min(resurfaceCap, maxDueSlots - selectedDue.length));
  const selectedQuestionIds = new Set(selectedDue.map((question) => question.id));
  const resurfacedCards =
    resurfaceSlots > 0
      ? await fetchMissedResurfacingQuestions(
          prisma,
          userId,
          mode,
          scope,
          snapshot,
          blueprintWeights,
          selectedQuestionIds
        )
      : [];
  const selectedResurfaced = resurfacedCards.slice(0, resurfaceSlots);
  for (const question of selectedResurfaced) {
    selectedQuestionIds.add(question.id);
  }

  const exploratoryTarget = Math.max(
    minNewSlots,
    size - selectedDue.length - selectedResurfaced.length
  );

  const selectedNew = await fetchNewCards(prisma, userId, exploratoryTarget, mode, {
    blueprintWeights,
    system,
    subcategory,
    conditionId,
    boostSystems,
    suppressSystems,
    perSystemCaps,
    gatedSystems,
    snapshot,
    excludeQuestionIds: selectedQuestionIds,
  });

  const allCandidates = [
    ...selectedDue,
    ...selectedResurfaced,
    ...selectedNew,
  ];

  const rerankedCandidates = request.banditState
    ? banditRerankQuestions(allCandidates, {
        ...request,
        systemWeaknesses: request.systemWeaknesses ?? derivedSystemWeaknesses,
        topicMasteryMap: request.topicMasteryMap ?? derivedTopicMasteryMap,
      })
    : allCandidates;

  const combined = interleaveQuestions(
    rerankedCandidates.filter((question) => question.source !== 'new_card'),
    rerankedCandidates.filter((question) => question.source === 'new_card')
  ).slice(0, size);

  return {
    sessionId: generateSessionId(),
    questions: combined,
    metadata: buildMetadata(
      combined,
      selectedDue.length,
      selectedResurfaced.length,
      combined.filter((question) => question.source === 'new_card').length,
      mode,
      blueprintStage
    ),
  };
}

// ─── Snapshot Loader ─────────────────────────────────────────────────────────

async function loadAdaptiveSelectionSnapshot(
  prisma: PrismaClient,
  userId: string
): Promise<AdaptiveProfileSnapshot> {
  const since = new Date(Date.now() - ADAPTIVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [progress, conditionAccuracy, reviewSignals, attemptSignals] = await Promise.all([
    prisma.userProgress.findMany({
      where: { userId },
      select: {
        conditionId: true,
        system: true,
        nextReviewAt: true,
        fsrsStability: true,
        accuracy: true,
        totalAttempts: true,
        correctCount: true,
      },
    }),
    prisma.userConditionAccuracy.findMany({
      where: { userId },
      select: {
        conditionId: true,
        attemptCount: true,
        correctCount: true,
        lastAttemptedAt: true,
      },
    }),
    prisma.reviewLog.findMany({
      where: {
        userId,
        reviewedAt: { gte: since },
        conditionId: { not: null },
      },
      select: {
        conditionId: true,
        system: true,
        wasCorrect: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: 'desc' },
      take: 600,
    }),
    prisma.questionAttempt.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      select: {
        questionId: true,
        conditionId: true,
        system: true,
        wasCorrect: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ]);

  return buildAdaptiveProfileSnapshot({
    now: new Date(),
    progress: progress.map((row) => ({
      conditionId: row.conditionId,
      system: row.system,
      nextReviewAt: row.nextReviewAt,
      stability: row.fsrsStability,
      accuracy: row.accuracy,
      totalAttempts: row.totalAttempts,
      correctCount: row.correctCount,
    })),
    conditionAccuracy,
    reviewSignals: reviewSignals
      .filter((row): row is typeof row & { conditionId: string } => Boolean(row.conditionId))
      .map((row) => ({
        conditionId: row.conditionId,
        system: row.system,
        wasCorrect: row.wasCorrect,
        reviewedAt: row.reviewedAt,
      })),
    attemptSignals,
  });
}

// ─── Due Review Fetcher ──────────────────────────────────────────────────────

async function fetchDueReviews(
  prisma: PrismaClient,
  userId: string,
  mode: SessionMode,
  scope: ScopeFilter,
  snapshot: AdaptiveProfileSnapshot,
  blueprintWeights: Record<string, number>
): Promise<SelectedQuestion[]> {
  const now = new Date();
  const progressWhere: any = {
    userId,
    nextReviewAt: { lte: now },
  };

  if (scope.system && (mode === 'system' || mode === 'subcategory')) {
    progressWhere.system = scope.system;
  }

  if (scope.conditionId && mode === 'condition') {
    progressWhere.conditionId = scope.conditionId;
  }

  if (scope.gatedSystems.length > 0) {
    progressWhere.system = {
      ...(typeof progressWhere.system === 'string'
        ? { equals: progressWhere.system }
        : progressWhere.system),
      notIn: scope.gatedSystems,
    };
  }

  const dueProgress = await prisma.userProgress.findMany({
    where: progressWhere,
    orderBy: { nextReviewAt: 'asc' },
    take: 100,
    select: {
      conditionId: true,
      system: true,
      nextReviewAt: true,
    },
  });

  if (dueProgress.length === 0) return [];

  const conditionIds = dueProgress.map((progress) => progress.conditionId);
  const questionWhere: any = {
    conditionId: { in: conditionIds },
  };

  if (scope.subcategory && mode === 'subcategory') {
    questionWhere.subcategory = scope.subcategory;
  }

  const questions = await prisma.question.findMany({
    where: questionWhere,
    select: QUESTION_SELECT,
  });

  const byCondition = new Map<string, QuestionRow[]>();
  for (const question of questions) {
    if (!question.conditionId) continue;
    const existing = byCondition.get(question.conditionId) ?? [];
    existing.push(question);
    byCondition.set(question.conditionId, existing);
  }

  const leastSeenMap = await batchGetLeastSeenQuestions(prisma, userId, conditionIds).catch(
    () => new Map<string, string | null>()
  );

  const selected: SelectedQuestion[] = [];
  const usedQuestionIds = new Set<string>();

  for (const progress of dueProgress) {
    const candidates = byCondition.get(progress.conditionId) ?? [];
    if (candidates.length === 0) continue;

    const leastSeenId = leastSeenMap.get(progress.conditionId) ?? null;
    const overdueDays = progress.nextReviewAt
      ? Math.max(
          0,
          (now.getTime() - progress.nextReviewAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;
    const ranked = rankQuestionRows(
      candidates,
      'due_review',
      snapshot,
      blueprintWeights,
      usedQuestionIds,
      overdueDays,
      leastSeenId
    );
    const picked = ranked[0]?.row;
    if (!picked) continue;

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

  return selected;
}

// ─── Missed Resurfacing ──────────────────────────────────────────────────────

async function fetchMissedResurfacingQuestions(
  prisma: PrismaClient,
  userId: string,
  mode: SessionMode,
  scope: ScopeFilter,
  snapshot: AdaptiveProfileSnapshot,
  blueprintWeights: Record<string, number>,
  excludeQuestionIds: Set<string>
): Promise<SelectedQuestion[]> {
  const eligibleQuestionIds = Object.values(snapshot.questions)
    .filter((question) => question.resurfacingEligible)
    .map((question) => question.questionId);

  if (eligibleQuestionIds.length === 0) return [];

  const where: any = {
    id: { in: eligibleQuestionIds },
  };

  if (scope.system && (mode === 'system' || mode === 'subcategory')) {
    where.system = scope.system;
  }

  if (scope.conditionId && mode === 'condition') {
    where.conditionId = scope.conditionId;
  }

  if (scope.subcategory && mode === 'subcategory') {
    where.subcategory = scope.subcategory;
  }

  if (!scope.system && scope.gatedSystems.length > 0) {
    where.system = { notIn: scope.gatedSystems };
  }

  const questions = await prisma.question.findMany({
    where,
    select: QUESTION_SELECT,
  });

  return rankQuestionRows(
    questions,
    'missed_resurface',
    snapshot,
    blueprintWeights,
    excludeQuestionIds
  ).map((entry) => normalizeQuestion(entry.row, 'missed_resurface'));
}

// ─── New Card Fetcher ────────────────────────────────────────────────────────

async function fetchNewCards(
  prisma: PrismaClient,
  userId: string,
  count: number,
  mode: SessionMode,
  options: NewCardOptions
): Promise<SelectedQuestion[]> {
  if (count <= 0) return [];

  const attemptedIds = await prisma.questionAttempt.findMany({
    where: { userId },
    select: { questionId: true },
    distinct: ['questionId'],
    take: 2000,
  });
  const attemptedSet = new Set(
    attemptedIds.map((attempt) => attempt.questionId).filter(Boolean)
  );

  for (const questionId of Array.from(options.excludeQuestionIds)) {
    attemptedSet.add(questionId);
  }

  if (mode === 'condition' && options.conditionId) {
    return fetchScopedNew(prisma, count, attemptedSet, options, {
      conditionId: options.conditionId,
    });
  }

  if (mode === 'subcategory' && options.system && options.subcategory) {
    return fetchScopedNew(prisma, count, attemptedSet, options, {
      system: options.system,
      subcategory: options.subcategory,
    });
  }

  if (mode === 'system' && options.system) {
    return fetchScopedNew(prisma, count, attemptedSet, options, {
      system: options.system,
    });
  }

  return fetchAdaptiveNew(prisma, count, attemptedSet, options);
}

async function fetchScopedNew(
  prisma: PrismaClient,
  count: number,
  attemptedSet: Set<string>,
  options: NewCardOptions,
  filter: { system?: string; subcategory?: string; conditionId?: string }
): Promise<SelectedQuestion[]> {
  const where: any = {};
  if (filter.system) where.system = filter.system;
  if (filter.subcategory) where.subcategory = filter.subcategory;
  if (filter.conditionId) where.conditionId = filter.conditionId;

  const candidates = await prisma.question.findMany({
    where,
    select: QUESTION_SELECT,
    take: count * 4,
    orderBy: { id: 'asc' },
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

async function fetchAdaptiveNew(
  prisma: PrismaClient,
  totalCount: number,
  attemptedSet: Set<string>,
  options: NewCardOptions
): Promise<SelectedQuestion[]> {
  const adjustedWeights = { ...options.blueprintWeights };

  for (const gatedSystem of options.gatedSystems) {
    delete adjustedWeights[gatedSystem];
  }

  const systems = Object.keys(adjustedWeights).sort((left, right) => left.localeCompare(right));
  if (systems.length === 0) return [];

  const allocation = allocateAdaptiveSystemCounts({
    totalCount,
    blueprintWeights: adjustedWeights,
    systems,
    snapshot: options.snapshot,
    boostSystems: options.boostSystems,
    suppressSystems: options.suppressSystems,
    perSystemCaps: options.perSystemCaps,
    maxSingleSystemFraction: MAX_SINGLE_SYSTEM_FRACTION,
  });

  const selected: SelectedQuestion[] = [];
  const sessionExcluded = new Set(attemptedSet);

  for (const system of systems) {
    const targetCount = allocation[system] ?? 0;
    if (targetCount <= 0) continue;

    const candidates = await prisma.question.findMany({
      where: { system },
      select: QUESTION_SELECT,
      take: Math.max(targetCount * 4, 12),
      orderBy: { id: 'asc' },
    });

    const ranked = rankQuestionRows(
      candidates,
      'new_card',
      options.snapshot,
      adjustedWeights,
      sessionExcluded
    );

    const shuffled = shuffleArray(pool);
    const selected = shuffled
      .map(q => normalizeQuestion(q, 'new_card'))
      .filter(isUsableSelectedQuestion)
      .slice(0, targetCount);
    allQuestions.push(...selected);
  }

  return selected;
}

// ─── Interleaving ────────────────────────────────────────────────────────────

function interleaveQuestions(
  reviewLike: SelectedQuestion[],
  newCards: SelectedQuestion[]
): SelectedQuestion[] {
  const bySystem = new Map<string, SelectedQuestion[]>();

  for (const question of [...reviewLike, ...newCards]) {
    const system = question.system ?? 'Unknown';
    const existing = bySystem.get(system) ?? [];
    existing.push(question);
    bySystem.set(system, existing);
  }

  const result: SelectedQuestion[] = [];
  let lastSystem: string | null = null;

  while (true) {
    const nextSystem = Array.from(bySystem.entries())
      .filter(([, questions]) => questions.length > 0)
      .sort((left, right) => {
        const leftReviewLike = left[1].filter((question) => question.source !== 'new_card').length;
        const rightReviewLike = right[1].filter((question) => question.source !== 'new_card').length;
        if (rightReviewLike !== leftReviewLike) {
          return rightReviewLike - leftReviewLike;
        }
        if (right[1].length !== left[1].length) {
          return right[1].length - left[1].length;
        }
        const leftPenalty = left[0] === lastSystem ? 1 : 0;
        const rightPenalty = right[0] === lastSystem ? 1 : 0;
        if (leftPenalty !== rightPenalty) {
          return leftPenalty - rightPenalty;
        }
        return left[0].localeCompare(right[0]);
      })[0];

    if (!nextSystem) break;

    const nextQuestion = nextSystem[1].shift();
    if (!nextQuestion) break;

    result.push(nextQuestion);
    lastSystem = nextSystem[0];
  }

  return result;
}

// ─── Bandit Reranking ───────────────────────────────────────────────────────

export function banditRerankQuestions(
  questions: (SelectedQuestion & { source: AdaptiveQuestionSource })[],
  request: Pick<
    SessionRequest,
    'banditState' | 'systemWeaknesses' | 'topicMasteryMap' | 'blueprintWeights' | 'banditConfig' | 'size'
  >
): (SelectedQuestion & { source: AdaptiveQuestionSource })[] {
  if (!request.banditState || questions.length <= 1) return questions;

  const arms = questions.map((question, index) => {
    const meta: QuestionMetadata = {
      questionId: question.id,
      system: question.system,
      difficulty: question.difficulty,
      topic: question.topic,
      topicMastery: request.topicMasteryMap?.[question.conditionId ?? ''] ?? 0.5,
      overdueRatio:
        question.source === 'due_review' ? 1.0 : question.source === 'missed_resurface' ? 0.5 : 0,
      systemWeakness: request.systemWeaknesses?.[question.system ?? ''] ?? 0.5,
      blueprintWeight: request.blueprintWeights[question.system ?? ''] ?? 0.08,
      daysSinceReview: question.source === 'new_card' ? undefined : 7,
      sessionIndex: index,
      sessionSize: request.size,
    };

    return buildBanditArm(meta);
  });

  const scored: ScoredArm[] = rankCandidates(
    arms,
    request.banditState,
    request.banditConfig
  );

  const rankMap = new Map<string, number>();
  scored.forEach((entry, index) => rankMap.set(entry.questionId, index));

  return [...questions].sort((left, right) => {
    const leftRank = rankMap.get(left.id) ?? questions.length;
    const rightRank = rankMap.get(right.id) ?? questions.length;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.id.localeCompare(right.id);
  });
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
  raw: QuestionRow,
  source: AdaptiveQuestionSource
): SelectedQuestion {
  const rawOptions = raw.options;
  const options: string[] = Array.isArray(rawOptions)
    ? rawOptions.map((option) => String(option))
    : rawOptions && typeof rawOptions === 'object'
      ? Object.values(rawOptions as Record<string, string>).map((option) => String(option))
      : [];

  let correctAnswerIndex: number | null = null;
  if (typeof raw.correctAnswer === 'string') {
    const letterIndex = letterToIndex(raw.correctAnswer);
    if (letterIndex !== null && letterIndex < options.length) {
      correctAnswerIndex = letterIndex;
    } else {
      const textIndex = options.findIndex((option) => option === raw.correctAnswer);
      correctAnswerIndex = textIndex >= 0 ? textIndex : null;
    }
  }

  if (correctAnswerIndex === null) {
    logger.warn(`[${LOG_SCOPE}] normalizeQuestion: could not resolve correctAnswerIndex`, {
      questionId: raw.id,
      correctAnswer: raw.correctAnswer,
      optionsCount: options.length,
    });
    correctAnswerIndex = -1;
  }

  return {
    id: raw.id,
    question: raw.question,
    vignette: raw.vignette ?? null,
    options,
    correctAnswer: raw.correctAnswer ?? '',
    correctAnswerIndex,
    explanation: raw.explanation ?? null,
    system: raw.system ?? null,
    category: raw.category ?? null,
    topic: raw.topic ?? null,
    difficulty: raw.difficulty ?? null,
    conditionId: raw.conditionId ?? null,
    source,
  };
}

function isUsableSelectedQuestion(question: SelectedQuestion): boolean {
  return (
    typeof question.question === 'string' &&
    question.question.trim().length > 0 &&
    question.options.length >= 2 &&
    question.correctAnswerIndex >= 0 &&
    question.correctAnswerIndex < question.options.length
  );
}

function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ses_${ts}_${rand}`;
}
