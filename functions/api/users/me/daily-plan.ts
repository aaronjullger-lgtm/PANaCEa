import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../../_shared/user-resolver';
import {
  applyDailyStudyPlanAction,
  getOrCreateDailyStudyPlan,
  normalizePlanDate,
  sanitizeStudyPlanTasks,
} from '../../../../lib/services/studyPlanService';

const DailyPlanGetQuerySchema = z.object({
  // Loose string — passed straight to `new Date(...)`. Invalid dates fall back
  // to `new Date()` (today) via downstream NaN handling.
  date: z.string().min(1).max(64).optional(),
});

const DailyPlanCompleteSchema = z.object({
  body: z.object({
    action: z.enum(['complete', 'skip', 'reschedule']).optional(),
    taskId: z.string().min(1).max(128).optional(),
    // Accuracy expressed as a 0..1 decimal (matches `actualAccuracy` storage).
    planDate: z.string().date().optional(),
    accuracy: z.number().min(0).max(1).optional(),
    // Minutes spent; clamp to a realistic full-day range so malformed input
    // can't pollute downstream analytics.
    durationMinutes: z.number().int().min(0).max(24 * 60).optional(),
    questionsAnswered: z.number().int().min(0).max(500).optional(),
    linkedSessionId: z.string().min(1).max(128).optional(),
    rescheduleDate: z.string().min(1).max(64).optional(),
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
export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  DailyPlanGetQuerySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const clerkId = context.auth.userId;

    try {
      const user = await resolveOrCreateUserRecord(prisma, clerkId, { id: true });

      const dateParam = context.validated.date;
      const targetDate = normalizePlanDate(dateParam ? new Date(dateParam) : new Date());
      const plan = await getOrCreateDailyStudyPlan(prisma as any, user.id, targetDate);

      return { status: 200, data: formatPlanResponse(plan) };
    } finally {
      await safePrismaDisconnect(prisma);
    }
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
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const clerkId = context.auth.userId;
    const { action, accuracy, durationMinutes, questionsAnswered, rescheduleDate, taskId, planDate, linkedSessionId } =
      context.validated.body;

    try {
      const user = await resolveOrCreateUserRecord(prisma, clerkId, { id: true });

      const today = normalizePlanDate(planDate ? new Date(planDate) : new Date());
      let plan = await prisma.dailyStudyPlan.findUnique({
        where: {
          userId_planDate: {
            userId: user.id,
            planDate: today,
          },
        },
      });

      if (!plan) {
        plan = await getOrCreateDailyStudyPlan(prisma as any, user.id, today);
      }

      let updatedPlan;
      try {
        updatedPlan = await applyDailyStudyPlanAction(prisma as any, plan, {
          action,
          accuracy,
          durationMinutes,
          questionsAnswered,
          linkedSessionId,
          taskId,
          rescheduleDate: rescheduleDate ? new Date(rescheduleDate) : undefined,
        });
      } catch (error) {
        createEndpointLogger('/api/users/me/daily-plan').error('Study plan action failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          status: 400,
          error: 'Could not apply that study-plan action. Please check the action and try again.',
        };
      }

      return { status: 200, data: formatPlanResponse(updatedPlan) };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
// ============================================
// Helper functions
// ============================================

interface RecommendedSession {
  id?: string;
  mode: string;
  count: number;
  systemFilter?: string[];
  conditionIds?: string[];
  reason: string;
  status?: string;
  route?: string;
  launchParams?: Record<string, string>;
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
  const sessions = sanitizeStudyPlanTasks(plan.recommendedSessions) as RecommendedSession[];
  const completedTasks = sessions.filter((session) => session.status === 'completed').length;
  const actionableTasks = sessions.filter((session) => session.status !== 'skipped' && session.status !== 'rescheduled').length;
  const percentComplete = plan.targetQuestionsCount > 0
    ? Math.min(100, Math.round((plan.actualQuestionsAnswered / plan.targetQuestionsCount) * 100))
    : actionableTasks > 0
      ? Math.round((completedTasks / actionableTasks) * 100)
      : 0;

  return {
    id: plan.id,
    planDate: plan.planDate.toISOString().split('T')[0],
    status: plan.status,

    // Recommendations
    recommendedModes: plan.recommendedModes,
    recommendedSessions: sessions,
    tasks: sessions,
    targetQuestionsCount: plan.targetQuestionsCount,
    targetSystemFocus: plan.targetSystemFocus,
    estimatedTimeMinutes: plan.estimatedTimeMinutes,

    // Progress tracking
    progress: {
      questionsAnswered: plan.actualQuestionsAnswered,
      questionsTarget: plan.targetQuestionsCount,
      percentComplete,
      accuracy: plan.actualAccuracy != null
        ? Math.min(100, Math.max(0, parseFloat((plan.actualAccuracy * 100).toFixed(1))))
        : null,
      durationMinutes: plan.actualDurationMinutes,
      estimatedDurationMinutes: plan.estimatedTimeMinutes,
      completedTasks,
      totalTasks: sessions.length,
    },
    // Metadata
    completedAt: plan.completedAt ? plan.completedAt.toISOString() : null,
    wasEffective: plan.wasEffective,
    feedbackReason: plan.feedbackReason,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
