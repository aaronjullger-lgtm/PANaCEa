import {
  authenticatedEndpoint,
  publicEndpoint,
  withMiddleware,
  withAuth,
  withValidation,
  withCors,
  withErrorHandling,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { updateTimingAggregates } from '../../../lib/services/userStatisticsService';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

// Define Zod schemas for request validation
const SessionCreateSchema = z.object({
  sessionType: z.string().optional(),
  systemsTargeted: z.array(z.string()).optional(),
  mode: z.string().optional(),
  focus: z.string().optional(),
  difficulty: z.string().optional(),
});

const SessionUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['end', 'update']).optional(),
  questionsAnswered: z.number().int().min(0).optional(),
  correctAnswers: z.number().int().min(0).optional(),
  totalTimeMs: z.number().int().min(0).optional(),
  systemsTargeted: z.array(z.string()).optional(),
  sessionType: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SessionCreateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/session');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { sessionType, systemsTargeted = [], mode, focus, difficulty } = validated;

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

    return {
      data: { sessionId: session.id },
      status: 201,
    };
  } catch (error) {
    logger.error('Failed to start session', error);
    return {
      status: 500,
      error: 'Failed to start session',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

export const onRequestPatch = authenticatedEndpoint(SessionUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/session');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      sessionId,
      action,
      questionsAnswered,
      correctAnswers,
      totalTimeMs,
      systemsTargeted,
      sessionType,
    } = validated;

    const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== auth.userId) {
      return {
        status: 404,
        error: 'Session not found',
      };
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
    if (
      typeof questionsAnswered === 'number' &&
      typeof correctAnswers === 'number' &&
      questionsAnswered > 0
    ) {
      data.accuracy = correctAnswers / questionsAnswered;
    }
    if (typeof totalTimeMs === 'number') {
      data.totalTimeMs = totalTimeMs;
      data.avgTimePerQuestion = questionsAnswered
        ? Math.round(totalTimeMs / Math.max(questionsAnswered, 1))
        : session.avgTimePerQuestion;
    }

    if (action === 'end') {
      const endedAt = new Date();
      data.endedAt = endedAt;
      if (!data.totalTimeMs) {
        const duration = endedAt.getTime() - new Date(session.startedAt).getTime();
        data.totalTimeMs = duration > 0 ? duration : 0;
        data.avgTimePerQuestion = questionsAnswered
          ? Math.round(data.totalTimeMs / Math.max(questionsAnswered, 1))
          : data.avgTimePerQuestion;
      }
    }

    const updated = await prisma.studySession.update({
      where: { id: sessionId },
      data,
    });

    await updateTimingAggregates(prisma as any, auth.userId, {
      refreshAvgSessionLength: true,
      refreshPeakHours: true,
    });

    return {
      data: { sessionId: updated.id, endedAt: updated.endedAt },
    };
  } catch (error) {
    logger.error('Failed to update session', error);
    return {
      status: 500,
      error: 'Failed to update session',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
