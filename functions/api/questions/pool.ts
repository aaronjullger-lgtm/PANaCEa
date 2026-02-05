/**
 * API Endpoint: /api/questions/pool
 * GET: Get questions from the question pool with user-specific filtering
 * POST: Seed a question back into the pool
 */

import { z } from 'zod';
import { selectByPanceDistribution, fisherYatesShuffle } from '../../../lib/poolSelection';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  CACHE_STRATEGY,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  getFromCache,
  setInCache,
  getQuestionPoolCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';

// Type definitions for question pool operations
interface QuestionDataJson {
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
  questionData: QuestionDataJson;
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
    questionData: r.questionData as QuestionDataJson,
    generatedAt: r.generatedAt,
    usedAt: r.usedAt,
  };
}

const POOL_LOW_THRESHOLD = 20;
const DEFAULT_FETCH_COUNT = 10;

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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  PoolGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/pool');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true, role: true },
      });

      if (!user) {
        return {
          data: { error: 'User not found', message: 'Your user account has not been synced yet.' },
          status: 404,
        };
      }

      const userId = user.id;
      const system = validated.system || null;
      const systemsParam = validated.systems;
      const systems: string[] | null = systemsParam
        ? systemsParam.split(',').map((s) => s.trim()).filter(Boolean)
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

      // Get from pre-generated pool (systems array for didactic; single system otherwise)
      const poolOptions = systems?.length
        ? { count, systems, category, difficulty }
        : { count, system, category, difficulty };
      const poolQuestions = await getFromPreGeneratedPool(
        prisma,
        userId,
        seenIds,
        poolOptions,
        cachedPool
      );
      let questions = poolQuestions.questions;
      const poolAvailable = poolQuestions.remaining;

      // If pool insufficient, supplement from main Question table
      if (questions.length < count) {
        const needed = count - questions.length;
        const mainOptions = systems?.length
          ? { count: needed, systems, category, difficulty }
          : { count: needed, system, category, difficulty };
        const mainQuestions = await getFromMainTable(prisma, userId, seenIds, mainOptions);
        questions = [...questions, ...mainQuestions];
      }

      const needsGeneration = poolAvailable < POOL_LOW_THRESHOLD;

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

      return {
        data: {
          questions,
          poolStatus: { available: poolAvailable, needsGeneration, threshold: POOL_LOW_THRESHOLD },
        },
        headers: { 'X-Cache': cachedPool ? 'HIT' : 'MISS' },
      };
    } catch (error) {
      logger.error('Error fetching pool questions', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
      });
      throw new Error('Failed to fetch pool questions');
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
    const q = validated.question;

    await prisma.preGeneratedQuestion.create({
      data: {
        id: q.id,
        questionType: 'general',
        system: q.system,
        conditionId: q.conditionId,
        medicalContentId: q.medicalContentId,
        difficulty: q.difficulty || 'medium',
        questionData: {
          vignette: q.vignette,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          conditionName: q.conditionName,
          system: q.system,
          subcategory: q.subcategory,
          tags: q.tags,
        },
        generatedAt: new Date(),
        usedAt: null,
      },
    });

    logger.info('Question seeded to pool', { userId: auth.userId, questionId: q.id });

    return { data: { success: true }, status: 201 };
  } catch (error) {
    logger.error('Error seeding question to pool', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to seed question to pool');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

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
  cachedQuestions?: PreGeneratedQuestionRecord[] | null
): Promise<{
  questions: PoolQuestionOutput[];
  remaining: number;
  rawQuestions?: PreGeneratedQuestionRecord[];
}> {
  const { count, system, systems, category, difficulty } = options;
  const hasSystemFilter = system || (systems && systems.length > 0);
  let preGenQuestions: PreGeneratedQuestionRecord[];
  let remaining: number;

  // Fetch more questions than needed for PANCE-weighted selection
  const fetchMultiplier = hasSystemFilter ? 5 : 20; // Fetch 20x when no system filter for better distribution
  const fetchCount = count * fetchMultiplier;

  if (cachedQuestions && cachedQuestions.length > 0) {
    preGenQuestions = cachedQuestions;
    remaining = cachedQuestions.length;
  } else {
    const where: Record<string, unknown> = {
      validationStatus: { not: 'rejected' }, // Kill switch: rejected questions are pulled from pool
    };
    if (systems?.length) where.system = { in: systems };
    else if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (category) where.questionType = category;

    const dbResults = await (prisma.preGeneratedQuestion.findMany as any)({
      where,
      take: fetchCount,
      orderBy: { generatedAt: 'asc' },
      ...(CACHE_STRATEGY.QUESTIONS as any), // 5min cache for question pool
    });
    preGenQuestions = dbResults.map(mapToPreGeneratedQuestion);
    remaining = await (prisma.preGeneratedQuestion.count as any)({
      where,
      ...(CACHE_STRATEGY.AGGREGATE as any),
    });
  }

  // Filter out seen questions
  const unseenQuestions = preGenQuestions.filter((q) => !seenIds.has(q.id));

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

    // Handle both correctAnswer (letter "A") and correctAnswerIndex (number 0) formats
    let correctAnswer = data.correctAnswer;
    if (!correctAnswer && typeof data.correctAnswerIndex === 'number') {
      const letters = ['A', 'B', 'C', 'D'];
      correctAnswer = letters[data.correctAnswerIndex] || 'A';
    }
    if (!correctAnswer && typeof data.correctIndex === 'number') {
      const letters = ['A', 'B', 'C', 'D'];
      correctAnswer = letters[data.correctIndex] || 'A';
    }

    questions.push({
      id: q.id,
      vignette: data.vignette,
      question: data.question,
      imageUrl: data.imageUrl,
      options: optionsArr,
      correctAnswer: correctAnswer || 'A',
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
    await prisma.userQuestionSeen.createMany({
      data: toMarkUsed.map((questionId) => ({
        userId,
        questionId,
        questionType: 'pre_generated',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        timesShown: 1,
        timesCorrect: 0,
        timesIncorrect: 0,
      })),
      skipDuplicates: true,
    });
  }

  return { questions, remaining, rawQuestions: cachedQuestions ? undefined : preGenQuestions };
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

  // Fetch more questions than needed for PANCE-weighted selection
  const fetchMultiplier = hasSystemFilter ? 5 : 20;
  const fetchCount = count * fetchMultiplier;

  const where: Record<string, unknown> = {};
  if (systems?.length) where.system = { in: systems };
  else if (system) where.system = system;
  if (difficulty) where.difficulty = difficulty;
  if (category) where.tags = { array_contains: category };

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
      tags: Array.isArray(q.tags) ? (q.tags.filter((x): x is string => typeof x === 'string') as string[]) : [],
      source: 'main',
      fromStaging: false,
    });
    toRecord.push(q.id);
  }

  if (toRecord.length > 0) {
    await prisma.userQuestionSeen.createMany({
      data: toRecord.map((questionId) => ({
        userId,
        questionId,
        questionType: 'question',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        timesShown: 1,
        timesCorrect: 0,
        timesIncorrect: 0,
      })),
      skipDuplicates: true,
    });
  }

  return result;
}
