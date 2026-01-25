/**
 * API Endpoint: /api/user/topic-progress/[conditionId]
 *
 * Get user's FSRS progress data for a specific condition across all task types
 *
 * SECURITY: Sprint 4 - Converted to middleware pattern
 * - authenticatedEndpoint for auth enforcement
 * - Zod schema validation (params)
 * - Secure logging
 * - Safe Prisma disconnect
 */

import { z } from 'zod';
import {
  authenticatedEndpoint,
  withCors,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { logger } from '../../_shared/secureLogger';
import { TASK_TYPES } from '../../../../lib/taskTypes';

// Schema for validating the conditionId path parameter
const TopicProgressSchema = z.object({
  params: z.object({
    conditionId: z.string().uuid(),
  }),
});

type TopicProgressInput = z.infer<typeof TopicProgressSchema>;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  TopicProgressSchema,
  async (context: AuthenticatedContext & ValidatedContext<TopicProgressInput>) => {
    const { env, auth, params } = context;
    const conditionId = params?.conditionId;

    if (!conditionId) {
      return { status: 400, error: 'Condition ID required' };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        logger.warn('User not found for topic progress', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const userId = user.id;

      // Fetch progress for this condition across all task types
      const progressRecords = await prisma.userTopicProgress.findMany({
        where: {
          userId,
          conditionId,
        },
      });

      // Normalize data for frontend
      // Expected format: { 'diagnosis': 0.8, 'treatment': 0.5, ... }
      // Stability > 20 is "mastered" roughly. Max stability is 365.
      // For now: map stability / 30, capped at 1.0

      const defaultTypes = Object.values(TASK_TYPES);
      const result: Record<string, any> = {};

      // Initialize defaults
      defaultTypes.forEach((type) => {
        result[type] = {
          stability: 0,
          mastery: 0,
          state: 0, // New
          nextReview: null,
        };
      });

      type ProgressRecord = (typeof progressRecords)[0];
      progressRecords.forEach((record: ProgressRecord) => {
        const mastery = Math.min(record.stability / 21, 1); // 21 days stability = 100% mastery approximation
        result[record.taskType] = {
          stability: record.stability,
          mastery: parseFloat(mastery.toFixed(2)),
          state: record.state,
          nextReview: record.nextReviewDate,
        };
      });

      logger.info('Topic progress retrieved', {
        userId,
        conditionId,
        taskTypeCount: progressRecords.length,
      });

      return { data: result };
    } catch (error) {
      logger.error('Topic progress error', error, { userId: auth.userId, conditionId });
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
