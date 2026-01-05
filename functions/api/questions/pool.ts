/**
 * API Endpoint: /api/questions/pool
 * 
 * Get questions from the question pool with user-specific filtering
 * Ensures no user sees the same question twice
 * Triggers background generation when pool runs low
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  GEMINI_API_KEY: string;
}

// Thresholds for question pool management
const POOL_LOW_THRESHOLD = 20;
const DEFAULT_FETCH_COUNT = 10;

export const onRequestGet = async (context: CloudflareContext<Env>) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Parse query parameters
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system');
    const category = url.searchParams.get('category');
    const difficulty = url.searchParams.get('difficulty');
    const countStr = url.searchParams.get('count');
    const count = countStr ? parseInt(countStr, 10) : DEFAULT_FETCH_COUNT;

    // Get questions user has already seen
    const seenQuestionIds = await prisma.userQuestionHistory.findMany({
      where: { userId },
      select: { questionId: true },
    });
    const seenIds = new Set<string>(seenQuestionIds.map(q => q.questionId));

    // Try pre-generated pool first
    const poolQuestions = await getFromPreGeneratedPool(prisma, userId, seenIds, {
      count,
      system,
      category,
      difficulty,
    });

    let questions: Array<{
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
      source: 'pool' | 'main';
    }> = poolQuestions.questions;
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

    // Check if pool needs regeneration
    const needsGeneration = poolAvailable < POOL_LOW_THRESHOLD;

    return new Response(JSON.stringify({ 
      questions,
      poolStatus: {
        available: poolAvailable,
        needsGeneration,
        threshold: POOL_LOW_THRESHOLD,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching pool questions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get questions from pre-generated pool
 */
async function getFromPreGeneratedPool(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  seenIds: Set<string>,
  options: {
    count: number;
    system?: string | null;
    category?: string | null;
    difficulty?: string | null;
  }
) {
  const { count, system, category, difficulty } = options;

  // Build where clause - do NOT filter by usedAt
  // Questions remain available to all users; per-user filtering happens via seenIds
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (difficulty) where.difficulty = difficulty;
  if (category) where.questionType = category;

  // Fetch available pre-generated questions
  const preGenQuestions = await prisma.preGeneratedQuestion.findMany({
    where,
    take: count * 3, // Fetch extra to account for filtering
    orderBy: { generatedAt: 'asc' },
  });

  // Count remaining unused
  const remaining = await prisma.preGeneratedQuestion.count({ where });

  // Filter and format
  const questions: Array<{
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
    source: 'pool';
  }> = [];
  const toMarkUsed: string[] = [];

  for (const q of preGenQuestions) {
    if (questions.length >= count) break;
    if (seenIds.has(q.id)) continue;

    const data = q.questionData as Record<string, unknown>;
    // Handle different option field names (options, answers, choices)
    const optionsData = data.options || data.answers || data.choices;
    const options = Array.isArray(optionsData) ? (optionsData as string[]) : [];
    
    questions.push({
      id: q.id,
      vignette: data.vignette as string | undefined,
      question: data.question as string,
      options,
      correctAnswer: data.correctAnswer as string,
      explanation: data.explanation as string,
      system: q.system || 'General',
      difficulty: q.difficulty,
      tags: data.tags as string[] | undefined,
      conditionId: q.conditionId || undefined,
      source: 'pool',
    });
    toMarkUsed.push(q.id);
  }

  // Record in user history ONLY - do NOT mark questions as globally used
  // This enables multi-tenant pooling where each user gets fresh questions
  if (toMarkUsed.length > 0) {
    await prisma.userQuestionHistory.createMany({
      data: toMarkUsed.map(questionId => ({
        id: `${userId}-${questionId}`,
        userId,
        questionId,
        isCorrect: false,
        seenAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  return { questions, remaining };
}

/**
 * Get questions from main Question table
 */
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
) {
  const { count, system, category, difficulty } = options;

  // Build where clause
  const where: Record<string, unknown> = {};
  if (system) where.system = system;
  if (difficulty) where.difficulty = difficulty;
  if (category) {
    where.tags = { array_contains: category };
  }

  // Fetch questions
  const questions = await prisma.question.findMany({
    where,
    take: count * 3,
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

  // Filter and format
  const result: Array<{
    id: string;
    vignette?: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    system: string;
    difficulty: string;
    tags?: string[];
    source: 'main';
  }> = [];
  const toRecord: string[] = [];

  for (const q of questions) {
    if (result.length >= count) break;
    if (seenIds.has(q.id)) continue;

    result.push({
      id: q.id,
      vignette: q.vignette || undefined,
      question: q.question,
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      system: q.system,
      difficulty: q.difficulty || 'medium',
      tags: q.tags as string[] || undefined,
      source: 'main',
    });
    toRecord.push(q.id);
  }

  // Record in history
  if (toRecord.length > 0) {
    await prisma.userQuestionHistory.createMany({
      data: toRecord.map(questionId => ({
        id: `${userId}-${questionId}`,
        userId,
        questionId,
        isCorrect: false,
        seenAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  return result;
}

/**
 * POST handler to seed a question back into the pool
 */
export const onRequestPost = async (context: CloudflareContext<Env>) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json() as { question: any };
    const q = body.question;

    if (!q || !q.id || !q.question || !q.options || !q.correctAnswer || !q.explanation) {
      return new Response(JSON.stringify({ error: 'Invalid question data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert into PreGeneratedQuestion table
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
        usedAt: null, // Ensure it's available
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error seeding question to pool:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
};
