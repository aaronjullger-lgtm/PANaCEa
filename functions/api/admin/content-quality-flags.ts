/**
 * Admin Content Quality Flags Endpoint
 *
 * GET  /api/admin/content-quality-flags       — List flags with filtering + pagination
 * GET  /api/admin/content-quality-flags/:id   — Flag details with original question + metrics
 * PUT  /api/admin/content-quality-flags/:id   — Update status (approve, reject, requeue)
 *
 * Approve workflow:
 *   1. Verify flag has regeneratedContent
 *   2. Write regenerated fields to the Question record
 *   3. Set flag status to "resolved"
 *
 * Reject workflow:
 *   1. Keep original question content
 *   2. Set flag status to "resolved"
 *
 * Requeue workflow:
 *   1. Reset status to "flagged" so the next cron run will re-attempt regeneration
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// ─── GET (list) Query Schema ───────────────────────────────────────────────

const ListQuerySchema = z.object({
  status: z.enum(['flagged', 'regenerating', 'reviewed', 'resolved']).optional(),
  flagType: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// ─── GET /:id (detail) Param Schema ────────────────────────────────────────

const DetailParamSchema = z.object({
  id: z.string(),
});

// ─── PUT /:id Body Schema ──────────────────────────────────────────────────

const UpdateBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'requeue']),
});

export const onRequestOptions = withCors();

/**
 * GET /api/admin/content-quality-flags — List flags with filtering + pagination
 */
