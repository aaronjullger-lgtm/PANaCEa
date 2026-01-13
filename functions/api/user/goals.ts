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

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

interface GoalCreateBody {
  title: string;
  description?: string;
  goalType: 'daily' | 'weekly' | 'exam_date' | 'mastery';
  targetValue?: number;
  targetUnit?: 'questions' | 'minutes' | 'conditions' | 'accuracy';
  targetDate?: string;
  targetSystem?: string;
  targetStability?: number;
  isRecurring?: boolean;
  motivationNotes?: string;
  rewardMessage?: string;
}

interface GoalUpdateBody {
  currentValue?: number;
  status?: string;
  completedAt?: Date;
  currentStreak?: number;
  bestStreak?: number;
  lastMetDate?: Date;
  [key: string]: any;
}

/**
 * GET /api/user/goals
 * List user's goals with optional filtering
 * 
 * Query params:
 * - status: Filter by status ('active', 'completed', 'paused', 'failed')
 * - goalType: Filter by type ('daily', 'weekly', 'exam_date', 'mastery')
 * - limit: Max results (default 50)
 */
export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  let prisma;
  
  try {
    // Authenticate
    const userId = await authenticateRequest(context.request, context.env);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse query params
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status');
    const goalType = url.searchParams.get('goalType');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    
    // Build where clause
    const where: any = { userId };
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
    
    return new Response(
      JSON.stringify({
        success: true,
        goals,
        count: goals.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching goals:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch goals',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

/**
 * POST /api/user/goals
 * Create a new goal
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  let prisma;
  
  try {
    // Authenticate
    const userId = await authenticateRequest(context.request, context.env);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse body
    const body = await context.request.json() as GoalCreateBody;
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
    } = body;
    
    // Validate required fields
    if (!title || !goalType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: title, goalType',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate goalType
    const validGoalTypes = ['daily', 'weekly', 'exam_date', 'mastery'];
    if (!validGoalTypes.includes(goalType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid goalType. Must be one of: ${validGoalTypes.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    
    // Create goal
    const goal = await prisma.userGoal.create({
      data: {
        userId,
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
    
    return new Response(
      JSON.stringify({
        success: true,
        goal,
        message: 'Goal created successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating goal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create goal',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

/**
 * PATCH /api/user/goals/:id
 * Update goal (progress, status, or any field)
 */
export async function onRequestPatch(context: { request: Request; env: Env }): Promise<Response> {
  let prisma;
  
  try {
    // Authenticate
    const userId = await authenticateRequest(context.request, context.env);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get goal ID from path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const goalId = pathParts[pathParts.length - 1];
    
    if (!goalId || goalId === 'goals') {
      return new Response(
        JSON.stringify({ success: false, error: 'Goal ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse body
    const updates = await context.request.json() as GoalUpdateBody;
    
    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    
    // Check ownership
    const existingGoal = await prisma.userGoal.findUnique({
      where: { id: goalId },
    });
    
    if (!existingGoal) {
      return new Response(
        JSON.stringify({ success: false, error: 'Goal not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (existingGoal.userId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate new progress percentage
    let progressPercentage = existingGoal.progressPercentage ?? 0;
    let status = existingGoal.status;
    let completedAt = existingGoal.completedAt;
    let currentStreak = existingGoal.currentStreak ?? 0;
    let bestStreak = existingGoal.bestStreak ?? 0;
    let lastMetDate = existingGoal.lastMetDate;
    
    const currentValue = existingGoal.currentValue ?? 0;
    const newCurrentValue = updates.currentValue !== undefined
      ? updates.currentValue
      : currentValue;
    
    if (existingGoal.targetValue) {
      progressPercentage = Math.min(
        100,
        (newCurrentValue / existingGoal.targetValue) * 100
      );
      
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
    
    // Update goal
    const goal = await prisma.userGoal.update({
      where: { id: goalId },
      data: {
        ...updates,
        progressPercentage,
        status: updates.status || status,
        completedAt: updates.completedAt || completedAt,
        currentStreak: updates.currentStreak !== undefined ? updates.currentStreak : currentStreak,
        bestStreak: updates.bestStreak !== undefined ? updates.bestStreak : bestStreak,
        lastMetDate: updates.lastMetDate || lastMetDate,
        updatedAt: new Date(),
      },
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        goal,
        message: 'Goal updated successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating goal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update goal',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

/**
 * DELETE /api/user/goals/:id
 * Delete a goal
 */
export async function onRequestDelete(context: { request: Request; env: Env }): Promise<Response> {
  let prisma;
  
  try {
    // Authenticate
    const userId = await authenticateRequest(context.request, context.env);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get goal ID from path
    const url = new URL(context.request.url);
    const pathParts = url.pathname.split('/');
    const goalId = pathParts[pathParts.length - 1];
    
    if (!goalId || goalId === 'goals') {
      return new Response(
        JSON.stringify({ success: false, error: 'Goal ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    
    // Check ownership
    const existingGoal = await prisma.userGoal.findUnique({
      where: { id: goalId },
    });
    
    if (!existingGoal) {
      return new Response(
        JSON.stringify({ success: false, error: 'Goal not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (existingGoal.userId !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Delete goal
    await prisma.userGoal.delete({
      where: { id: goalId },
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Goal deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting goal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete goal',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}
