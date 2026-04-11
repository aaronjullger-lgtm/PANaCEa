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

        // Query PreGeneratedQuestion siblings for this condition (unified variant pool).
        // taskType filtering is best-effort: prefer matching taskType, but fall back to any sibling.
        const taskTypeFilter = topic.taskType ?? undefined;
        const allSiblings = await prisma.preGeneratedQuestion.findMany({
          where: { conditionId: topic.conditionId },
          take: 20,
          orderBy: { generatedAt: 'desc' },
        });
        // Prefer taskType match; fall back to any sibling
        const taskTypeSiblings = taskTypeFilter
          ? allSiblings.filter(
              (q) => (q.questionData as Record<string, unknown>)?.taskType === taskTypeFilter
            )
          : [];
        const availableVariants = taskTypeSiblings.length > 0 ? taskTypeSiblings : allSiblings;

        if (availableVariants.length > 0) {
          const variant = availableVariants[Math.floor(Math.random() * availableVariants.length)]!;

          logger.info('SRS next item (variant) retrieved', {
            userId: userId.substring(0, 10),
            topicProgressId: topic.id.substring(0, 10),
            taskType: topic.taskType ?? 'diagnosis',
          });

          // Fire-and-forget: increment timesServed for the served PreGeneratedQuestion.
          prisma.preGeneratedQuestion
            .updateMany({
              where: { id: variant.id },
              data: { timesServed: { increment: 1 } },
            })
            .catch((e) => logger.warn('Failed to increment timesServed', e));

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

      // Fallback: check UserProgress for any condition due for review
      // (Replaces legacy SRSItem query — SRSItem is deprecated)
      const dueProgress = await prisma.userProgress.findMany({
        where: {
          userId,
          nextReviewAt: { lte: now },
        },
        orderBy: { nextReviewAt: 'asc' },
        take: 5,
        select: {
          conditionId: true,
          fsrsCard: true,
        },
      });

      if (dueProgress.length === 0) {
        logger.info('No items due (UserProgress fallback)', { userId: userId.substring(0, 10) });
        return { data: { message: 'No items due' } };
      }

      // ─── Batch queries to avoid N+1 ──────────────────────────────────────────
      // Fetch all PreGeneratedQuestions and legacy Questions for due conditions
      // in two batch queries instead of up to 3 queries per loop iteration.
      const dueConditionIds = dueProgress.map((p) => p.conditionId);

      const [preGenBatch, legacyBatch] = await Promise.all([
        prisma.preGeneratedQuestion.findMany({
          where: { conditionId: { in: dueConditionIds } },
          orderBy: { generatedAt: 'desc' },
        }),
        prisma.question.findMany({
          where: { conditionId: { in: dueConditionIds } },
          take: dueConditionIds.length, // one per condition is enough
        }),
      ]);

      // Index by conditionId for O(1) lookup
      const preGenByCondition = new Map<string, typeof preGenBatch>();
      for (const q of preGenBatch) {
        const arr = preGenByCondition.get(q.conditionId) ?? [];
        arr.push(q);
        preGenByCondition.set(q.conditionId, arr);
      }
      const legacyByCondition = new Map<string, (typeof legacyBatch)[0]>();
      for (const q of legacyBatch) {
        if (!legacyByCondition.has(q.conditionId)) {
          legacyByCondition.set(q.conditionId, q);
        }
      }

      // Try to find a question for the first due condition
      for (const progress of dueProgress) {
        const card = progress.fsrsCard as { state?: number } | null;
        const fsrsState = card?.state ?? 0;
        const conditionPreGen = preGenByCondition.get(progress.conditionId) ?? [];

        let questionContent: any = null;
        let isVariant = false;

        // Prefer variant (newest) if in learning/relearning state
        if ((fsrsState === 1 || fsrsState === 3) && conditionPreGen.length > 0) {
          questionContent = conditionPreGen[0]; // already sorted by generatedAt desc
          isVariant = true;
        }

        if (!questionContent) {
          if (conditionPreGen.length > 0) {
            questionContent = conditionPreGen[0];
          } else {
            questionContent = legacyByCondition.get(progress.conditionId) ?? null;
          }
        }

        if (questionContent) {
          logger.info('SRS next item retrieved (UserProgress fallback)', {
            userId: userId.substring(0, 10),
            conditionId: progress.conditionId.substring(0, 10),
            isVariant,
          });

          // Fire-and-forget: increment timesServed when a PreGeneratedQuestion is served.
          // This enables the flag-rate kill switch in contentHealthService.
          if (!isVariant && questionContent.id) {
            prisma.preGeneratedQuestion
              .updateMany({
                where: { id: questionContent.id },
                data: { timesServed: { increment: 1 } },
              })
              .catch((err: unknown) =>
                logger.warn('srs/next timesServed increment failed (non-fatal)', {
                  error: err instanceof Error ? err.message : String(err),
                })
              );
          }

          return {
            data: {
              srsItemId: null,
              topicProgressId: null,
              question: questionContent,
              isVariant,
              taskType:
                (questionContent as { taskType?: string }).taskType ??
                getTaskTypeFromContent(questionContent.question ?? questionContent.stem ?? ''),
            },
          };
        }
      }

      logger.info('No questions found for due conditions', { userId: userId.substring(0, 10) });
      return { data: { message: 'No items due' } };
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
