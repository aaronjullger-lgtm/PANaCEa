/**
 * PUT /api/study‑path/accept
 * Dynamic Study Path Optimizer – Accept endpoint (Phase 6.2).
 *
 * Marks a generated study plan as “accepted” by the user, storing the acceptance
 * for later comparison and analytics. Optionally collects user feedback.
 *
 * Request body (JSON):
 *   - planId: string (required)
 *   - feedback?: 'TOO_LONG' | 'TOO_SHORT' | 'WRONG_FOCUS' | 'OTHER'
 *   - feedbackNotes?: string
 *
 * Authentication required (Clerk).
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { getCorsConfig, getCorsHeaders } from '../_shared/cors';
import {
  CACHE_CONFIG,
  getFromCache,
  getStudyPathCacheKey,
  isKVAvailable,
} from '../_shared/cache';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import type { AcceptPlanRequest, RecommendationResponse, StudyPlan, StudySession } from '@/types';

// ============================================================================
// Zod Schema for Request Body
// ============================================================================

const AcceptPlanRequestSchema = z.object({
  planId: z.string().min(1),
  feedback: z.enum(['TOO_LONG', 'TOO_SHORT', 'WRONG_FOCUS', 'OTHER']).optional(),
  feedbackNotes: z.string().optional(),
  plan: z.unknown().optional(),
});

function normalizePlanDate(value: Date | string | null | undefined): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value: Date): string {
  return normalizePlanDate(value).toISOString().slice(0, 10);
}

function stableSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))
  );
}

function sessionQuestionTarget(session: StudySession): number {
  const minutes = session.topics.reduce((sum, topic) => sum + Math.max(0, topic.estimatedMinutes || 0), 0);
  return Math.max(5, Math.min(40, Math.round(minutes / 2) || 10));
}

function sessionEstimatedMinutes(session: StudySession): number {
  return Math.max(
    10,
    session.topics.reduce((sum, topic) => sum + Math.max(0, topic.estimatedMinutes || 0), 0)
  );
}

function buildLaunchRoute({
  taskId,
  planDate,
  targetQuestions,
  systems,
}: {
  taskId: string;
  planDate: Date;
  targetQuestions: number;
  systems: string[];
}): string {
  const params = new URLSearchParams({
    source: 'study-plan',
    taskId,
    planDate: toDateKey(planDate),
    mode: 'adaptive',
    count: String(targetQuestions),
  });
  if (systems.length > 0) params.set('systems', systems.join(','));
  return `/study/main-session?${params.toString()}`;
}

function sessionToDailyTask(plan: StudyPlan, session: StudySession, index: number) {
  const planDate = normalizePlanDate(session.date);
  const systems = uniqueStrings(session.topics.map((topic) => topic.taxonomyCode));
  const targetQuestions = sessionQuestionTarget(session);
  const estimatedMinutes = sessionEstimatedMinutes(session);
  const label = systems.length > 0 ? systems.slice(0, 3).join(', ') : 'adaptive study';
  const taskId = `${toDateKey(planDate)}-study-path-${stableSlug(session.id || String(index + 1))}`;
  const route = buildLaunchRoute({ taskId, planDate, targetQuestions, systems });

  return {
    id: taskId,
    kind: 'main',
    mode: 'core_adaptive',
    status: 'pending',
    title: `Study path: ${label}`,
    description: `Accepted study-path session for ${label}.`,
    reason: session.notes ?? 'Accepted from your personalized study path.',
    systems,
    systemFilter: systems,
    conditionIds: [],
    reviewCardIds: [],
    estimatedMinutes,
    targetQuestions,
    count: targetQuestions,
    priority: 'medium',
    launchSettings: {
      mode: 'core_adaptive',
      focus: 'all',
      count: targetQuestions,
      questionCount: targetQuestions,
      systems,
    },
    route,
    launchParams: Object.fromEntries(new URLSearchParams(route.split('?')[1] ?? '')),
    studyPathPlanId: plan.id,
    studyPathSessionId: session.id,
  };
}

function mergeAcceptedTaskProgress<TTask extends ReturnType<typeof sessionToDailyTask>>(
  nextTasks: TTask[],
  existingSessions: unknown
): TTask[] {
  if (!Array.isArray(existingSessions)) return nextTasks;
  const existingById = new Map(
    existingSessions
      .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === 'object')
      .map((task) => [String(task.id ?? ''), task])
      .filter(([id]) => id.length > 0)
  );

  return nextTasks.map((task) => {
    const previous = existingById.get(task.id);
    if (!previous) return task;

    return {
      ...task,
      status: typeof previous.status === 'string' ? previous.status : task.status,
      startedAt: typeof previous.startedAt === 'string' ? previous.startedAt : undefined,
      completedAt: typeof previous.completedAt === 'string' ? previous.completedAt : undefined,
      skippedAt: typeof previous.skippedAt === 'string' ? previous.skippedAt : undefined,
      actualQuestionsAnswered:
        typeof previous.actualQuestionsAnswered === 'number'
          ? previous.actualQuestionsAnswered
          : undefined,
      actualDurationMinutes:
        typeof previous.actualDurationMinutes === 'number'
          ? previous.actualDurationMinutes
          : undefined,
      actualAccuracy:
        typeof previous.actualAccuracy === 'number' ? previous.actualAccuracy : undefined,
      linkedSessionId:
        typeof previous.linkedSessionId === 'string' ? previous.linkedSessionId : undefined,
    };
  });
}

function preservedDayStatus(existingStatus: unknown): 'pending' | 'active' | 'in_progress' | 'completed' | 'skipped' {
  if (
    existingStatus === 'active' ||
    existingStatus === 'in_progress' ||
    existingStatus === 'completed' ||
    existingStatus === 'skipped'
  ) {
    return existingStatus;
  }
  return 'pending';
}

function coerceAcceptedPlanPayload(value: unknown, planId: string): StudyPlan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as Partial<StudyPlan>;
  if (plan.id !== planId || !Array.isArray(plan.sessions)) return null;

  return {
    id: plan.id,
    userId: typeof plan.userId === 'string' ? plan.userId : '',
    generatedAt: normalizePlanDate(plan.generatedAt),
    validUntil: normalizePlanDate(plan.validUntil),
    sessions: plan.sessions
      .filter((session): session is StudySession => Boolean(session) && typeof session === 'object')
      .map((session) => ({
        ...session,
        date: normalizePlanDate(session.date),
        topics: Array.isArray(session.topics) ? session.topics : [],
      })),
    totalEstimatedMinutes: typeof plan.totalEstimatedMinutes === 'number' ? plan.totalEstimatedMinutes : 0,
    confidence: typeof plan.confidence === 'number' ? plan.confidence : 0,
    metadata: {
      blueprintCoverage: {},
      projectedRetentionIncrease: 0,
      fatigueRisk: 'LOW',
      gapsProcessed: 0,
      constraintsUsed: {},
      ...(plan.metadata ?? {}),
    },
  };
}

function chooseAcceptedPlan(
  recommendation: RecommendationResponse | null,
  planId: string,
  fallbackPlan?: unknown
): StudyPlan | null {
  if (!recommendation) return null;
  if (recommendation.plan?.id === planId) return recommendation.plan;
  const cachedAlternative = recommendation.alternatives?.find((candidate) => candidate.id === planId);
  return cachedAlternative ?? coerceAcceptedPlanPayload(fallbackPlan, planId);
}

async function persistAcceptedPlanToDailyPlans(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  plan: StudyPlan
): Promise<number> {
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const tasksByDate = new Map<string, { planDate: Date; tasks: ReturnType<typeof sessionToDailyTask>[] }>();

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]!;
    const planDate = normalizePlanDate(session.date);
    const dateKey = toDateKey(planDate);
    const bucket = tasksByDate.get(dateKey) ?? { planDate, tasks: [] };
    bucket.tasks.push(sessionToDailyTask(plan, session, index));
    tasksByDate.set(dateKey, bucket);
  }

  let persisted = 0;

  for (const { planDate, tasks } of tasksByDate.values()) {
    const existingPlan = await prisma.dailyStudyPlan.findUnique({
      where: { userId_planDate: { userId, planDate } },
      select: { recommendedSessions: true, status: true },
    });
    const recommendedSessions = mergeAcceptedTaskProgress(
      tasks,
      existingPlan?.recommendedSessions
    );
    const recommendedModes = Array.from(new Set(recommendedSessions.map((task) => task.mode)));
    const targetQuestionsCount = recommendedSessions.reduce((sum, task) => sum + task.targetQuestions, 0);
    const targetSystemFocus = uniqueStrings(recommendedSessions.flatMap((task) => task.systems)).slice(0, 5);
    const estimatedTimeMinutes = recommendedSessions.reduce((sum, task) => sum + task.estimatedMinutes, 0);
    const status = preservedDayStatus(existingPlan?.status);

    await prisma.dailyStudyPlan.upsert({
      where: { userId_planDate: { userId, planDate } },
      create: {
        userId,
        planDate,
        recommendedSessions,
        recommendedModes,
        targetQuestionsCount,
        targetSystemFocus,
        estimatedTimeMinutes,
        status,
        feedbackReason: `Accepted study path ${plan.id}.`,
      },
      update: {
        recommendedSessions,
        recommendedModes,
        targetQuestionsCount,
        targetSystemFocus,
        estimatedTimeMinutes,
        status,
        feedbackReason: `Accepted study path ${plan.id}.`,
        updatedAt: new Date(),
      },
    });
    persisted += 1;
  }

  return persisted;
}

// ============================================================================
// Request Handler
// ============================================================================

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestPut = authenticatedEndpoint(
  AcceptPlanRequestSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const corsConfig = getCorsConfig(env);
    const corsHeaders = getCorsHeaders(context.request, corsConfig) ?? {};
    const jsonHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const { planId, feedback, feedbackNotes, plan: requestPlan } = validated;
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });
      let persistedDailyPlans = 0;

      // 1. Load the recommendation the UI just viewed. The study-path dashboard
      // requests recommendations without query constraints, so `{}` matches the
      // cache key used by the recommendation endpoint for the default path.
      let acceptedPlan: StudyPlan | null = null;
      if (isKVAvailable(env.CACHE)) {
        const recommendationKey = getStudyPathCacheKey(auth.userId, {});
        const cachedRecommendation = await getFromCache<RecommendationResponse>(
          env.CACHE,
          recommendationKey,
          CACHE_CONFIG.PREFIX.STUDY_PATH
        );
        acceptedPlan = chooseAcceptedPlan(cachedRecommendation, planId, requestPlan);
      }
      acceptedPlan ??= coerceAcceptedPlanPayload(requestPlan, planId);

      if (acceptedPlan) {
        persistedDailyPlans = await persistAcceptedPlanToDailyPlans(prisma, user.id, acceptedPlan);
      }

      // 2. Store acceptance in KV (if available)
      if (isKVAvailable(env.CACHE)) {
        const acceptanceKey = `accepted_plan:${auth.userId}`;
        const acceptanceData = {
          planId,
          acceptedAt: new Date().toISOString(),
          feedback,
          feedbackNotes,
          persistedDailyPlans,
        };
        // Store with TTL 30 days (2592000 seconds) – long enough for later comparison
        await env.CACHE.put(
          acceptanceKey,
          JSON.stringify(acceptanceData),
          { expirationTtl: 2592000 }
        );
      } else {
        // Fallback: log to database (optional future enhancement)
        console.log('Plan acceptance (KV not available):', { userId: auth.userId, planId, feedback });
      }

      // 3. Return success
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Plan accepted successfully',
          planId,
          acceptedAt: new Date().toISOString(),
          persistedDailyPlans,
        }),
        {
          status: 200,
          headers: jsonHeaders,
        }
      );
    } catch (error) {
      console.error('Study‑path accept endpoint error:', error);
      return new Response(
        JSON.stringify({ error: 'Unable to accept study plan. Please try again.' }),
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
