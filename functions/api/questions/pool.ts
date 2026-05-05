/**
 * API Endpoint: /api/questions/pool
 * GET: Get questions from the question pool with user-specific filtering
 * POST: Seed a question back into the pool
 */

import { z } from 'zod';
import { selectByPanceDistribution, fisherYatesShuffle } from '../../../lib/poolSelection';
import { getSystemWeight, calculateTargetDistribution, getSystemAbbreviation } from '../../../lib/constants/blueprint';
import { aiEndpoint, authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  CACHE_STRATEGY,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { buildCanonicalQuestionMirrorData, upsertCanonicalQuestionMirror } from '../_shared/canonical-question-mirror';
import {
  getFromCache,
  setInCache,
  getQuestionPoolCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';
import {
  indexToLetter,
  resolveCorrectAnswerIndex,
} from '../../../lib/answerLetterMap';
import {
  PRODUCTION_PREGENERATED_SAFETY_FILTER,
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../lib/services/questionServingSafety';

/**
 * Compute a lightweight semantic fingerprint from question text for near-duplicate detection.
 * Uses djb2 on the first 200 normalized characters (lowercase, punctuation stripped).
 */
function computeSemanticHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Type definitions for question pool operations
interface QuestionDataJson {
  [key: string]: any;
  vignette?: string;
  question?: string;
  imageUrl?: string;
  mediaId?: string;
  options?: string[];
  answers?: string[];
  choices?: string[];
  correctAnswer?: string;
  correctAnswerIndex?: number;
  correctIndex?: number;
  explanation?: string;
  conditionName?: string;
  system?: string;
  subcategory?: string;
  tags?: string[];
  contentSource?: string;
  contentSourceTitle?: string;
}

interface PreGeneratedQuestionRecord {
  id: string;
  questionType: string;
  system: string | null;
  conditionId: string | null;
  medicalContentId: string | null;
  difficulty: string | null;
  validationStatus: string | null;
  questionData: QuestionDataJson;
  generatedAt: Date;
  usedAt: Date | null;
}

interface PreGeneratedQuestionDbRecord {
  id: string;
  questionType: string;
  system: string | null;
  conditionId: string | null;
  medicalContentId: string | null;
  difficulty: string | null;
  validationStatus: string | null;
  questionData: unknown;
  generatedAt: Date;
  usedAt: Date | null;
}

interface PoolQuestionOutput {
  id: string;
  vignette?: string;
  question?: string;
  imageUrl?: string;
  options: string[];
  correctAnswer?: string;
  correctAnswerIndex?: number;
  explanation?: string;
  system: string;
  difficulty: string;
  tags?: string[];
  conditionId?: string | null;
  source: 'pool' | 'main';
  /** True when question is from staging lake (beta/peer review) */
  fromStaging?: boolean;
  contentSource?: string;
  contentSourceTitle?: string;
}

interface MainQuestionRecord {
  id: string;
  vignette: string | null;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation: string | null;
  system: string | null;
  difficulty: string | null;
  tags: unknown;
}

/**
 * Map database result to PreGeneratedQuestionRecord type
 */
function mapToPreGeneratedQuestion(r: {
  id: string;
  questionType: string;
  system: string | null;
  conditionId: string | null;
  medicalContentId: string | null;
  difficulty: string | null;
  validationStatus: string | null;
  questionData: unknown;
  generatedAt: Date;
  usedAt: Date | null;
}): PreGeneratedQuestionRecord {
  return {
    id: r.id,
    questionType: r.questionType,
    system: r.system,
    conditionId: r.conditionId,
    medicalContentId: r.medicalContentId,
    difficulty: r.difficulty,
    validationStatus: r.validationStatus,
    questionData: r.questionData as QuestionDataJson,
    generatedAt: r.generatedAt,
    usedAt: r.usedAt,
  };
}

const POOL_LOW_THRESHOLD = 20;
const DEFAULT_FETCH_COUNT = 10;
const BASE_THRESHOLD_MULTIPLIER = 200;
const MAX_SEEN_HISTORY = 5_000;

function getSystemThreshold(system: string): number {
  const weight = getSystemWeight(system);
  const threshold = Math.round(weight * BASE_THRESHOLD_MULTIPLIER);
  return Math.max(10, threshold);
}

function computeThreshold(system: string | null, systems: string[] | null): number {
  if (systems && systems.length > 0) {
    // Deduplicate systems
    const unique = Array.from(new Set(systems));
    return unique.reduce((sum, sys) => sum + getSystemThreshold(sys), 0);
  }
  if (system) {
    return getSystemThreshold(system);
  }
  // No system filter – fallback to global threshold
  return POOL_LOW_THRESHOLD;
}

// Schema for query params - flat structure since source is 'query'
// systems: comma-separated list for didactic (e.g. "CV,PULM,GI")
const PoolGetSchema = z.object({
  system: z.string().optional(),
  systems: z.string().optional(), // comma-separated for multi-system filter
  category: z.string().optional(),
  difficulty: z.string().optional(),
  count: z.string().optional(),
  mode: z.string().optional(),
});

const PoolPostSchema = z.object({
  question: z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.string(),
    explanation: z.string(),
    system: z.string().optional(),
    conditionId: z.string().optional(),
    medicalContentId: z.string().optional(),
    difficulty: z.string().optional(),
    vignette: z.string().optional(),
    conditionName: z.string().optional(),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const onRequestGet = aiEndpoint(
  PoolGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/pool');
    if (!env.DATABASE_URL) {
      logger.error('DATABASE_URL not configured');
      return {
        data: { error: 'Pool unavailable', message: 'Server database is not configured.' },
        status: 503,
      };
    }
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, {
        id: true,
        role: true,
      });

      const userId = user.id;
      const system = validated.system || null;
      const systemsParam = validated.systems;
      const systems: string[] | null = systemsParam
        ? systemsParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
      const category = validated.category || null;
      const difficulty = validated.difficulty || null;
      const count = validated.count ? Number.parseInt(validated.count, 10) : DEFAULT_FETCH_COUNT;
      const mode = validated.mode || null;

      // ADMIN CURATION MODE
      if (mode === 'curation') {
        if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
          return { data: { error: 'Admin access required' }, status: 403 };
        }

        const curationWhere: Record<string, unknown> = {};
        if (system) curationWhere.system = system;
        if (difficulty) curationWhere.difficulty = difficulty;

        const curationQuestions = await prisma.preGeneratedQuestion.findMany({
          where: curationWhere,
          orderBy: { generatedAt: 'desc' },
          take: 100,
        });

        logger.info('Admin fetched curation questions', {
          userId: auth.userId,
          count: curationQuestions.length,
        });
        return { data: curationQuestions };
      }

      // Get questions user has already seen
      const seenQuestionIds = await prisma.userQuestionSeen.findMany({
        where: { userId },
        select: { questionId: true },
        orderBy: { lastSeenAt: 'desc' },
        take: MAX_SEEN_HISTORY,
      });
      const seenIds = new Set<string>(
        seenQuestionIds.map((q: { questionId: string }) => q.questionId)
      );

      // Check cache (include systems for didactic multi-system requests)
      const cacheKey = getQuestionPoolCacheKey({
        system: system ?? undefined,
        systems: systems ?? undefined,
        category: category ?? undefined,
        difficulty: difficulty ?? undefined,
      });
      let cachedPool: PreGeneratedQuestionRecord[] | null = null;

      if (isKVAvailable((env as { CACHE?: KVNamespace }).CACHE)) {
        cachedPool = await getFromCache((env as { CACHE: KVNamespace }).CACHE, cacheKey);
      }

      // Get from pre-generated pool (systems array for didactic; single system; or quota-based by blueprint)
      const poolOptions = systems?.length
        ? { count, systems, category, difficulty }
        : { count, system, category, difficulty };

      let poolQuestions: {
        questions: PoolQuestionOutput[];
        remaining: number;
        rawQuestions?: PreGeneratedQuestionRecord[];
      };

      if (!system && !systemsParam) {
        // Quota-based fetch: for each system, fetch targetCount by abbreviation, merge and shuffle (Sprint 8)
        const distribution = calculateTargetDistribution(count);
        const allBySystem: PoolQuestionOutput[] = [];
        let totalRemaining = 0;
        for (const [systemName, targetCount] of Object.entries(distribution)) {
          if (targetCount <= 0) continue;
          const abbrev = getSystemAbbreviation(systemName);
          const result = await getFromPreGeneratedPool(
            prisma,
            userId,
            seenIds,
            { count: targetCount, system: abbrev, category, difficulty }
          );
          allBySystem.push(...result.questions);
          result.questions.forEach((q) => seenIds.add(q.id));
          totalRemaining += result.remaining;
        }
        const shuffled = fisherYatesShuffle(allBySystem);
        poolQuestions = {
          questions: shuffled.slice(0, count),
          remaining: totalRemaining,
        };
      } else {
        poolQuestions = await getFromPreGeneratedPool(
          prisma,
          userId,
          seenIds,
          poolOptions,
          cachedPool
        );
      }

      let questions = poolQuestions.questions;
      let poolAvailable = poolQuestions.remaining;

      // If pool insufficient, supplement from main Question table
      if (questions.length < count) {
        const needed = count - questions.length;
        const mainOptions = systems?.length
          ? { count: needed, systems, category, difficulty }
          : { count: needed, system, category, difficulty };
        const mainQuestions = await getFromMainTable(prisma, userId, seenIds, mainOptions);
        questions = [...questions, ...mainQuestions];
      }

      const threshold = computeThreshold(system, systems);
      const needsGeneration = poolAvailable < threshold;

      // Learner-facing pool reads fail closed. Do not generate and immediately
      // serve unreviewed clinical questions from this hot path; reservoir/admin
      // generation owns pool refill and QA.
      if (needsGeneration && questions.length < count) {
        logger.info('Question pool below threshold; learner hot-path generation suppressed', {
          userId: auth.userId,
          requestedCount: count,
          currentCount: questions.length,
        });
      }
      // Cache the pool questions if available
      if (
        isKVAvailable((env as { CACHE?: KVNamespace }).CACHE) &&
        !cachedPool &&
        poolQuestions.rawQuestions
      ) {
        await setInCache(
          (env as { CACHE: KVNamespace }).CACHE,
          cacheKey,
          poolQuestions.rawQuestions,
          CACHE_CONFIG.TTL.QUESTION_POOL
        );
      }

      logger.info('Fetched pool questions', {
        userId: auth.userId,
        count: questions.length,
        poolAvailable,
      });

      // Fire-and-forget: increment timesServed for each PreGeneratedQuestion served.
      // Enables the flag-rate kill switch: flagRate > 0.1 AND timesServed >= 20 → auto-reject.
      const poolQuestionIds = questions
        .filter((q) => (q as PoolQuestionOutput).source === 'pool')
        .map((q) => (q as PoolQuestionOutput).id)
        .filter(Boolean);
      if (poolQuestionIds.length > 0) {
        prisma.preGeneratedQuestion
          .updateMany({
            where: { id: { in: poolQuestionIds } },
            data: { timesServed: { increment: 1 } },
          })
          .catch((err: unknown) =>
            logger.warn('pool timesServed increment failed (non-fatal)', {
              error: err instanceof Error ? err.message : String(err),
            })
          );
      }

      return {
        data: {
          questions,
          poolStatus: { available: poolAvailable, needsGeneration, threshold },
        },
        headers: { 'X-Cache': cachedPool ? 'HIT' : 'MISS' },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching pool questions', {
        error: errMsg,
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.userId,
      });
      const isDbUnavailable =
        /connect|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|accelerate|pool/i.test(errMsg);
      return {
        data: {
          error: isDbUnavailable ? 'Pool unavailable' : 'Failed to fetch pool questions',
          message: isDbUnavailable
            ? 'Database is temporarily unavailable. Please try again.'
            : errMsg || 'Please try again later.',
        },
        status: isDbUnavailable ? 503 : 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

export const onRequestPost = authenticatedEndpoint(PoolPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/pool');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await resolveOrCreateUserRecord(prisma, auth.userId, {
      id: true,
      role: true,
    });
    if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      logger.warn('Rejected non-admin pool seed request', { userId: auth.userId });
      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    const q = validated.question;
    const correctAnswerIndex = resolveCorrectAnswerIndex(q.correctAnswer, q.options);
    if (correctAnswerIndex === null) {
      return {
        data: { error: 'correctAnswer must resolve to one of the provided options' },
        status: 400,
      };
    }
    const seededAt = new Date();
    const seedQuestionData = {
      vignette: q.vignette,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      correctAnswerIndex,
      explanation: q.explanation,
      conditionName: q.conditionName,
      system: q.system,
      subcategory: q.subcategory,
      tags: q.tags,
    };
    const canonicalSeedQuestion = buildCanonicalQuestionMirrorData({
      id: q.id,
      questionData: seedQuestionData,
      system: q.system,
      difficulty: q.difficulty || 'medium',
      conditionId: q.conditionId,
      medicalContentId: q.medicalContentId,
      generatedAt: seededAt,
    }, {
      source: 'admin_seed_pre_generated',
      humanReviewed: true,
    });
    if (!canonicalSeedQuestion) {
      return {
        data: { error: 'Seeded question must be mirrorable to the canonical Question table' },
        status: 400,
      };
    }

    await prisma.preGeneratedQuestion.create({
      data: {
        id: q.id,
        questionType: 'general',
        system: q.system,
        conditionId: q.conditionId,
        medicalContentId: q.medicalContentId,
        difficulty: q.difficulty || 'medium',
        questionData: seedQuestionData,
        generatedAt: new Date(),
        usedAt: null,
        quality: 10,
        validationStatus: 'approved',
        validatedAt: seededAt,
        validatedBy: auth.userId,
        // Phase 4: populate dedup hash and taxonomy at creation
        semanticHash: computeSemanticHash(q.question),
      },
    });

    await upsertCanonicalQuestionMirror(prisma, {
      id: q.id,
      questionData: seedQuestionData,
      system: q.system,
      difficulty: q.difficulty || 'medium',
      conditionId: q.conditionId,
      medicalContentId: q.medicalContentId,
      generatedAt: seededAt,
    }, {
      source: 'admin_seed_pre_generated',
      humanReviewed: true,
    });

    logger.info('Question seeded to pool', { userId: auth.userId, questionId: q.id });

    return { data: { success: true }, status: 201 };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error seeding question to pool', {
      error: errMsg,
      userId: auth.userId,
    });
    return {
      data: {
        error: 'Failed to seed question to pool',
        message: errMsg || 'Please try again later.',
      },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { requestsPerMinute: 30 });

// Helper functions preserved from original file
async function getFromPreGeneratedPool(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string | null;
    systems?: string[] | null;
    category?: string | null;
    difficulty?: string | null;
  },
  cachedQuestions?: PreGeneratedQuestionRecord[] | null,
): Promise<{
  questions: PoolQuestionOutput[];
  remaining: number;
  rawQuestions?: PreGeneratedQuestionRecord[];
}> {
  const { count, system, systems, category, difficulty } = options;
  const hasSystemFilter = system || (systems && systems.length > 0);
  const logger = createEndpointLogger('pool:getFromPreGeneratedPool');
  let preGenQuestions: PreGeneratedQuestionRecord[];
  let remaining: number;

  // Bound pool scans to avoid timeouts on large session requests.
  const fetchCount = hasSystemFilter
    ? Math.min(Math.max(count * 3, count + 12), 120)
    : Math.min(Math.max(count * 8, count + 40), 240);

  const approvedCachedQuestions = cachedQuestions?.filter(
    (question) => question.validationStatus === PRODUCTION_PREGENERATED_SAFETY_FILTER.validationStatus
  );
  const usedTrustedCache = Boolean(approvedCachedQuestions && approvedCachedQuestions.length > 0);

  if (approvedCachedQuestions && approvedCachedQuestions.length > 0) {
    preGenQuestions = approvedCachedQuestions;
    remaining = approvedCachedQuestions.length;
  } else {
    const where: Record<string, unknown> = withProductionPregeneratedSafety({});
    if (systems?.length) where.system = { in: systems };
    else if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (category) where.questionType = category;
    logger.info('Fetching pre-generated pool', { systems, system, difficulty, category, fetchCount });

    // Prisma Accelerate cacheStrategy requires type widening (not in base Prisma types)
    const findManyWithCache = prisma.preGeneratedQuestion.findMany as (args: Record<string, unknown>) => Promise<unknown[]>;
    const countWithCache = prisma.preGeneratedQuestion.count as (args: Record<string, unknown>) => Promise<number>;

    const dbResults = (await findManyWithCache({
      where,
      take: fetchCount,
      orderBy: { generatedAt: 'asc' },
      ...CACHE_STRATEGY.QUESTIONS, // 5min cache for question pool
    })) as PreGeneratedQuestionDbRecord[];
    preGenQuestions = dbResults.map(mapToPreGeneratedQuestion);
    logger.info('Pre-generated pool fetched', { dbResultsCount: dbResults.length, preGenQuestionsCount: preGenQuestions.length });
    remaining = await countWithCache({
      where,
      ...CACHE_STRATEGY.AGGREGATE,
    });
  }

  // Filter out seen questions
  const unseenQuestions = preGenQuestions.filter((q) => !seenIds.has(q.id));
  logger.info('Pre-generated pool after seen filter', { total: preGenQuestions.length, unseen: unseenQuestions.length, seenIds: seenIds.size });

  // Shuffle all questions first
  const shuffledQuestions = fisherYatesShuffle(unseenQuestions);

  let selectedQuestions: PreGeneratedQuestionRecord[];

  if (hasSystemFilter) {
    // If specific system(s) requested, just take from shuffled pool
    selectedQuestions = shuffledQuestions.slice(0, count);
  } else {
    // PANCE-weighted selection from the shuffled pool
    selectedQuestions = selectByPanceDistribution(shuffledQuestions, count);
  }
  logger.info('Selected questions', { selectedCount: selectedQuestions.length, count, hasSystemFilter });

  const questions: PoolQuestionOutput[] = [];
  const toMarkUsed: string[] = [];

  for (const q of selectedQuestions) {
    const data = q.questionData;
    const optionsData = data.options || data.answers || data.choices;
    const optionsArr: string[] = Array.isArray(optionsData) ? optionsData : [];

    // Skip questions with missing or empty options
    if (optionsArr.length === 0) {
      console.warn(
        `[Pool] Skipping question ${q.id} - no options found in questionData:`,
        Object.keys(data)
      );
      continue;
    }

    // Skip questions with missing question text
    if (!data.question) {
      console.warn(`[Pool] Skipping question ${q.id} - no question text found`);
      continue;
    }

    const rawCorrectAnswer =
      typeof data.correctAnswer === 'string' ? data.correctAnswer.trim() : '';
    const resolvedCorrectIndex =
      rawCorrectAnswer.length > 0
        ? resolveCorrectAnswerIndex(rawCorrectAnswer, optionsArr)
        : typeof data.correctAnswerIndex === 'number' &&
            data.correctAnswerIndex >= 0 &&
            data.correctAnswerIndex < optionsArr.length
          ? data.correctAnswerIndex
          : typeof data.correctIndex === 'number' &&
              data.correctIndex >= 0 &&
              data.correctIndex < optionsArr.length
            ? data.correctIndex
            : null;

    if (resolvedCorrectIndex === null) {
      console.warn(`[Pool] Skipping question ${q.id} - unresolvable correct answer`);
      continue;
    }

    const correctAnswer =
      rawCorrectAnswer.length > 0
        ? rawCorrectAnswer
        : (indexToLetter(resolvedCorrectIndex) ?? optionsArr[resolvedCorrectIndex] ?? '');

    questions.push({
      id: q.id,
      vignette: data.vignette,
      question: data.question,
      imageUrl: data.imageUrl,
      options: optionsArr,
      correctAnswer,
      correctAnswerIndex: resolvedCorrectIndex,
      explanation: data.explanation,
      system: q.system || 'General',
      difficulty: q.difficulty || 'medium',
      tags: data.tags,
      conditionId: q.conditionId,
      source: 'pool',
      fromStaging: q.questionType === 'staging',
      contentSource: data.contentSource,
      contentSourceTitle: data.contentSourceTitle,
    });
    toMarkUsed.push(q.id);
  }

  if (toMarkUsed.length > 0) {
    const now = new Date();
    await prisma.userQuestionSeen.createMany({
      data: toMarkUsed.map((questionId) => ({
        id: crypto.randomUUID(),
        userId,
        questionId,
        questionType: 'pre_generated',
        firstSeenAt: now,
        lastSeenAt: now,
        timesShown: 1,
        timesCorrect: 0,
        timesIncorrect: 0,
        updatedAt: now,
      })),
      skipDuplicates: true,
    });
  }

  return { questions, remaining, rawQuestions: usedTrustedCache ? undefined : preGenQuestions };
}

