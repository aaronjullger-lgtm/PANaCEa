import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { applyAttemptToUserStatistics, updateTimingAggregates } from '../../../lib/services/userStatisticsService';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestPatch = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(request as any, env as any);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON payload', 400);
    }

    const { questionId, isCorrect, timeSpentMs, system, selectedCondition, correctCondition } = body || {};

    if (typeof isCorrect !== 'boolean') {
      return createErrorResponse('Field "isCorrect" is required and must be a boolean', 400);
    }

    // system is optional, but without it we cannot update per-system metrics
    const normalizedSystem = typeof system === 'string' && system.length ? system : undefined;
    const normalizedTime = typeof timeSpentMs === 'number' ? timeSpentMs : null;

    const updated = await applyAttemptToUserStatistics(prisma as any, auth.userId, {
      system: normalizedSystem,
      isCorrect,
      timeSpentMs: normalizedTime,
      selectedCondition,
      correctCondition,
      timestamp: new Date(),
    });

    await updateTimingAggregates(prisma as any, auth.userId, { refreshPeakHours: true });

    return createSuccessResponse(updated);
  } catch (error) {
    console.error('[user/statistics] Failed to update user statistics', error);
    return createErrorResponse('Failed to update statistics', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
