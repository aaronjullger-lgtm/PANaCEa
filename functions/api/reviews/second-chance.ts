/**
 * POST /api/reviews/second-chance
 *
 * Build a Second Chance review session — subdomain-level, blueprint-weighted,
 * recognition-risk-aware question selection for due concepts.
 *
 * Replaces condition-level "what's due" with "what's the weakest subdomain
 * within each due concept, and which question best targets that weakness."
 *
 * References:
 *   - Kornell & Bjork (2008): Varied practice > repeated practice for transfer
 *   - Roediger & Karpicke (2006): Testing effect requires genuine retrieval
 *
 * Powered by: lib/services/secondChanceEngine.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { buildSecondChanceReviewSet } from '../../../lib/services/secondChanceEngine';
import type { ExamType } from '../../../lib/services/blueprintMappingService';

export const SecondChanceRequestSchema = z
  .object({
    /** Number of review questions to return (1–25, default 10) */
    count: z.number().int().min(1).max(25).optional().default(10),
    /** Exam type for blueprint weighting (default PANCE) */
    examType: z.enum(['PANCE', 'PANRE', 'EOR']).optional().default('PANCE'),
    /** Optional scope: limit to a specific body system or condition */
    scopeFilter: z
      .object({
        system: z.string().max(100).optional(),
        conditionId: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const onRequestPost = authenticatedEndpoint(SecondChanceRequestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/reviews/second-chance');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return { data: { error: 'User not found' }, status: 404 };
    }

    const { count, examType, scopeFilter } = validated;

    const selections = await buildSecondChanceReviewSet(
      prisma as any,
      user.id,
      count,
      examType as ExamType,
      scopeFilter
    );

    if (selections.length === 0) {
      logger.info('Second chance: no items due', { userId: auth.userId });
      return { data: { selections: [], message: 'No items due for second-chance review.' } };
    }

    // Hydrate question content for each selection
    const questionIds = selections.map((s) => s.questionId);

    // Fetch from PreGeneratedQuestion first, then fall back to Question table
    const [preGenRows, questionRows] = await Promise.all([
      prisma.preGeneratedQuestion.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          questionData: true,
          conditionId: true,
          system: true,
          difficulty: true,
          questionType: true,
        },
      }),
      prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          vignette: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          conditionId: true,
          system: true,
          difficulty: true,
          taskType: true,
        },
      }),
    ]);

    const preGenMap = new Map(preGenRows.map((q) => [q.id, q]));
    const questionMap = new Map(questionRows.map((q) => [q.id, q]));

    const hydratedSelections = selections.map((sel) => {
      const preGen = preGenMap.get(sel.questionId);
      const mainQ = questionMap.get(sel.questionId);

      const questionContent = preGen
        ? { source: 'pre_generated' as const, ...preGen }
        : mainQ
          ? {
              source: 'main_question' as const,
              id: mainQ.id,
              conditionId: mainQ.conditionId,
              system: mainQ.system,
              difficulty: mainQ.difficulty,
              questionType: mainQ.taskType ?? 'mcq',
              questionData: {
                vignette: mainQ.vignette,
                question: mainQ.question,
                options: mainQ.options,
                correctAnswer: mainQ.correctAnswer,
                explanation: mainQ.explanation,
              },
            }
          : null;

      return {
        ...sel,
        question: questionContent,
      };
    });

    // Fire-and-forget: increment timesServed for any PreGeneratedQuestion served here
    const servedPreGenIds = hydratedSelections
      .filter((s) => s.question?.source === 'pre_generated')
      .map((s) => s.questionId);
    if (servedPreGenIds.length > 0) {
      prisma.preGeneratedQuestion
        .updateMany({
          where: { id: { in: servedPreGenIds } },
          data: { timesServed: { increment: 1 } },
        })
        .catch((err: unknown) =>
          logger.warn('second-chance timesServed increment failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }

    logger.info('Second chance session built', {
      userId: auth.userId,
      requested: count,
      returned: hydratedSelections.length,
      withVariants: hydratedSelections.filter((s) => s.isVariant).length,
      examType,
    });

    return {
      data: {
        selections: hydratedSelections,
        meta: {
          total: hydratedSelections.length,
          withVariants: hydratedSelections.filter((s) => s.isVariant).length,
          withSecondChance: hydratedSelections.filter((s) => s.isSecondChance).length,
          examType,
        },
      },
    };
  } catch (error) {
    logger.error('Second chance error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return {
      data: { error: 'Failed to build second-chance session', message: 'Please try again.' },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
