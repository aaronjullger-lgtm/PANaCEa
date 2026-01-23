/**
 * GET/POST /api/questions/review
 * GET: Fetch questions needing review (SRS due, flagged, missed, weak areas)
 * POST: Record a review and update SRS data
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { ReviewService, type ReviewQuestion } from '../../../lib/services/review/reviewService';

const ReviewGetSchema = z.object({
  query: z.object({
    mode: z.string().optional(),
    limit: z.string().optional(),
    system: z.string().optional(),
  }),
});

const ReviewPostSchema = z.object({
  body: z.object({
    questionId: z.string().min(1),
    wasCorrect: z.boolean(),
    timeSpentMs: z.number().int().min(0).max(600000).optional(),
    quality: z.number().int().min(0).max(5).optional(),
    srsItemId: z.string().optional(),
    conditionId: z.string().optional(),
  }),
});

interface ReviewSummary {
  srsDue: number;
  flagged: number;
  missed: number;
  weakArea: number;
  total: number;
  urgentCount: number;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ReviewGetSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { data: { error: 'User not found' }, status: 404 };
    }

    const mode = validated.query?.mode || 'all';
    const limit = Math.min(parseInt(validated.query?.limit || '20'), 100);
    const system = validated.query?.system || null;

    const reviewService = new ReviewService(env.DATABASE_URL, user.id);
    const reviewQuestions = await reviewService.getReviewQuestions(mode, limit, system);
    const summary = generateSummary(reviewQuestions);

    logger.info('Review questions fetched', {
      userId: auth.userId,
      mode,
      count: reviewQuestions.length,
    });

    return { data: { questions: reviewQuestions, summary, mode, userId: auth.userId } };
  } catch (error) {
    logger.error('Error fetching review questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch review questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

export const onRequestPost = authenticatedEndpoint(ReviewPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { data: { error: 'User not found' }, status: 404 };
    }

    const {
      questionId,
      wasCorrect,
      timeSpentMs,
      quality: inputQuality,
      srsItemId,
      conditionId,
    } = validated.body;
    const now = new Date();
    const quality = inputQuality ?? (wasCorrect ? 4 : 1);

    // Find or create SRS item
    let srsItem = null;

    if (srsItemId) {
      srsItem = await prisma.sRSItem.findUnique({ where: { id: srsItemId } });
    }

    if (!srsItem && conditionId) {
      const questionsForCondition = await prisma.question.findMany({
        where: { conditionId },
        select: { id: true },
        take: 100,
      });
      const questionIds = questionsForCondition.map((q) => q.id);

      if (questionIds.length > 0) {
        srsItem = await prisma.sRSItem.findFirst({
          where: { userId: user.id, questionId: { in: questionIds } },
          orderBy: { dueDate: 'asc' },
        });
      }
    }

    if (!srsItem) {
      srsItem = await prisma.sRSItem.findFirst({
        where: { userId: user.id, questionId },
      });
    }

    // Update or create SRS item
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
      const interval = wasCorrect ? 1 : 0;
      const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

      await prisma.sRSItem.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          questionId,
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

    // Record the attempt
    await prisma.questionAttempt.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        questionId,
        wasCorrect,
        timeSpentMs,
        mode: 'review',
        conditionId,
      },
    });

    // Update UserQuestionSeen
    await prisma.userQuestionSeen.upsert({
      where: {
        userId_questionId_questionType: { userId: user.id, questionId, questionType: 'review' },
      },
      create: {
        userId: user.id,
        questionId,
        questionType: 'review',
        firstSeenAt: now,
        lastSeenAt: now,
        timesShown: 1,
        timesCorrect: wasCorrect ? 1 : 0,
        timesIncorrect: wasCorrect ? 0 : 1,
      },
      update: {
        lastSeenAt: now,
        timesShown: { increment: 1 },
        timesCorrect: wasCorrect ? { increment: 1 } : undefined,
        timesIncorrect: wasCorrect ? undefined : { increment: 1 },
      },
    });

    logger.info('Review recorded', { userId: auth.userId, questionId, wasCorrect });

    return { data: { success: true, message: 'Review recorded' } };
  } catch (error) {
    logger.error('Error recording review', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record review');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// Helper functions
function generateSummary(questions: ReviewQuestion[]): ReviewSummary {
  return {
    srsDue: questions.filter((q) => q.reviewReason === 'srs_due').length,
    flagged: questions.filter((q) => q.reviewReason === 'flagged').length,
    missed: questions.filter((q) => q.reviewReason === 'missed').length,
    weakArea: questions.filter((q) => q.reviewReason === 'weak_area').length,
    total: questions.length,
    urgentCount: questions.filter((q) => q.priority >= 80).length,
  };
}

function calculateNewInterval(
  srsItem: { interval: number; easiness: number; repetition: number },
  quality: number
): number {
  if (quality < 3) return 0;
  const { easiness, interval, repetition } = srsItem;
  if (repetition === 0) return 1;
  if (repetition === 1) return 6;
  return Math.round(interval * easiness);
}

function adjustEasiness(currentEasiness: number, quality: number): number {
  const newEasiness = currentEasiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, Math.min(2.5, newEasiness));
}
