import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { generateDailyPlan } from '../../_shared/phenotypeService';
import { prisma } from '../../_shared/prisma-edge';

const DailyPlanGetQuerySchema = z.object({
  // Loose string — passed straight to `new Date(...)`. Invalid dates fall back
  // to `new Date()` (today) via downstream NaN handling.
  date: z.string().min(1).max(64).optional(),
});

const DailyPlanCompleteSchema = z.object({
  body: z.object({
    // Accuracy expressed as a 0..1 decimal (matches `actualAccuracy` storage).
    accuracy: z.number().min(0).max(1).optional(),
    // Minutes spent; clamp to a realistic full-day range so malformed input
    // can't pollute downstream analytics.
    durationMinutes: z.number().int().min(0).max(24 * 60).optional(),
  }),
});

export type DailyPlanCompleteRequest = z.infer<typeof DailyPlanCompleteSchema>;

/**
 * GET /api/users/me/daily-plan
 * Get today's personalized daily study plan
 *
 * Optional query params:
 * - date: ISO date string (default: today)
 */
export const onRequestGet = authenticatedEndpoint(
  DailyPlanGetQuerySchema,
  async (context) => {
    const clerkId = context.auth.userId;

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Parse optional date param
    const dateParam = context.validated.date;
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
        return { status: 500, error: 'Failed to generate daily plan' };
      }

      return { status: 200, data: formatPlanResponse(newPlan) };
    }

    return { status: 200, data: formatPlanResponse(plan) };
  },
  { source: 'query', requestsPerMinute: 30 }
);

/**
 * POST /api/users/me/daily-plan/complete
 * Mark today's plan as completed
 */
export const onRequestPost = authenticatedEndpoint(
  DailyPlanCompleteSchema,
  async (context) => {
    const clerkId = context.auth.userId;
    const { accuracy, durationMinutes } = context.validated.body;

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

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
      return { status: 404, error: 'No plan found for today' };
    }

    // Update plan with completion data
    const updatedPlan = await prisma.dailyStudyPlan.update({
      where: { id: plan.id },
      data: {
        status: 'completed',
        actualAccuracy: accuracy ?? undefined,
        actualDurationMinutes: durationMinutes ?? undefined,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { status: 200, data: formatPlanResponse(updatedPlan) };
  },
  { requestsPerMinute: 30 }
);
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
}) {  const sessions = Array.isArray(plan.recommendedSessions)
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
      percentComplete: plan.targetQuestionsCount > 0
        ? Math.round((plan.actualQuestionsAnswered / plan.targetQuestionsCount) * 100)
        : 0,
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