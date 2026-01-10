import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { ReviewService, type ReviewQuestion } from '../../../lib/services/review/reviewService';
import { validateRequest, IDSchema } from '../_shared/schemas';
import { z } from 'zod';
import type { JsonValue } from '@prisma/client/runtime/library';

// Zod schema for review submission
const ReviewSubmitSchema = z.object({
  questionId: IDSchema,
  wasCorrect: z.boolean(),
  timeSpentMs: z.number().int().min(0).max(600000).optional(),
  quality: z.number().int().min(0).max(5).optional(),
  srsItemId: IDSchema.optional(),
  conditionId: IDSchema.optional(),
});

interface PagesContext {
  request: Request;
  env: Env;
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
    const mode = url.searchParams.get('mode') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const system = url.searchParams.get('system');

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }
    
    const reviewService = new ReviewService(context.env.DATABASE_URL, user.id);
    const reviewQuestions = await reviewService.getReviewQuestions(mode, limit, system);

    const summary = generateSummary(reviewQuestions);
    
    return createSuccessResponse({
      questions: reviewQuestions,
      summary,
      mode,
      userId: auth.userId,
    });
  } catch (error) {
    console.error('[ReviewAPI] Error:', error);
    return createErrorResponse('Failed to fetch review questions', 500);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
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

    // Validate input with Zod schema
    const validation = await validateRequest(context.request.clone(), ReviewSubmitSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const body = (validation as { success: true; data: z.infer<typeof ReviewSubmitSchema> }).data;

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const now = new Date();
    const quality = body.quality ?? (body.wasCorrect ? 4 : 1);
    
    let srsItem;
    
    if (body.srsItemId) {
      srsItem = await prisma.sRSItem.findUnique({
        where: { id: body.srsItemId },
      });
    }
    
    if (!srsItem && body.conditionId) {
      const questionsForCondition = await prisma.question.findMany({
        where: { conditionId: body.conditionId },
        select: { id: true },
        take: 100,
      });
      const questionIds = questionsForCondition.map(q => q.id);
      
      if (questionIds.length > 0) {
        srsItem = await prisma.sRSItem.findFirst({
          where: {
            userId: user.id,
            questionId: { in: questionIds },
          },
          orderBy: { dueDate: 'asc' },
        });
      }
    }
    
    if (!srsItem) {
      srsItem = await prisma.sRSItem.findFirst({
        where: {
          userId: user.id,
          questionId: body.questionId,
        },
      });
    }

    if (srsItem) {
      const newInterval = calculateNewInterval(srsItem, quality);
      const nextDue = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.update({
        where: { id: srsItem.id },
        data: {
          lastReviewed: now,
          dueDate: nextDue,
          interval: newInterval,
          repetition: srsItem.repetition + 1,
          easiness: adjustEasiness(srsItem.easiness, quality),
          quality,
        },
      });
    } else {
      const interval = body.wasCorrect ? 1 : 0;
      const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          questionId: body.questionId,
          lastReviewed: now,
          dueDate: nextDue,
          interval,
          repetition: 1,
          easiness: 2.5,
          quality,
          difficulty: 0.3,
          stabilityScore: 0,
        },
      });
    }

    await prisma.questionAttempt.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        questionId: body.questionId,
        wasCorrect: body.wasCorrect,
        timeSpentMs: body.timeSpentMs,
        mode: 'review',
        conditionId: body.conditionId,
      },
    });

    await prisma.userQuestionHistory.upsert({
      where: {
        id: `${user.id}-${body.questionId}`,
      },
      update: {
        isCorrect: body.wasCorrect,
        seenAt: now,
      },
      create: {
        id: `${user.id}-${body.questionId}`,
        userId: user.id,
        questionId: body.questionId,
        isCorrect: body.wasCorrect,
        seenAt: now,
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
    if (prisma) {
      await prisma.$disconnect();
    }
  }
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
  if (quality < 3) {
    return 0;
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
  const newEasiness = currentEasiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, Math.min(2.5, newEasiness));
}
