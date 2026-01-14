/**
 * Question Pool Service
 * 
 * Database-first question management with pre-generation.
 * - Serves questions from pre-generated pool
 * - Triggers background generation when pool runs low
 * - Tracks which questions each user has seen
 * - Ensures no user gets the same question twice
 */

import { prisma } from '@/lib/prisma';

// Thresholds for question pool management
const POOL_LOW_THRESHOLD = 20;  // When to trigger background generation
const POOL_REFILL_COUNT = 50;   // How many questions to generate at once
const DEFAULT_FETCH_COUNT = 10; // Default questions per request

export interface PoolQuestion {
  id: string;
  vignette?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  system: string;
  difficulty: string;
  tags?: string[];
  conditionId?: string;
}

export interface PoolStatus {
  available: number;
  lowThreshold: number;
  needsGeneration: boolean;
  system?: string;
}

/**
 * Get questions for a user, ensuring no repeats
 * Uses pre-generated pool first, then falls back to Question table
 */
export async function getQuestionsForUser(
  userId: string,
  options: {
    count?: number;
    system?: string;
    difficulty?: string;
    category?: string;
  } = {}
): Promise<PoolQuestion[]> {
  const { count = DEFAULT_FETCH_COUNT, system, difficulty, category } = options;

  // First, try to get unseen questions from the pre-generated pool
  const preGenQuestions = await getFromPreGeneratedPool(userId, {
    count,
    system,
    difficulty,
    category,
  });

  if (preGenQuestions.length >= count) {
    // Check if pool is running low and trigger background generation
    checkAndTriggerGeneration(system, category).catch(console.error);
    return preGenQuestions;
  }

  // If pool is insufficient, supplement from main Question table
  const needed = count - preGenQuestions.length;
  const mainQuestions = await getFromMainTable(userId, {
    count: needed,
    system,
    difficulty,
    category,
  });

  // Always check pool status and trigger generation if needed
  checkAndTriggerGeneration(system, category).catch(console.error);

  return [...preGenQuestions, ...mainQuestions];
}

/**
 * Get questions from the pre-generated pool
 */
