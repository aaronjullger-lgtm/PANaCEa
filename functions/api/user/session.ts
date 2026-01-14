import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { updateTimingAggregates } from '../../../lib/services/userStatisticsService';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

type SessionCreatePayload = {
  sessionType?: string;
  systemsTargeted?: string[];
  mode?: string;
  focus?: string;
  difficulty?: string;
};

type SessionUpdatePayload = {
  sessionId?: string;
  action?: string;
  questionsAnswered?: number;
  correctAnswers?: number;
  totalTimeMs?: number;
  systemsTargeted?: string[];
  sessionType?: string;
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(request as any, env as any);
    if (!auth) return createErrorResponse('Unauthorized', 401);

    const body = (await request.json()) as SessionCreatePayload | null;
    const { sessionType, systemsTargeted = [], mode, focus, difficulty } = body || {};

    const session = await prisma.studySession.create({
      data: {
        userId: auth.userId,
        sessionType,
        systemsTargeted,
        systemsCovered: systemsTargeted,
        mode,
        focus,
        difficulty,
      },
    });

    return createSuccessResponse({ sessionId: session.id }, 201);
  } catch (error) {
    console.error('[user/session] Failed to start session', error);
    return createErrorResponse('Failed to start session', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};

export const onRequestPatch = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(request as any, env as any);
    if (!auth) return createErrorResponse('Unauthorized', 401);

    const body = (await request.json()) as SessionUpdatePayload | null;
    const { sessionId, action, questionsAnswered, correctAnswers, totalTimeMs, systemsTargeted, sessionType } = body || {};

    if (!sessionId || typeof sessionId !== 'string') {
      return createErrorResponse('sessionId is required', 400);
    }

    const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== auth.userId) {
      return createErrorResponse('Session not found', 404);
    }

    const data: Record<string, any> = {};
    if (Array.isArray(systemsTargeted)) {
      data.systemsTargeted = systemsTargeted;
      data.systemsCovered = systemsTargeted;
    }
    if (sessionType) data.sessionType = sessionType;

    if (typeof questionsAnswered === 'number') {
      data.totalQuestions = questionsAnswered;
    }
    if (typeof correctAnswers === 'number') {
      data.correctAnswers = correctAnswers;
    }
    if (typeof questionsAnswered === 'number' && typeof correctAnswers === 'number' && questionsAnswered > 0) {
      data.accuracy = correctAnswers / questionsAnswered;
    }
    if (typeof totalTimeMs === 'number') {
      data.totalTimeMs = totalTimeMs;
      data.avgTimePerQuestion = questionsAnswered ? Math.round(totalTimeMs / Math.max(questionsAnswered, 1)) : session.avgTimePerQuestion;
    }

    if (action === 'end') {
      const endedAt = new Date();
      data.endedAt = endedAt;
      if (!data.totalTimeMs) {
        const duration = endedAt.getTime() - new Date(session.startedAt).getTime();
        data.totalTimeMs = duration > 0 ? duration : 0;
        data.avgTimePerQuestion = questionsAnswered ? Math.round(data.totalTimeMs / Math.max(questionsAnswered, 1)) : data.avgTimePerQuestion;
      }
    }

    const updated = await prisma.studySession.update({
      where: { id: sessionId },
      data,
    });

    await updateTimingAggregates(prisma as any, auth.userId, { refreshAvgSessionLength: true, refreshPeakHours: true });

    return createSuccessResponse({ sessionId: updated.id, endedAt: updated.endedAt });
  } catch (error) {
    console.error('[user/session] Failed to update session', error);
    return createErrorResponse('Failed to update session', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
