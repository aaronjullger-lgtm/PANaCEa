import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { ALL_TASK_TYPES, getTaskTypeLabel } from '../../../../lib/taskTypes';

const TopicProgressSchema = z.object({
  params: z.object({
    conditionId: z.string().min(1),
  }),
});

/**
 * GET /api/user/topic-progress/:conditionId
 * Retrieve topic-level progress breakdown for a condition
 */
export const onRequestGet = authenticatedEndpoint(TopicProgressSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/topic-progress/:conditionId');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { conditionId } = validated.params;

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Verify condition exists
    const condition = await prisma.medicalContent.findUnique({
      where: { id: conditionId },
      select: { id: true, condition: true, system: true },
    });

    if (!condition) {
      return { status: 404, error: 'Condition not found' };
    }

    // Fetch UserTopicProgress for all task types
    const topicProgress = await prisma.userTopicProgress.findMany({
      where: {
        userId: user.id,
        conditionId,
      },
    });

    // Build task progress array
    const taskProgress = ALL_TASK_TYPES.map((taskType) => {
      const progress = topicProgress.find((tp) => tp.taskType === taskType);

      if (!progress) {
        return {
          taskType,
          label: getTaskTypeLabel(taskType),
          stability: 0,
          difficulty: 5.0,
          state: 0,
          reps: 0,
          lapses: 0,
          mastery: 'untested',
          lastReview: null,
          nextReview: null,
        };
      }

      // Determine mastery level based on stability
      let mastery = 'low';
      if (progress.stability > 10) mastery = 'high';
      else if (progress.stability > 5) mastery = 'medium';

      return {
        taskType,
        label: getTaskTypeLabel(taskType),
        stability: progress.stability,
        difficulty: progress.difficulty,
        state: progress.state,
        reps: progress.reps,
        lapses: progress.lapses,
        mastery,
        lastReview: progress.lastReviewDate?.toISOString() || null,
        nextReview: progress.nextReviewDate?.toISOString() || null,
        variantsUsed: progress.variantsUsed.length,
      };
    });

    // Calculate overall mastery for the condition
    const testedTopics = taskProgress.filter((tp) => tp.reps > 0);
    const avgStability =
      testedTopics.length > 0
        ? testedTopics.reduce((sum, tp) => sum + tp.stability, 0) / testedTopics.length
        : 0;

    let overallMastery = 'untested';
    if (testedTopics.length > 0) {
      if (avgStability > 10) overallMastery = 'high';
      else if (avgStability > 5) overallMastery = 'medium';
      else overallMastery = 'low';
    }

    logger.info('Topic progress retrieved', {
      userId: user.id,
      conditionId,
      topicsTracked: topicProgress.length,
    });

    return {
      data: {
        conditionId,
        conditionName: condition.condition,
        system: condition.system,
        overallMastery,
        avgStability,
        taskProgress,
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve topic progress', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to retrieve topic progress' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
