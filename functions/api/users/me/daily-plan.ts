import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../../_shared/auth';
import { errorHandler } from '../../_shared/error-handler';
import { generateDailyPlan } from '../../_shared/phenotypeService';
import { prisma } from '../../_shared/prisma-edge';

/**
 * GET /api/users/me/daily-plan
 * Get today's personalized daily study plan
 *
 * Optional query params:
 * - date: ISO date string (default: today)
 *
 * Returns:
 * - Recommended study sessions for the day
 * - Target question count and systems to focus
 * - Estimated duration
 * - Current progress on the plan
 */
export async function onRequestGet(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);

    // Parse optional date param
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    // Get the plan for the specified date
    const plan = await prisma.dailyStudyPlan.findUnique({
      where: {
        userId_planDate: {
          userId: user.id,
          planDate: targetDate,
        },
      },
    });

    if (!plan) {
      // Generate plan on-demand if it doesn't exist
      const result = await generateDailyPlan(user.id, targetDate);
      const newPlan = await prisma.dailyStudyPlan.findUnique({
        where: { id: result.id },
      });

      if (!newPlan) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate daily plan' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify(formatPlanResponse(newPlan)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(formatPlanResponse(plan)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}

/**
 * POST /api/users/me/daily-plan/complete
 * Mark today's plan as completed
 */
export async function onRequestPost(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);
    const body = await request.json() as { accuracy?: number; durationMinutes?: number };

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find today's plan
    const plan = await prisma.dailyStudyPlan.findUnique({
      where: {
        userId_planDate: {
          userId: user.id,
          planDate: today,
        },
      },
    });

    if (!plan) {
      return new Response(
        JSON.stringify({ error: 'No plan found for today' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update plan with completion data
    const updatedPlan = await prisma.dailyStudyPlan.update({
      where: { id: plan.id },
      data: {
        status: 'completed',
        actualAccuracy: body.accuracy || undefined,
        actualDurationMinutes: body.durationMinutes || undefined,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return new Response(JSON.stringify(formatPlanResponse(updatedPlan)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}

// ============================================
// Helper functions
// ============================================

interface RecommendedSession {
  mode: string;
  count: number;
  systemFilter?: string[];
  reason: string;
}

function formatPlanResponse(plan: {
  id: string;
  userId: string;
  planDate: Date;
  recommendedSessions: unknown;
  recommendedModes: string[];
  targetQuestionsCount: number;
  targetSystemFocus: string[];
  estimatedTimeMinutes: number;
  status: string;
  actualQuestionsAnswered: number;
  actualDurationMinutes: number | null;
  actualAccuracy: number | null;
  completedAt: Date | null;
  wasEffective: boolean | null;
  feedbackReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const sessions = Array.isArray(plan.recommendedSessions)
    ? (plan.recommendedSessions as RecommendedSession[])
    : [];

  return {
    id: plan.id,
    planDate: plan.planDate.toISOString().split('T')[0],
    status: plan.status,

    // Recommendations
    recommendedModes: plan.recommendedModes,
    recommendedSessions: sessions,
    targetQuestionsCount: plan.targetQuestionsCount,
    targetSystemFocus: plan.targetSystemFocus,
    estimatedTimeMinutes: plan.estimatedTimeMinutes,

    // Progress tracking
    progress: {
      questionsAnswered: plan.actualQuestionsAnswered,
      questionsTarget: plan.targetQuestionsCount,
      percentComplete: Math.round(
        (plan.actualQuestionsAnswered / plan.targetQuestionsCount) * 100
      ),
      accuracy: plan.actualAccuracy
        ? parseFloat((plan.actualAccuracy * 100).toFixed(1))
        : null,
      durationMinutes: plan.actualDurationMinutes,
      estimatedDurationMinutes: plan.estimatedTimeMinutes,
    },

    // Metadata
    completedAt: plan.completedAt ? plan.completedAt.toISOString() : null,
    wasEffective: plan.wasEffective,
    feedbackReason: plan.feedbackReason,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