async function getFromPreGeneratedPool(
  userId: string,
  options: {
    count: number;
    system?: string;
    difficulty?: string;
    category?: string;
  }
): Promise<PoolQuestion[]> {
  const { count, system, difficulty, category } = options;

  // Get IDs of questions this user has already seen
  const seenQuestionIds = await prisma.userQuestionSeen.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set(seenQuestionIds.map(q => q.questionId));

  // Build where clause for pre-generated questions
  // Do NOT filter by usedAt - questions remain available to all users
  // Per-user filtering happens via seenIds from UserQuestionSeen
  const where: any = {};

  if (system) {
    where.system = system;
  }

  if (difficulty) {
    where.difficulty = difficulty;
  }

  if (category) {
    where.questionType = category;
  }

  // Fetch available pre-generated questions
  const preGenQuestions = await prisma.preGeneratedQuestion.findMany({
    where,
    take: count * 2, // Fetch extra to account for filtering
    orderBy: { generatedAt: 'asc' }, // Use oldest first
  });

  // Filter out questions user has seen and map to PoolQuestion format
  const availableQuestions: PoolQuestion[] = [];
  const toMarkUsed: string[] = [];

  for (const q of preGenQuestions) {
    if (availableQuestions.length >= count) break;
    
    // Skip if user has seen this question
    if (seenIds.has(q.id)) continue;

    const data = q.questionData as any;
    availableQuestions.push({
      id: q.id,
      vignette: data.vignette,
      question: data.question,
      options: data.options || [],
      correctAnswer: data.correctAnswer,
      explanation: data.explanation,
      system: q.system || 'General',
      difficulty: q.difficulty,
      tags: data.tags,
      conditionId: q.conditionId || undefined,
    });
    toMarkUsed.push(q.id);
  }

  // Record in user history ONLY - do NOT mark questions as globally used
  // This enables multi-tenant pooling where each user gets fresh questions
  if (toMarkUsed.length > 0) {
    await prisma.userQuestionSeen.createMany({
      data: toMarkUsed.map(questionId => ({
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

  return availableQuestions;
}

/**
 * Get questions from the main Question table
 */
async function getFromMainTable(
  userId: string,
  options: {
    count: number;
    system?: string;
    difficulty?: string;
    category?: string;
  }
): Promise<PoolQuestion[]> {
  const { count, system, difficulty, category } = options;

  // Get IDs of questions this user has already seen
  const seenQuestionIds = await prisma.userQuestionSeen.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const seenIds = new Set(seenQuestionIds.map(q => q.questionId));

  // Build where clause
  const where: any = {};

  if (system) {
    where.system = system;
  }

  if (difficulty) {
    where.difficulty = difficulty;
  }

  if (category) {
    where.tags = { array_contains: category };
  }

  // Fetch questions
  const questions = await prisma.question.findMany({
    where,
    take: count * 2, // Fetch extra to account for filtering
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

  // Filter out questions user has seen
  const availableQuestions: PoolQuestion[] = [];
  const toRecord: string[] = [];

  for (const q of questions) {
    if (availableQuestions.length >= count) break;
    if (seenIds.has(q.id)) continue;

    availableQuestions.push({
      id: q.id,
      vignette: q.vignette || undefined,
      question: q.question,
      options: Array.isArray(q.options) ? q.options as string[] : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      system: q.system,
      difficulty: q.difficulty || 'medium',
      tags: q.tags as string[] || [],
    });
    toRecord.push(q.id);
  }

  // Record in user history
  if (toRecord.length > 0) {
    await prisma.userQuestionSeen.createMany({
      data: toRecord.map(questionId => ({
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

  return availableQuestions;
}

/**
 * Check pool status and trigger background generation if needed
 * Now counts ALL questions (not just unused) since questions are no longer "consumed"
 */
async function checkAndTriggerGeneration(
  system?: string,
  category?: string
): Promise<void> {
  // Count all questions (not filtered by usedAt since we no longer mark questions as used)
  const where: any = {};
  if (system) where.system = system;
  if (category) where.questionType = category;

  const availableCount = await prisma.preGeneratedQuestion.count({ where });

  if (availableCount < POOL_LOW_THRESHOLD) {
    // Trigger background generation via API
    try {
      // This calls the background job API to queue generation
      await fetch('/api/questions/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          category,
          count: POOL_REFILL_COUNT,
        }),
      });
      console.log(`[QuestionPool] Triggered generation: system=${system}, category=${category}, count=${POOL_REFILL_COUNT}`);
    } catch (error) {
      console.error('[QuestionPool] Failed to trigger generation:', error);
    }
  }
}

/**
 * Get pool status for monitoring
 */
export async function getPoolStatus(system?: string): Promise<PoolStatus> {
  const where: any = { usedAt: null };
  if (system) where.system = system;

  const available = await prisma.preGeneratedQuestion.count({ where });

  return {
    available,
    lowThreshold: POOL_LOW_THRESHOLD,
    needsGeneration: available < POOL_LOW_THRESHOLD,
    system,
  };
}

/**
 * Get pool status for all systems
 */
export async function getAllPoolStatus(): Promise<Record<string, PoolStatus>> {
  const systems = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];
  
  const stats: Record<string, PoolStatus> = {};
  
  for (const system of systems) {
    stats[system] = await getPoolStatus(system);
  }
  
  // Add total
  const total = await getPoolStatus();
  stats['ALL'] = total;
  
  return stats;
}

/**
 * Seed a single pre-generated question into the pool
 * Called by background generation jobs
 */
export async function seedQuestion(
  questionData: {
    question: string;
    vignette?: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    tags?: string[];
  },
  metadata: {
    questionType: string;
    system?: string;
    conditionId?: string;
    difficulty: string;
  }
): Promise<string> {
  const id = `pregen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await prisma.preGeneratedQuestion.create({
    data: {
      id,
      questionType: metadata.questionType,
      system: metadata.system,
      conditionId: metadata.conditionId,
      difficulty: metadata.difficulty,
      questionData: questionData as any,
      generatedAt: new Date(),
    },
  });

  return id;
}

/**
 * Batch seed multiple questions
 */
export async function seedQuestionBatch(
  questions: Array<{
    data: {
      question: string;
      vignette?: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      tags?: string[];
    };
    metadata: {
      questionType: string;
      system?: string;
      conditionId?: string;
      difficulty: string;
    };
  }>
): Promise<number> {
  const records = questions.map(q => ({
    id: `pregen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    questionType: q.metadata.questionType,
    system: q.metadata.system,
    conditionId: q.metadata.conditionId,
    difficulty: q.metadata.difficulty,
    questionData: q.data as any,
    generatedAt: new Date(),
  }));

  const result = await prisma.preGeneratedQuestion.createMany({
    data: records,
    skipDuplicates: true,
  });

  return result.count;
}

export default {
  getQuestionsForUser,
  getPoolStatus,
  getAllPoolStatus,
  seedQuestion,
  seedQuestionBatch,
};