export const onRequestGet = adminAuthenticatedEndpoint(
  ListQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/content-quality-flags');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;

      // Check for :id param — if present, return single flag detail
      const flagId = context.params?.id as string | undefined;
      if (flagId) {
        return getFlagDetail(prisma, flagId, adminUserId, logger);
      }

      // Otherwise list with filters
      const limit = validated.limit ? parseInt(validated.limit) : 50;
      const offset = validated.offset ? parseInt(validated.offset) : 0;

      const where: Record<string, unknown> = {};
      if (validated.status) where.status = validated.status;
      if (validated.flagType) where.flagType = validated.flagType;

      const [flags, totalCount] = await Promise.all([
        prisma.contentQualityFlag.findMany({
          where,
          select: {
            id: true,
            questionId: true,
            flagType: true,
            status: true,
            critiqueFeedback: true,
            regeneratedContent: true,
            createdAt: true,
            updatedAt: true,
            resolvedAt: true,
            resolvedBy: true,
            Question: {
              select: {
                id: true,
                question: true,
                system: true,
                difficulty: true,
                conditionId: true,
                Condition: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.contentQualityFlag.count({ where }),
      ]);

      const hasMore = totalCount > offset + limit;
      const pages = Math.ceil(totalCount / limit);

      logger.info('Content quality flags listed', {
        userId: adminUserId,
        count: flags.length,
        total: totalCount,
      });

      return {
        data: {
          success: true,
          data: flags,
          pagination: { total: totalCount, limit, offset, hasMore, pages },
        },
      };
    } catch (error) {
      logger.error('Error listing content quality flags', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to list content quality flags');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

/**
 * PUT /api/admin/content-quality-flags/:id — Approve, reject, or requeue a flag
 */
export const onRequestPut = adminAuthenticatedEndpoint(
  UpdateBodySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/admin/content-quality-flags');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const flagId = context.params?.id as string;

    try {
      const adminUserId = (auth.metadata as any)?.dbUserId ?? auth.userId;
      const action = validated.action;

      // Fetch flag with question
      const flag = await prisma.contentQualityFlag.findUnique({
        where: { id: flagId },
        include: {
          Question: {
            select: {
              id: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              difficulty: true,
            },
          },
        },
      });

      if (!flag) {
        logger.info('Flag not found', { flagId, userId: adminUserId });
        return {
          data: { success: false, error: 'Flag not found' },
          status: 404,
        };
      }

      if (action === 'approve') {
        return approveFlag(prisma, flag, adminUserId, logger);
      }

      if (action === 'reject') {
        return rejectFlag(prisma, flag, adminUserId, logger);
      }

      if (action === 'requeue') {
        return requeueFlag(prisma, flag, adminUserId, logger);
      }

      return { data: { success: false, error: 'Invalid action' }, status: 400 };
    } catch (error) {
      logger.error('Error updating content quality flag', {
        error: error instanceof Error ? error.message : String(error),
        flagId,
      });
      throw new Error('Failed to update content quality flag');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ─── Handlers ──────────────────────────────────────────────────────────────

async function getFlagDetail(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  flagId: string,
  adminUserId: string,
  logger: ReturnType<typeof createEndpointLogger>
) {
  const flag = await prisma.contentQualityFlag.findUnique({
    where: { id: flagId },
    include: {
      Question: {
        select: {
          id: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          difficulty: true,
          system: true,
          conditionId: true,
          lifecycleStatus: true,
          Condition: { select: { name: true, system: true } },
        },
      },
    },
  });

  if (!flag) {
    logger.info('Flag not found for detail', { flagId, userId: adminUserId });
    return {
      data: { success: false, error: 'Flag not found' },
      status: 404,
    };
  }

  return {
    data: { success: true, data: flag },
  };
}

async function approveFlag(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  flag: any,
  adminUserId: string,
  logger: ReturnType<typeof createEndpointLogger>
) {
  if (!flag.regeneratedContent) {
    logger.info('Approve rejected — no regenerated content', {
      flagId: flag.id,
      userId: adminUserId,
    });
    return {
      data: { success: false, error: 'Cannot approve: no regenerated content available' },
      status: 400,
    };
  }

  const regen = flag.regeneratedContent as Record<string, unknown>;

  // Write regenerated content fields to the Question record
  const questionUpdate: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof regen.question === 'string') questionUpdate.question = regen.question;
  if (regen.options) questionUpdate.options = regen.options;
  if (typeof regen.correctAnswer === 'string') questionUpdate.correctAnswer = regen.correctAnswer;
  if (typeof regen.explanation === 'string' || typeof regen.explanation === 'object') {
    const explanation =
      typeof regen.explanation === 'object' && regen.explanation !== null && 'rationale' in regen.explanation
        ? (regen.explanation as { rationale: string }).rationale
        : regen.explanation;
    questionUpdate.explanation = explanation;
  }
  if (typeof regen.difficulty === 'number') {
    questionUpdate.difficulty = regen.difficulty < 0.4 ? 'easy' : regen.difficulty > 0.6 ? 'hard' : 'medium';
  }

  // Update question and flag atomically via transaction
  const [updatedFlag] = await prisma.$transaction([
    prisma.contentQualityFlag.update({
      where: { id: flag.id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    }),
    prisma.question.update({
      where: { id: flag.questionId },
      data: questionUpdate,
    }),
  ]);

  logger.info('Flag approved — question content replaced', {
    flagId: flag.id,
    questionId: flag.questionId,
    userId: adminUserId,
  });

  return {
    data: {
      success: true,
      data: updatedFlag,
      message: 'Question content replaced with regenerated version',
    },
  };
}

async function rejectFlag(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  flag: any,
  adminUserId: string,
  logger: ReturnType<typeof createEndpointLogger>
) {
  const updatedFlag = await prisma.contentQualityFlag.update({
    where: { id: flag.id },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: adminUserId,
    },
  });

  logger.info('Flag rejected — original content kept', {
    flagId: flag.id,
    questionId: flag.questionId,
    userId: adminUserId,
  });

  return {
    data: {
      success: true,
      data: updatedFlag,
      message: 'Flag resolved — original question content preserved',
    },
  };
}

async function requeueFlag(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  flag: any,
  adminUserId: string,
  logger: ReturnType<typeof createEndpointLogger>
) {
  if (flag.status === 'FLAGGED') {
    return {
      data: { success: false, error: 'Flag is already in flagged state' },
      status: 400,
    };
  }

  const updatedFlag = await prisma.contentQualityFlag.update({
    where: { id: flag.id },
    data: {
      status: 'flagged',
      regeneratedContent: null,
      critiqueFeedback: null,
    },
  });

  logger.info('Flag requeued for regeneration', {
    flagId: flag.id,
    questionId: flag.questionId,
    userId: adminUserId,
  });

  return {
    data: {
      success: true,
      data: updatedFlag,
      message: 'Flag requeued — will be retried on next quality loop run',
    },
  };
}
