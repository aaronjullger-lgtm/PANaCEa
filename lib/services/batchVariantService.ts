/**
 * Batch Variant Generation Service
 *
 * Proactively generates question variants in bulk so that every condition
 * has sufficient question diversity for meaningful spaced repetition.
 *
 * Key behaviors:
 *   - Identifies conditions with < TARGET_VARIANTS_PER_CONDITION total questions
 *   - Generates variants via Gemini (reusing lib/questionVariantGenerator)
 *   - Stores variants as PreGeneratedQuestion rows (consistent with ensureDueVariant)
 *   - Tracks generation attempts to avoid retrying failed conditions
 *   - Rate-limits Gemini calls to stay within API quotas
 *
 * Sprint 1A — April 2026
 * @module lib/services/batchVariantService
 */

import type { PrismaClient } from '@prisma/client';
import { generateVariant, type VariantRequest } from '../questionVariantGenerator';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum total questions per condition (base + variants) for healthy coverage */
export const TARGET_VARIANTS_PER_CONDITION = 3;

/** Max variants to generate in a single batch run (API quota protection) */
export const MAX_BATCH_SIZE = 50;

/** Delay between Gemini calls (ms) to avoid rate limiting */
export const GENERATION_DELAY_MS = 1200;
/** Variant types to cycle through for diversity */
const VARIANT_TYPES: VariantRequest['targetType'][] = [
  'rephrased',
  'different_scenario',
  'different_distractors',
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConditionCoverage {
  conditionId: string;
  system: string | null;
  questionCount: number;
  deficit: number;
}

export interface BatchGenerationResult {
  generated: number;
  failed: number;
  skipped: number;
  conditionsCovered: string[];
  errors: Array<{ conditionId: string; error: string }>;
  durationMs: number;
}

export interface PoolHealthReport {
  totalConditions: number;
  healthyConditions: number;
  thinConditions: number;
  emptyConditions: number;
  coverageBySystem: Record<string, { total: number; healthy: number; thin: number; empty: number }>;
  thinConditionsList: ConditionCoverage[];
}
// ─── Pool Health Assessment ──────────────────────────────────────────────────

/**
 * Assess question pool health across all conditions.
 * Returns per-system coverage stats and a list of thin conditions.
 *
 * Pure DB read — safe to call from any context.
 */
export async function assessPoolHealth(
  prisma: PrismaClient
): Promise<PoolHealthReport> {
  // Count questions per condition (Question + PreGeneratedQuestion)
  const questionCounts = await prisma.$queryRaw<
    Array<{ conditionId: string; system: string | null; cnt: string }>
  >`
    SELECT c.id AS "conditionId", c.system,
           COALESCE(q.cnt, 0) + COALESCE(pg.cnt, 0) AS cnt
    FROM "Condition" c
    LEFT JOIN (
      SELECT "conditionId", COUNT(*)::text AS cnt
      FROM "Question"
      GROUP BY "conditionId"
    ) q ON q."conditionId" = c.id
    LEFT JOIN (
      SELECT "conditionId", COUNT(*)::text AS cnt
      FROM "PreGeneratedQuestion"
      GROUP BY "conditionId"
    ) pg ON pg."conditionId" = c.id
    WHERE c.status = 'published'
    ORDER BY cnt ASC
  `;

  const conditions: ConditionCoverage[] = questionCounts.map(row => {
    const count = parseInt(String(row.cnt), 10) || 0;
    return {
      conditionId: row.conditionId,
      system: row.system,
      questionCount: count,
      deficit: Math.max(0, TARGET_VARIANTS_PER_CONDITION - count),
    };
  });
  const coverageBySystem: PoolHealthReport['coverageBySystem'] = {};

  let healthyConditions = 0;
  let thinConditions = 0;
  let emptyConditions = 0;
  const thinConditionsList: ConditionCoverage[] = [];

  for (const c of conditions) {
    const sys = c.system ?? 'Unknown';
    if (!coverageBySystem[sys]) {
      coverageBySystem[sys] = { total: 0, healthy: 0, thin: 0, empty: 0 };
    }
    coverageBySystem[sys].total++;

    if (c.questionCount === 0) {
      emptyConditions++;
      coverageBySystem[sys].empty++;
      thinConditionsList.push(c);
    } else if (c.questionCount < TARGET_VARIANTS_PER_CONDITION) {
      thinConditions++;
      coverageBySystem[sys].thin++;
      thinConditionsList.push(c);
    } else {
      healthyConditions++;
      coverageBySystem[sys].healthy++;
    }
  }

  return {
    totalConditions: conditions.length,
    healthyConditions,
    thinConditions,
    emptyConditions,
    coverageBySystem,
    thinConditionsList,
  };
}
// ─── Batch Variant Generation ────────────────────────────────────────────────

/**
 * Generate variants for under-populated conditions.
 *
 * Finds conditions with < TARGET_VARIANTS_PER_CONDITION questions,
 * picks a source question from each, and generates variants until
 * the condition reaches the target count (or MAX_BATCH_SIZE total
 * generations for this run).
 */
export async function generateBatchVariants(
  prisma: PrismaClient,
  apiKey: string,
  options?: {
    maxGenerations?: number;
    systemFilter?: string;
    delayMs?: number;
  }
): Promise<BatchGenerationResult> {
  const startTime = Date.now();
  const maxGen = options?.maxGenerations ?? MAX_BATCH_SIZE;
  const delayMs = options?.delayMs ?? GENERATION_DELAY_MS;

  const result: BatchGenerationResult = {
    generated: 0,
    failed: 0,
    skipped: 0,
    conditionsCovered: [],
    errors: [],
    durationMs: 0,
  };
  // Step 1: Find thin conditions
  const health = await assessPoolHealth(prisma);
  let thinList = health.thinConditionsList.filter(c => c.deficit > 0);

  // Optional system filter
  if (options?.systemFilter) {
    thinList = thinList.filter(c => c.system === options.systemFilter);
  }

  // Sort by deficit descending (emptiest conditions first)
  thinList.sort((a, b) => b.deficit - a.deficit);

  // Step 2: For each thin condition, find a source question and generate variants
  for (const condition of thinList) {
    if (result.generated >= maxGen) break;

    // Find a source question for this condition
    const sourceQuestion = await prisma.question.findFirst({
      where: { conditionId: condition.conditionId },
      select: {
        id: true,
        question: true,
        vignette: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        system: true,
        difficulty: true,
      },
    });
    if (!sourceQuestion) {
      // No source question exists — skip (needs content authoring, not variants)
      result.skipped++;
      continue;
    }

    // Normalize options from JSON
    const rawOpts = sourceQuestion.options;
    const opts: string[] = Array.isArray(rawOpts)
      ? rawOpts.map(String)
      : rawOpts && typeof rawOpts === 'object'
        ? Object.values(rawOpts as Record<string, string>)
        : [];

    const questionText = [sourceQuestion.vignette, sourceQuestion.question]
      .filter(Boolean)
      .join('\n\n');

    if (!questionText || opts.length === 0) {
      result.skipped++;
      continue;
    }

    // Generate enough variants to reach target
    const toGenerate = Math.min(condition.deficit, maxGen - result.generated);

    for (let i = 0; i < toGenerate; i++) {
      const variantType = VARIANT_TYPES[i % VARIANT_TYPES.length]!;
      try {
        const variant = await generateVariant(
          {
            originalQuestion: questionText,
            originalOptions: opts,
            originalAnswer: sourceQuestion.correctAnswer,
            originalExplanation:
              typeof sourceQuestion.explanation === 'string'
                ? sourceQuestion.explanation
                : JSON.stringify(sourceQuestion.explanation),
            targetType: variantType,
          },
          { env: { GEMINI_API_KEY: apiKey ?? '' } }
        );

        if (!variant?.question || !Array.isArray(variant.options) || variant.options.length === 0) {
          result.failed++;
          result.errors.push({
            conditionId: condition.conditionId,
            error: 'Generation returned empty variant',
          });
          continue;
        }

        const correctStr = variant.correctAnswer ?? variant.options[0];
        const correctIdx = Math.max(0, variant.options.indexOf(correctStr));
        const newId =
          typeof crypto !== 'undefined' &&
          typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function'
            ? (crypto as { randomUUID: () => string }).randomUUID()
            : `batch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

        await prisma.preGeneratedQuestion.create({
          data: {
            id: newId,
            questionType: 'mcq',
            system: sourceQuestion.system ?? undefined,
            conditionId: condition.conditionId,
            difficulty: sourceQuestion.difficulty || 'medium',
            questionData: {
              question: variant.question,
              options: variant.options,
              correctAnswer: correctStr,
              correctAnswerIndex: correctIdx,
              rationale: variant.explanation ?? '',
              sourceQuestionId: sourceQuestion.id,
              variantType,
              generatedBy: 'batch',
            },
          },
        });

        result.generated++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          conditionId: condition.conditionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Rate limit between Gemini calls
      if (i < toGenerate - 1) {
        await sleep(delayMs);
      }
    }

    result.conditionsCovered.push(condition.conditionId);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ─── Variant Rotation Helpers ────────────────────────────────────────────────

/**
 * Get the least-seen question for a condition, preferring unseen variants.
 * Used by conceptQuestionSelector to rotate variants instead of random picks.
 *
 * Returns the question ID that this user has seen the fewest times,
 * breaking ties by preferring PreGeneratedQuestion (variant) over base Question.
 */
export async function getLeastSeenQuestionForCondition(
  prisma: PrismaClient,
  userId: string,
  conditionId: string
): Promise<string | null> {
  // Get all question IDs for this condition (both Question and PreGeneratedQuestion)
  const [baseQuestions, preGenQuestions] = await Promise.all([    prisma.question.findMany({
      where: { conditionId },
      select: { id: true },
    }),
    prisma.preGeneratedQuestion.findMany({
      where: { conditionId },
      select: { id: true },
    }),
  ]);

  const allIds = [
    ...baseQuestions.map(q => ({ id: q.id, isVariant: false })),
    ...preGenQuestions.map(q => ({ id: q.id, isVariant: true })),
  ];

  if (allIds.length === 0) return null;
  if (allIds.length === 1) return allIds[0]!.id;

  // Get seen counts from UserQuestionSeen
  const seenRecords = await prisma.userQuestionSeen.findMany({
    where: {
      userId,
      questionId: { in: allIds.map(q => q.id) },
    },
    select: { questionId: true, timesShown: true },
  });

  const seenMap = new Map(seenRecords.map(r => [r.questionId, r.timesShown]));

  // Sort: least seen first, then prefer variants (more diverse), then random tiebreak
  allIds.sort((a, b) => {
    const seenA = seenMap.get(a.id) ?? 0;
    const seenB = seenMap.get(b.id) ?? 0;
    if (seenA !== seenB) return seenA - seenB;
    // Prefer variants for diversity
    if (a.isVariant !== b.isVariant) return a.isVariant ? -1 : 1;
    // Random tiebreak
    return Math.random() - 0.5;
  });

  return allIds[0]!.id;
}
// ─── Batched Least-Seen Lookup ───────────────────────────────────────────────

/**
 * Batch version of getLeastSeenQuestionForCondition.
 * Resolves least-seen question IDs for multiple conditions in 3 queries total
 * instead of 3×N (eliminates N+1 in the due-review selection loop).
 *
 * @returns Map<conditionId, questionId | null>
 */
export async function batchGetLeastSeenQuestions(
  prisma: PrismaClient,
  userId: string,
  conditionIds: string[]
): Promise<Map<string, string | null>> {
  if (conditionIds.length === 0) return new Map();

  const uniqueIds = [...new Set(conditionIds)];

  // 1. Fetch all question IDs across all conditions in two bulk queries
  const [baseQuestions, preGenQuestions] = await Promise.all([
    prisma.question.findMany({
      where: { conditionId: { in: uniqueIds } },
      select: { id: true, conditionId: true },
    }),
    prisma.preGeneratedQuestion.findMany({
      where: { conditionId: { in: uniqueIds } },
      select: { id: true, conditionId: true },
    }),
  ]);

  // Build per-condition candidate lists
  const candidatesByCondition = new Map<string, Array<{ id: string; isVariant: boolean }>>();
  for (const q of baseQuestions) {
    if (!q.conditionId) continue;
    const list = candidatesByCondition.get(q.conditionId) ?? [];
    list.push({ id: q.id, isVariant: false });
    candidatesByCondition.set(q.conditionId, list);
  }
  for (const q of preGenQuestions) {
    if (!q.conditionId) continue;
    const list = candidatesByCondition.get(q.conditionId) ?? [];
    list.push({ id: q.id, isVariant: true });
    candidatesByCondition.set(q.conditionId, list);
  }

  // 2. Fetch all seen counts in one query
  const allQuestionIds = [
    ...baseQuestions.map(q => q.id),
    ...preGenQuestions.map(q => q.id),
  ];

  const seenRecords = allQuestionIds.length > 0
    ? await prisma.userQuestionSeen.findMany({
        where: { userId, questionId: { in: allQuestionIds } },
        select: { questionId: true, timesShown: true },
      })
    : [];

  const seenMap = new Map(seenRecords.map(r => [r.questionId, r.timesShown]));

  // 3. Resolve least-seen per condition (in-memory sort)
  const result = new Map<string, string | null>();
  for (const condId of uniqueIds) {
    const candidates = candidatesByCondition.get(condId);
    if (!candidates || candidates.length === 0) {
      result.set(condId, null);
      continue;
    }
    if (candidates.length === 1) {
      result.set(condId, candidates[0]!.id);
      continue;
    }

    candidates.sort((a, b) => {
      const seenA = seenMap.get(a.id) ?? 0;
      const seenB = seenMap.get(b.id) ?? 0;
      if (seenA !== seenB) return seenA - seenB;
      if (a.isVariant !== b.isVariant) return a.isVariant ? -1 : 1;
      return Math.random() - 0.5;
    });

    result.set(condId, candidates[0]!.id);
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
