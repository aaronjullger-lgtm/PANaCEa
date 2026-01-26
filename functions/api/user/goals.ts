/**
 * User Goals API
 *
 * Sprint: User Data Improvement Plan - Step 5 (Sprint B)
 *
 * Full CRUD for user goal tracking:
 * - GET: List all goals (with filtering)
 * - POST: Create new goal
 * - PATCH /:id: Update goal (including progress)
 * - DELETE /:id: Delete goal
 *
 * Goal types supported:
 * - daily: X questions/minutes per day
 * - weekly: X questions/minutes per week
 * - exam_date: Reach target by exam date
 * - mastery: Reach stability threshold for system
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Validation schemas
const GoalListSchema = z.object({
  status: z.enum(['active', 'completed', 'paused', 'failed']).optional(),
  goalType: z.enum(['daily', 'weekly', 'exam_date', 'mastery']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const GoalCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    goalType: z.enum(['daily', 'weekly', 'exam_date', 'mastery']),
    targetValue: z.number().int().min(0).max(10000).optional(),
    targetUnit: z.enum(['questions', 'minutes', 'conditions', 'accuracy']).optional(),
    targetDate: z.string().datetime().optional(),
    targetSystem: z.string().max(50).optional(),
    targetStability: z.number().min(0).max(100).optional(),
    isRecurring: z.boolean().optional(),
    motivationNotes: z.string().max(500).optional(),
    rewardMessage: z.string().max(200).optional(),
  }),
});

const GoalUpdateSchema = z.object({
  body: z.object({
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
  }),
});

const EmptySchema = z.object({});

export const onRequestOptions = withCors();

/**
 * GET - List user's goals with optional filtering
 */
export const onRequestGet = authenticatedEndpoint(GoalListSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/goals');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Parse query params
    const status = validated.status;
    const goalType = validated.goalType;
    const limit = validated.limit ? parseInt(validated.limit) : 50;

    // Build where clause
    const where: any = { userId: auth.userId };
    if (status) where.status = status;
    if (goalType) where.goalType = goalType;

    // Fetch goals
    const goals = await prisma.userGoal.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // Active first
        { createdAt: 'desc' },
      ],
      take: Math.min(limit, 100),
    });

    logger.info('Goals fetched', { count: goals.length, status, goalType });

    return {
      data: {
        success: true,
        goals,
        count: goals.length,
      },
    };
  } catch (error) {
    logger.error('Error fetching goals', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch goals');
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { source: 'query' });

/**
 * POST - Create a new goal
 */
export const onRequestPost = authenticatedEndpoint(GoalCreateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/goals');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    const {
      title,
      description,
      goalType,
      targetValue,
      targetUnit,
      targetDate,
      targetSystem,
      targetStability,
      isRecurring,
      motivationNotes,
      rewardMessage,
    } = validated.body;

    // Create goal
    const goal = await prisma.userGoal.create({
      data: {
        userId: auth.userId,
        title,
        description,
        goalType,
        targetValue,
        targetUnit,
        targetDate: targetDate ? new Date(targetDate) : null,
        targetSystem,
        targetStability,
        isRecurring: isRecurring || false,
        motivationNotes,
        rewardMessage,
        status: 'active',
        currentValue: 0,
        progressPercentage: 0,
      },
    });

    logger.info('Goal created', { goalId: goal.id, goalType, title });

    return {
      data: {
        success: true,
        goal,
        message: 'Goal created successfully',
      },
      status: 201,
    };
  } catch (error) {
    logger.error('Error creating goal', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to create goal');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * PATCH - Update goal (progress, status, or any field)
 */
export const onRequestPatch = authenticatedEndpoint(GoalUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/goals');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Get goal ID from path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const goalId = pathParts[pathParts.length - 1];

    if (!goalId || goalId === 'goals') {
      logger.warn('Goal ID missing in PATCH request');
      return {
        data: { success: false, error: 'Goal ID required' },
        status: 400,
      };
    }

    const updates = validated.body;

    // Check ownership
    const existingGoal = await prisma.userGoal.findUnique({
      where: { id: goalId },
    });

    if (!existingGoal) {
      logger.warn('Goal not found', { goalId });
      return {
        data: { success: false, error: 'Goal not found' },
        status: 404,
      };
    }

    if (existingGoal.userId !== auth.userId) {
      logger.warn('Unauthorized goal access attempt', { goalId, attemptedBy: auth.userId });
      return {
        data: { success: false, error: 'Unauthorized' },
        status: 403,
      };
    }

    // Calculate new progress percentage
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

      // Auto-complete if target reached
      if (newCurrentValue >= existingGoal.targetValue && existingGoal.status === 'active') {
        status = 'completed';
        completedAt = new Date();
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
        lastMetDate = new Date();

        // Reset for recurring goals
        if (existingGoal.isRecurring) {
          updates.currentValue = 0;
          progressPercentage = 0;
          status = 'active';
          completedAt = null;
        }
      }
    }

    // Prepare update data
    const updateData: any = {
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

    // Update goal
    const goal = await prisma.userGoal.update({
      where: { id: goalId },
      data: updateData,
    });

    logger.info('Goal updated', { goalId, updates: Object.keys(updates) });

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

/**
 * DELETE - Delete a goal
 */
export const onRequestDelete = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/goals');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.addContext({ userId: auth.userId });

    // Get goal ID from path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const goalId = pathParts[pathParts.length - 1];

    if (!goalId || goalId === 'goals') {
      logger.warn('Goal ID missing in DELETE request');
      return {
        data: { success: false, error: 'Goal ID required' },
        status: 400,
      };
    }

    // Check ownership
    const existingGoal = await prisma.userGoal.findUnique({
      where: { id: goalId },
    });

    if (!existingGoal) {
      logger.warn('Goal not found for deletion', { goalId });
      return {
        data: { success: false, error: 'Goal not found' },
        status: 404,
      };
    }

    if (existingGoal.userId !== auth.userId) {
      logger.warn('Unauthorized goal deletion attempt', { goalId, attemptedBy: auth.userId });
      return {
        data: { success: false, error: 'Unauthorized' },
        status: 403,
      };
    }

    // Delete goal
    await prisma.userGoal.delete({
      where: { id: goalId },
    });

    logger.info('Goal deleted', { goalId });

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
