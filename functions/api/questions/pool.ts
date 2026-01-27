/**
 * API Endpoint: /api/questions/pool
 * GET: Get questions from the question pool with user-specific filtering
 * POST: Seed a question back into the pool
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, CACHE_STRATEGY } from '../_shared/prisma-edge';
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
  correctAnswerIndex?: number;
  correctIndex?: number;
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

// Official PANCE Content Blueprint Percentages (2024)
// Used for weighted question selection when no specific system is requested
const PANCE_SYSTEM_PERCENTAGES: Record<string, number> = {
  CV: 11,       // Cardiovascular
  PULM: 9,      // Pulmonary
  GI: 8,        // GI/Nutrition
  MSK: 8,       // Musculoskeletal
  ID: 7,        // Infectious Disease
  NEURO: 7,     // Neurology
  PSYCH: 7,     // Psychiatry
  REPRO: 7,     // Reproductive
  ENDO: 6,      // Endocrine
  HEENT: 6,     // HEENT
  PRO: 6,       // Professional Practice
  HEME: 5,      // Hematology
  RENAL: 5,     // Renal
  DERM: 4,      // Dermatology
  GU: 4,        // Genitourinary
};

/**
 * Select questions from a pool following PANCE distribution percentages
 * Uses weighted random selection to properly handle fractional allocations
 * Over 360 questions, this will match PANCE blueprint distribution
 */
function selectByPanceDistribution<T extends { system: string | null }>(
  pool: T[],
  count: number
): T[] {
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool;
  
  // Group questions by system
  const bySystem: Record<string, T[]> = {};
  for (const q of pool) {
    const sys = q.system || 'General';
    bySystem[sys] ??= [];
    bySystem[sys].push(q);
  }
  
  // Shuffle each system's questions for randomness within system
  for (const sys of Object.keys(bySystem)) {
    bySystem[sys] = fisherYatesShuffle(bySystem[sys]);
  }
  
  // Build weighted selection array based on PANCE percentages
  // Each system gets weight proportional to its PANCE percentage
  const systemWeights: { system: string; weight: number; index: number }[] = [];
  const totalPercent = Object.values(PANCE_SYSTEM_PERCENTAGES).reduce((a, b) => a + b, 0);
  
  for (const sys of Object.keys(bySystem)) {
    const pancePercent = PANCE_SYSTEM_PERCENTAGES[sys] || 3; // Default 3% for unknown
    systemWeights.push({ 
      system: sys, 
      weight: pancePercent / totalPercent,
      index: 0 // Track how many we've taken from this system
    });
  }
  
  // Select questions using weighted random selection
  const selected: T[] = [];
  
  while (selected.length < count) {
    // Filter to systems that still have questions available
    const available = systemWeights.filter(
      sw => sw.index < bySystem[sw.system].length
    );
    
    if (available.length === 0) break;
    
    // Calculate total weight of available systems
    const totalWeight = available.reduce((sum, sw) => sum + sw.weight, 0);
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    let chosen: typeof available[0] | null = null;
    
    for (const sw of available) {
      random -= sw.weight;
      if (random <= 0) {
        chosen = sw;
        break;
      }
    }
    
    // Fallback to first available if rounding issues
    if (!chosen) chosen = available[0];
    
    // Add question from chosen system
    const question = bySystem[chosen.system][chosen.index];
    if (question) {
      selected.push(question);
      chosen.index++;
    }
  }
  
  // Final shuffle to interleave (weighted selection already varied, but this ensures no patterns)
  return fisherYatesShuffle(selected);
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
const PoolGetSchema = z.object({
  system: z.string().optional(),
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
    const category = validated.category || null;
    const difficulty = validated.difficulty || null;
    const count = validated.count
      ? Number.parseInt(validated.count, 10)
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

  // Fetch more questions than needed for PANCE-weighted selection
  const fetchMultiplier = system ? 5 : 20; // Fetch 20x when no system filter for better distribution
  const fetchCount = count * fetchMultiplier;

  if (cachedQuestions && cachedQuestions.length > 0) {
    preGenQuestions = cachedQuestions;
    remaining = cachedQuestions.length;
  } else {
    const where: Record<string, unknown> = {};
    if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (category) where.questionType = category;

    const dbResults = await prisma.preGeneratedQuestion.findMany({
      where,
      take: fetchCount,
      orderBy: { generatedAt: 'asc' },
      ...CACHE_STRATEGY.QUESTIONS, // 5min cache for question pool
    });
    preGenQuestions = dbResults.map(mapToPreGeneratedQuestion);
    remaining = await prisma.preGeneratedQuestion.count({ where, ...CACHE_STRATEGY.AGGREGATE });
  }

  // Filter out seen questions
  const unseenQuestions = preGenQuestions.filter((q) => !seenIds.has(q.id));
  
  // Shuffle all questions first
  const shuffledQuestions = fisherYatesShuffle(unseenQuestions);
  
  let selectedQuestions: PreGeneratedQuestionRecord[];
  
  if (system) {
    // If specific system requested, just take from shuffled pool
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
      console.warn(`[Pool] Skipping question ${q.id} - no options found in questionData:`, 
        Object.keys(data));
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
      options: optionsArr,
      correctAnswer: correctAnswer || 'A',
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
  
  // Fetch more questions than needed for PANCE-weighted selection
  const fetchMultiplier = system ? 5 : 20;
  const fetchCount = count * fetchMultiplier;
  
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
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
  
  // Select questions - use PANCE distribution if no specific system
  const selectedQuestions = system 
    ? shuffledQuestions.slice(0, count)
    : selectByPanceDistribution(shuffledQuestions, count);

  const result: PoolQuestionOutput[] = [];
  const toRecord: string[] = [];

  for (const q of selectedQuestions) {
    // Convert options from object format {A: "text", B: "text"} to array format ["text", "text"]
    let optionsArray: string[] = [];
    if (Array.isArray(q.options)) {
      optionsArray = q.options;
    } else if (typeof q.options === 'object' && q.options !== null) {
      // Object format: { A: "Option A", B: "Option B", ... }
      const optionsObj = q.options as Record<string, string>;
      const sortedKeys = Object.keys(optionsObj).sort((a, b) => a.localeCompare(b)); // A, B, C, D, E
      optionsArray = sortedKeys.map(key => optionsObj[key]);
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
