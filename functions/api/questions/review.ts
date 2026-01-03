/**
 * Review Questions API
 * 
 * Comprehensive endpoint for fetching questions that need review:
 * - SRS due questions (spaced repetition)
 * - Flagged questions (user marked for review)
 * - Missed questions (incorrect answers)
 * - Weak area questions (low accuracy topics)
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { JsonValue } from '@prisma/client/runtime/library';

interface PagesContext {
  request: Request;
  env: Env;
}

// Database Question shape
interface DBQuestion {
  id: string;
  vignette: string;
  options: JsonValue;
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition: string | null;
  conditionId: string | null;
  difficulty: string | null;
}

interface ReviewQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  system: string;
  condition?: string;
  conditionId?: string;
  difficulty?: string;
  reviewReason: 'srs_due' | 'flagged' | 'missed' | 'weak_area';
  priority: number;
  lastSeen?: Date;
  nextDue?: Date;
  accuracy?: number;
}

interface ReviewSummary {
  srsDue: number;
  flagged: number;
  missed: number;
  weakArea: number;
  total: number;
  urgentCount: number;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch questions needing review
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const url = new URL(context.request.url);
    const mode = url.searchParams.get('mode') || 'all'; // all, srs, flagged, missed, weak
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const system = url.searchParams.get('system');

    // Get internal user ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const userId = user.id;
    const reviewQuestions: ReviewQuestion[] = [];

    // 1. SRS Due Questions
    if (mode === 'all' || mode === 'srs') {
      const srsQuestions = await getSRSDueQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...srsQuestions);
    }

    // 2. Flagged Questions
    if (mode === 'all' || mode === 'flagged') {
      const flaggedQuestions = await getFlaggedQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...flaggedQuestions);
    }

    // 3. Missed Questions (recent incorrect answers)
    if (mode === 'all' || mode === 'missed') {
      const missedQuestions = await getMissedQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...missedQuestions);
    }

    // 4. Weak Area Questions (low accuracy systems/conditions)
    if (mode === 'all' || mode === 'weak') {
      const weakQuestions = await getWeakAreaQuestions(prisma, userId, system, limit);
      reviewQuestions.push(...weakQuestions);
    }

    // Deduplicate by question ID and sort by priority
    const uniqueQuestions = deduplicateAndSort(reviewQuestions);

    // Generate summary
    const summary = generateSummary(reviewQuestions);

    return createSuccessResponse({
      questions: uniqueQuestions.slice(0, limit),
      summary,
      mode,
      userId: auth.userId,
    });
  } catch (error) {
    console.error('[ReviewAPI] Error:', error);
    return createErrorResponse('Failed to fetch review questions', 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST: Mark questions as reviewed
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await context.request.json() as {
      questionId: string;
      wasCorrect: boolean;
      timeSpentMs?: number;
      quality?: number;
    };

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // Update SRS schedule
    const now = new Date();
    const srsItem = await prisma.sRSItem.findFirst({
      where: {
        userId: user.id,
        questionId: body.questionId,
      },
    });

    if (srsItem) {
      // Update existing SRS item with FSRS v5 algorithm
      const quality = body.quality ?? (body.wasCorrect ? 4 : 1);
      const newInterval = calculateNewInterval(srsItem, quality);
      const nextDue = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.update({
        where: { id: srsItem.id },
        data: {
          lastReviewed: now,
          nextDue,
          interval: newInterval,
          repetition: srsItem.repetition + 1,
          easiness: adjustEasiness(srsItem.easiness, quality),
          quality,
        },
      });
    } else {
      // Create new SRS item
      const quality = body.quality ?? (body.wasCorrect ? 4 : 1);
      const interval = body.wasCorrect ? 1 : 0;
      const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          questionId: body.questionId,
          lastReviewed: now,
          nextDue,
          interval,
          repetition: 1,
          easiness: 2.5,
          quality,
          difficulty: 0.3,
        },
      });
    }

    // Record the attempt
    await prisma.questionAttempt.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        questionId: body.questionId,
        wasCorrect: body.wasCorrect,
        timeSpentMs: body.timeSpentMs,
        mode: 'review',
      },
    });

    return createSuccessResponse({
      success: true,
      message: 'Review recorded',
    });
  } catch (error) {
    console.error('[ReviewAPI] Error recording review:', error);
    return createErrorResponse('Failed to record review', 500);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper Functions

async function getSRSDueQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  const now = new Date();

  const where: Record<string, unknown> = {
    userId,
    nextDue: { lte: now },
  };

  const srsItems = await prisma.sRSItem.findMany({
    where,
    orderBy: [
      { nextDue: 'asc' },
      { easiness: 'asc' }, // Harder items first
    ],
    take: limit,
  });

  // Fetch associated questions
  const questionIds = srsItems.map(item => item.questionId);
  const questions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: {
          id: { in: questionIds },
          ...(system ? { system } : {}),
        },
      }) as DBQuestion[]
    : [];

  const questionMap = new Map(questions.map(q => [q.id, q as DBQuestion]));

  return srsItems
    .filter(item => questionMap.has(item.questionId))
    .map(item => {
      const q = questionMap.get(item.questionId)!;
      const daysOverdue = Math.max(0, (now.getTime() - item.nextDue.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: q.id,
        question: q.vignette,
        options: q.options as string[],
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'srs_due' as const,
        priority: Math.min(100, 50 + daysOverdue * 10), // Higher priority for more overdue
        lastSeen: item.lastReviewed,
        nextDue: item.nextDue,
      };
    });
}

async function getFlaggedQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Fetch saved questions of type 'flagged'
  const savedQuestions = await prisma.savedQuestion.findMany({
    where: {
      userId,
      type: 'flagged',
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const questionIds = savedQuestions.map(sq => sq.questionId);
  const questions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: {
          id: { in: questionIds },
          ...(system ? { system } : {}),
        },
      }) as DBQuestion[]
    : [];

  const questionMap = new Map(questions.map(q => [q.id, q as DBQuestion]));

  return savedQuestions
    .filter(sq => questionMap.has(sq.questionId))
    .map(sq => {
      const q = questionMap.get(sq.questionId)!;
      return {
        id: q.id,
        question: q.vignette,
        options: q.options as string[],
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'flagged' as const,
        priority: 80, // High priority for user-flagged
        lastSeen: sq.updatedAt,
      };
    });
}

async function getMissedQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Get recent incorrect attempts
  const recentMissed = await prisma.questionAttempt.findMany({
    where: {
      userId,
      wasCorrect: false,
      ...(system ? { system } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit * 2, // Fetch more to account for duplicates
  });

  // Get unique question IDs
  const seenIds = new Set<string>();
  const uniqueAttempts = recentMissed.filter(a => {
    if (seenIds.has(a.questionId)) return false;
    seenIds.add(a.questionId);
    return true;
  }).slice(0, limit);

  const questionIds = uniqueAttempts.map(a => a.questionId);
  const questions = questionIds.length > 0
    ? await prisma.question.findMany({
        where: { id: { in: questionIds } },
      }) as DBQuestion[]
    : [];

  const questionMap = new Map(questions.map(q => [q.id, q as DBQuestion]));

  return uniqueAttempts
    .filter(a => questionMap.has(a.questionId))
    .map(a => {
      const q = questionMap.get(a.questionId)!;
      return {
        id: q.id,
        question: q.vignette,
        options: q.options as string[],
        correctAnswerIndex: q.correctAnswerIndex,
        rationale: q.rationale,
        system: q.system,
        condition: q.condition ?? undefined,
        conditionId: q.conditionId ?? undefined,
        difficulty: q.difficulty ?? undefined,
        reviewReason: 'missed' as const,
        priority: 70, // Medium-high priority
        lastSeen: a.createdAt,
      };
    });
}

async function getWeakAreaQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string | null,
  limit: number
): Promise<ReviewQuestion[]> {
  // Calculate weak systems/conditions from attempts
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    select: {
      system: true,
      conditionId: true,
      wasCorrect: true,
    },
  });

  // Group by system
  const systemStats = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (!a.system) continue;
    if (!systemStats.has(a.system)) {
      systemStats.set(a.system, { correct: 0, total: 0 });
    }
    const stats = systemStats.get(a.system)!;
    stats.total++;
    if (a.wasCorrect) stats.correct++;
  }

  // Find weak systems (< 60% accuracy with >= 5 attempts)
  const weakSystems: string[] = [];
  for (const [sys, stats] of systemStats) {
    if (stats.total >= 5 && (stats.correct / stats.total) < 0.6) {
      weakSystems.push(sys);
    }
  }

  if (weakSystems.length === 0) {
    return [];
  }

  // Get questions from weak systems that user hasn't mastered
  const questions = await prisma.question.findMany({
    where: {
      system: { in: weakSystems },
      ...(system ? { system } : {}),
    },
    take: limit,
    orderBy: { id: 'asc' },
  }) as DBQuestion[];

  return questions.map((q: DBQuestion) => {
    const stats = systemStats.get(q.system);
    const accuracy = stats ? (stats.correct / stats.total) * 100 : 50;

    return {
      id: q.id,
      question: q.vignette,
      options: q.options as string[],
      correctAnswerIndex: q.correctAnswerIndex,
      rationale: q.rationale,
      system: q.system,
      condition: q.condition ?? undefined,
      conditionId: q.conditionId ?? undefined,
      difficulty: q.difficulty ?? undefined,
      reviewReason: 'weak_area' as const,
      priority: Math.round(60 - accuracy * 0.5), // Lower accuracy = higher priority
      accuracy,
    };
  });
}

function deduplicateAndSort(questions: ReviewQuestion[]): ReviewQuestion[] {
  const seen = new Map<string, ReviewQuestion>();

  for (const q of questions) {
    if (!seen.has(q.id) || q.priority > seen.get(q.id)!.priority) {
      seen.set(q.id, q);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
}

function generateSummary(questions: ReviewQuestion[]): ReviewSummary {
  const srsDue = questions.filter(q => q.reviewReason === 'srs_due').length;
  const flagged = questions.filter(q => q.reviewReason === 'flagged').length;
  const missed = questions.filter(q => q.reviewReason === 'missed').length;
  const weakArea = questions.filter(q => q.reviewReason === 'weak_area').length;
  const urgentCount = questions.filter(q => q.priority >= 80).length;

  return {
    srsDue,
    flagged,
    missed,
    weakArea,
    total: questions.length,
    urgentCount,
  };
}

function calculateNewInterval(srsItem: { interval: number; easiness: number; repetition: number }, quality: number): number {
  // Simplified FSRS v5 interval calculation
  if (quality < 3) {
    return 0; // Reset on failure
  }

  const easiness = srsItem.easiness;
  const currentInterval = srsItem.interval;
  const repetition = srsItem.repetition;

  if (repetition === 0) {
    return 1;
  } else if (repetition === 1) {
    return 6;
  }

  return Math.round(currentInterval * easiness);
}

function adjustEasiness(currentEasiness: number, quality: number): number {
  // SM-2 easiness adjustment
  const newEasiness = currentEasiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, Math.min(2.5, newEasiness));
}
