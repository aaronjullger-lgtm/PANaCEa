/**
 * SRS Next Item API
 * GET /api/srs/next
 *
 * Returns the next due spaced repetition item for the authenticated user
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';

const SRSNextQuerySchema = z.object({
  mode: z.enum(['MAIN', 'CRAM', 'RAPID_RECALL']).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  SRSNextQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/srs/next');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    const mode = (validated as { mode?: string })?.mode ?? 'MAIN';

    // FSRS gatekeeper: OSCE and drill scheduling use their own endpoints; do not use SRS/next for them.
    if (mode === 'OSCE' || mode === 'osce' || mode === 'DRILL' || mode === 'drill') {
      return {
        data: {
          error:
            'OSCE and drill scheduling use their own endpoints. Use /api/osce/cases/random for OSCE.',
        },
        status: 400,
      };
    }

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Look up user by userId (from auth.userId which is clerkId)
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        logger.warn('User not found in database', { clerkId: auth.userId.substring(0, 10) });
        return {
          data: { error: 'User not found' },
          status: 404,
        };
      }

      const userId = user.id;
      const now = new Date();

      // Priority 1: Check for "Second Chance" variants that are due
      const dueTopics = await prisma.userTopicProgress.findMany({
        where: {
          userId,
          nextReviewDate: {
            lte: now,
          },
          state: {
            in: [1, 3], // Learning or Relearning states get priority
          },
        },
        orderBy: {
          nextReviewDate: 'asc',
        },
        take: 5,
      });

      if (dueTopics.length > 0) {
        const topic = dueTopics[0];
        if (!topic) {
          logger.info('No due topic', { userId: userId.substring(0, 10) });
          return { data: { message: 'No items due' } };
        }

        // Find a variant for this topic
        const availableVariants = await prisma.questionVariant.findMany({
          where: {
            baseQuestionId: topic.conditionId,
            taskType: topic.taskType,
            NOT: {
              usedByUsers: { has: userId },
            },
          },
          take: 1,
        });

        if (availableVariants.length > 0) {
          const variant = availableVariants[0];

          logger.info('SRS next item (variant) retrieved', {
            userId: userId.substring(0, 10),
            topicProgressId: topic.id.substring(0, 10),
            taskType: topic.taskType ?? 'diagnosis',
          });

          return {
            data: {
              srsItemId: null,
              topicProgressId: topic.id,
              question: variant,
              isVariant: true,
              taskType: topic.taskType ?? 'diagnosis',
            },
          };
        }
      }

      // Fallback to standard SRSItem query
      const items = await prisma.sRSItem.findMany({
        where: {
          userId,
          dueDate: {
            lte: now,
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
        take: 1,
      });

      if (items.length === 0) {
        logger.info('No SRS items due', { userId: userId.substring(0, 10) });
        return {
          data: { message: 'No items due' },
        };
      }

      const item = items[0];
      if (!item) {
        logger.info('No SRS items due', { userId: userId.substring(0, 10) });
        return { data: { message: 'No items due' } };
      }
      let questionContent: any = null;
      let isVariant = false;

      // Check for variants if in relearning/learning
      if (item.fsrsState === 3 || item.fsrsState === 1) {
        const variants = await prisma.questionVariant.findMany({
          where: {
            baseQuestionId: item.questionId,
            NOT: {
              usedByUsers: { has: userId },
            },
          },
          take: 1,
        });

        if (variants.length > 0) {
          questionContent = variants[0];
          isVariant = true;
        }
      }

      if (!questionContent) {
        questionContent = await prisma.question.findUnique({
          where: { id: item.questionId },
        });
      }

      if (!questionContent) {
        logger.warn('Question not found for SRS item', {
          srsItemId: item.id.substring(0, 10),
          questionId: item.questionId.substring(0, 10),
        });
        return {
          data: { error: 'Question not found' },
          status: 404,
        };
      }

      logger.info('SRS next item retrieved', {
        userId: userId.substring(0, 10),
        srsItemId: item.id.substring(0, 10),
        isVariant,
      });

      return {
        data: {
          srsItemId: item.id,
          question: questionContent,
          isVariant,
          taskType:
            (questionContent as { taskType?: string }).taskType ??
            getTaskTypeFromContent(questionContent.question),
        },
      };
    } catch (error) {
      logger.error('SRS next error', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId.substring(0, 10),
      });
      throw new Error('Failed to retrieve next SRS item');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