async function getFromMainTable(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string | null;
    systems?: string[] | null;
    category?: string | null;
    difficulty?: string | null;
  }
): Promise<PoolQuestionOutput[]> {
  const { count, system, systems, category, difficulty } = options;
  const hasSystemFilter = system || (systems && systems.length > 0);
  const logger = createEndpointLogger('pool:getFromMainTable');

  // Bound main-table scans to avoid large fan-out when the pool is thin.
  const fetchCount = hasSystemFilter
    ? Math.min(Math.max(count * 3, count + 10), 100)
    : Math.min(Math.max(count * 6, count + 30), 180);

  const where: Record<string, unknown> = withProductionQuestionSafety({});
  if (systems?.length) where.system = { in: systems };
  else if (system) where.system = system;
  if (difficulty) where.difficulty = difficulty;
  if (category) where.tags = { array_contains: category };
  logger.info('Fetching main table pool', { systems, system, difficulty, category, fetchCount });

  const questions = await prisma.question.findMany({
    where,
    take: fetchCount,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      vignette: true,
      question: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      system: true,
      difficulty: true,
      tags: true,
    },
  });
  logger.info('Main table fetched', { totalQuestions: questions.length });

  // Filter out seen questions
  const unseenQuestions = questions.filter((q: MainQuestionRecord) => !seenIds.has(q.id));

  // Shuffle all questions first
  const shuffledQuestions = fisherYatesShuffle(unseenQuestions);

  // Select questions - use PANCE distribution if no specific system(s)
  const selectedQuestions = hasSystemFilter
    ? shuffledQuestions.slice(0, count)
    : selectByPanceDistribution(shuffledQuestions, count);

  const result: PoolQuestionOutput[] = [];
  const toRecord: string[] = [];

  for (const q of selectedQuestions) {
    // Convert options from object format {A: "text", B: "text"} to array format ["text", "text"]
    let optionsArray: string[] = [];
    if (Array.isArray(q.options)) {
      optionsArray = q.options.filter((x): x is string => typeof x === 'string');
    } else if (typeof q.options === 'object' && q.options !== null) {
      // Object format: { A: "Option A", B: "Option B", ... }
      const optionsObj = q.options as Record<string, string>;
      const sortedKeys = Object.keys(optionsObj).sort((a, b) => a.localeCompare(b)); // A, B, C, D, E
      optionsArray = sortedKeys
        .map((key) => optionsObj[key])
        .filter((x): x is string => typeof x === 'string');
    }

    // Skip questions with no valid options
    if (optionsArray.length === 0) {
      console.warn(`[Pool] Skipping main question ${q.id} - no valid options`);
      continue;
    }

    result.push({
      id: q.id,
      vignette: q.vignette ?? undefined,
      question: q.question,
      options: optionsArray,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? undefined,
      system: q.system ?? 'General',
      difficulty: q.difficulty || 'medium',
      tags: Array.isArray(q.tags)
        ? (q.tags.filter((x): x is string => typeof x === 'string') as string[])
        : [],
      source: 'main',
      fromStaging: false,
    });
    toRecord.push(q.id);
  }

  if (toRecord.length > 0) {
    await prisma.userQuestionSeen.createMany({
      data: toRecord.map((questionId) => ({
        id: crypto.randomUUID(),
        userId,
        questionId,
        questionType: 'question',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        timesShown: 1,
        timesCorrect: 0,
        timesIncorrect: 0,
        updatedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  return result;
}
