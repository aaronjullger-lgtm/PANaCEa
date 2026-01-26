/**
 * API Endpoint: /api/questions/pool
 * GET: Get questions from the question pool with user-specific filtering
 * POST: Seed a question back into the pool
 */

import { z } from 'zod';
import { authenticatedEndpoint, adminEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
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
  options?: string[];
  answers?: string[];
  choices?: string[];
  correctAnswer?: string;
  explanation?: string;
  conditionName?: string;
  system?: string;
  subcategory?: string;
  tags?: string[];
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
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  system: string;
  difficulty: string;
  tags?: string[];
  conditionId?: string | null;
  source: 'pool' | 'main';
}

interface MainQuestionRecord {
  id: string;
  vignette: string | null;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  system: string | null;
  difficulty: string | null;
  tags: string[];
}

/**
 * Fisher-Yates shuffle algorithm for unbiased randomization
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

const POOL_LOW_THRESHOLD = 20;
const DEFAULT_FETCH_COUNT = 10;

// Schema for query params - flat structure since source is 'query'
const PoolGetSchema = z.object({
  system: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  count: z.string().optional(),
  mode: z.string().optional(),
});

const PoolPostSchema = z.object({
  body: z.object({
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
    const category = validated.category || null;
    const difficulty = validated.difficulty || null;
    const count = validated.count
      ? parseInt(validated.count, 10)
      : DEFAULT_FETCH_COUNT;
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

    // Check cache
    const cacheKey = getQuestionPoolCacheKey({
      system: system ?? undefined,
      category: category ?? undefined,
      difficulty: difficulty ?? undefined,
    });
    let cachedPool: PreGeneratedQuestionRecord[] | null = null;

    if (isKVAvailable((env as { CACHE?: KVNamespace }).CACHE)) {
      cachedPool = await getFromCache((env as { CACHE: KVNamespace }).CACHE, cacheKey);
    }

    // Get from pre-generated pool
    const poolQuestions = await getFromPreGeneratedPool(
      prisma,
      userId,
      seenIds,
      { count, system, category, difficulty },
      cachedPool
    );
    let questions = poolQuestions.questions;
    const poolAvailable = poolQuestions.remaining;

    // If pool insufficient, supplement from main Question table
    if (questions.length < count) {
      const needed = count - questions.length;
      const mainQuestions = await getFromMainTable(prisma, userId, seenIds, {
        count: needed,
        system,
        category,
        difficulty,
      });
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
    const q = validated.body.question;

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
    category?: string | null;
    difficulty?: string | null;
  },
  cachedQuestions?: PreGeneratedQuestionRecord[] | null
): Promise<{
  questions: PoolQuestionOutput[];
  remaining: number;
  rawQuestions?: PreGeneratedQuestionRecord[];
}> {
  const { count, system, category, difficulty } = options;
  let preGenQuestions: PreGeneratedQuestionRecord[];
  let remaining: number;

  if (cachedQuestions && cachedQuestions.length > 0) {
    preGenQuestions = cachedQuestions;
    remaining = cachedQuestions.length;
  } else {
    const where: Record<string, unknown> = {};
    if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (category) where.questionType = category;

    const fetchCount = count * 5;
    const dbResults = await prisma.preGeneratedQuestion.findMany({
      where,
      take: fetchCount,
      orderBy: { generatedAt: 'asc' },
    });
    preGenQuestions = dbResults.map(
      (r: {
        id: string;
        questionType: string;
        system: string | null;
        conditionId: string | null;
        medicalContentId: string | null;
        difficulty: string | null;
        questionData: unknown;
        generatedAt: Date;
        usedAt: Date | null;
      }): PreGeneratedQuestionRecord => ({
        id: r.id,
        questionType: r.questionType,
        system: r.system,
        conditionId: r.conditionId,
        medicalContentId: r.medicalContentId,
        difficulty: r.difficulty,
        questionData: r.questionData as QuestionDataJson,
        generatedAt: r.generatedAt,
        usedAt: r.usedAt,
      })
    );
    remaining = await prisma.preGeneratedQuestion.count({ where });
  }

  const unseenQuestions = preGenQuestions.filter((q) => !seenIds.has(q.id));
  const shuffledQuestions = fisherYatesShuffle(unseenQuestions);
  const selectedQuestions = shuffledQuestions.slice(0, count);

  const questions: PoolQuestionOutput[] = [];
  const toMarkUsed: string[] = [];

  for (const q of selectedQuestions) {
    const data = q.questionData;
    const optionsData = data.options || data.answers || data.choices;
    const optionsArr: string[] = Array.isArray(optionsData) ? optionsData : [];

    questions.push({
      id: q.id,
      vignette: data.vignette,
      question: data.question,
      options: optionsArr,
      correctAnswer: data.correctAnswer,
      explanation: data.explanation,
      system: q.system || 'General',
      difficulty: q.difficulty || 'medium',
      tags: data.tags,
      conditionId: q.conditionId,
      source: 'pool',
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
    category?: string | null;
    difficulty?: string | null;
  }
): Promise<PoolQuestionOutput[]> {
  const { count, system, category, difficulty } = options;
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (difficulty) where.difficulty = difficulty;
  if (category) where.tags = { array_contains: category };

  const fetchCount = count * 5;
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

  const unseenQuestions = questions.filter((q: MainQuestionRecord) => !seenIds.has(q.id));
  const shuffledQuestions = fisherYatesShuffle<MainQuestionRecord>(unseenQuestions);
  const selectedQuestions: MainQuestionRecord[] = shuffledQuestions.slice(0, count);

  const result: PoolQuestionOutput[] = [];
  const toRecord: string[] = [];

  for (const q of selectedQuestions) {
    result.push({
      id: q.id,
      vignette: q.vignette ?? undefined,
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? undefined,
      system: q.system ?? 'General',
      difficulty: q.difficulty || 'medium',
      tags: q.tags,
      source: 'main',
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
