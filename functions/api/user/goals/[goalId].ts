/**
 * User Goal Item API
 *
 * PATCH /api/user/goals/:goalId
 * DELETE /api/user/goals/:goalId
 *
 * Uses internal User.id for ownership because UserGoal.userId is a foreign key
 * to the Prisma User table, while auth.userId is the Clerk subject.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../../_shared/user-resolver';

const GoalUpdateBodySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    currentValue: z.number().int().min(0).max(10000).optional(),
    status: z.enum(['active', 'completed', 'paused', 'failed']).optional(),
    completedAt: z.string().datetime().optional(),
    currentStreak: z.number().int().min(0).optional(),
    bestStreak: z.number().int().min(0).optional(),
    lastMetDate: z.string().datetime().optional(),
    targetValue: z.number().int().min(0).max(10000).optional(),
    targetDate: z.string().datetime().optional(),
    motivationNotes: z.string().max(500).optional(),
    rewardMessage: z.string().max(200).optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: 'At least one goal update field is required',
});

const GoalUpdateSchema = z.object({
  body: GoalUpdateBodySchema,
});

const EmptySchema = z.object({});

function getGoalId(context: { params?: Record<string, string | string[]> }): string | null {
  const raw = context.params?.goalId;
  const goalId = Array.isArray(raw) ? raw[0] : raw;
  return typeof goalId === 'string' && goalId.trim().length > 0 ? goalId : null;
}

export const onRequestPatch = authenticatedEndpoint(GoalUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/goals/[goalId]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });
    const goalId = getGoalId(context);
    if (!goalId) {
      return { status: 400, data: { success: false, error: 'Goal ID required' } };
    }

    const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });
    const existingGoal = await prisma.userGoal.findFirst({
      where: { id: goalId, userId: user.id },
    });

    if (!existingGoal) {
      return { status: 404, data: { success: false, error: 'Goal not found' } };
    }

    const updates = validated.body;
    let progressPercentage = existingGoal.progressPercentage ?? 0;
    let status = existingGoal.status;
    let completedAt = existingGoal.completedAt;
    let currentStreak = existingGoal.currentStreak ?? 0;
    let bestStreak = existingGoal.bestStreak ?? 0;
    let lastMetDate = existingGoal.lastMetDate;

    const currentValue = existingGoal.currentValue ?? 0;
    const newCurrentValue =
      updates.currentValue !== undefined ? updates.currentValue : currentValue;

    if (existingGoal.targetValue) {
      progressPercentage = Math.min(100, (newCurrentValue / existingGoal.targetValue) * 100);

      if (newCurrentValue >= existingGoal.targetValue && existingGoal.status === 'active') {
        status = 'completed';
        completedAt = new Date();
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        lastMetDate = new Date();

        if (existingGoal.isRecurring) {
          updates.currentValue = 0;
          progressPercentage = 0;
          status = 'active';
          completedAt = null;
        }
      }
    }

    const updateData: Record<string, unknown> = {
      ...updates,
      progressPercentage,
      status: updates.status || status,
      completedAt: updates.completedAt ? new Date(updates.completedAt) : completedAt,
      currentStreak: updates.currentStreak !== undefined ? updates.currentStreak : currentStreak,
      bestStreak: updates.bestStreak !== undefined ? updates.bestStreak : bestStreak,
      lastMetDate: updates.lastMetDate ? new Date(updates.lastMetDate) : lastMetDate,
      updatedAt: new Date(),
    };

    if (updates.targetDate) {
      updateData.targetDate = new Date(updates.targetDate);
    }

    const goal = await prisma.userGoal.update({
      where: { id: goalId },
      data: updateData,
    });

    logger.info('Goal updated', { userId: user.id, goalId, updates: Object.keys(updates) });

    return {
      data: {
        success: true,
        goal,
        message: 'Goal updated successfully',
      },
    };
  } catch (error) {
    logger.error('Error updating goal', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to update goal');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

export const onRequestDelete = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/goals/[goalId]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });
    const goalId = getGoalId(context);
    if (!goalId) {
      return { status: 400, data: { success: false, error: 'Goal ID required' } };
    }

    const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });
    const deleted = await prisma.userGoal.deleteMany({
      where: { id: goalId, userId: user.id },
    });

    if (deleted.count === 0) {
      return { status: 404, data: { success: false, error: 'Goal not found' } };
    }

    logger.info('Goal deleted', { userId: user.id, goalId });

    return {
      data: {
        success: true,
        message: 'Goal deleted successfully',
      },
    };
  } catch (error) {
    logger.error('Error deleting goal', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to delete goal');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
