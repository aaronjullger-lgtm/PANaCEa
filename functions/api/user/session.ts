import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SessionStartSchema = z.object({
  body: z.object({
    sessionType: z.enum(['mixed', 'focused', 'review']).default('mixed'),
    systemsTargeted: z.array(z.string()).optional().default([]),
  }),
});

const SessionUpdateSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1).max(200),
    action: z.enum(['end', 'update']),
    questionsAnswered: z.number().int().min(0).max(10000).optional(),
    correctCount: z.number().int().min(0).max(10000).optional(),
    /** Gemini 3 Deep Think: thinking phase latency (ms), logged separately from response time */
    thinkingTimeMs: z.number().int().min(0).max(600000).optional(),
  }),
});

export const onRequestOptions = withCors();

/**
 * POST /api/user/session
 * Start a new study session
 */
export const onRequestPost = authenticatedEndpoint(SessionStartSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/session [POST]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { sessionType, systemsTargeted } = validated.body;

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    const sessionId = `session-${user.id.slice(0, 8)}-${Date.now()}`;
    const session = await prisma.studySession.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionType: sessionType ?? null,
        systemsTargeted: systemsTargeted ?? [],
        startedAt: new Date(),
      },
    });

    logger.info('Study session started', {
      userId: user.id,
      sessionId: session.id,
      sessionType,
    });

    return {
      data: {
        success: true,
        session: {
          id: session.id,
          sessionType: session.sessionType,
          startedAt: session.startedAt.toISOString(),
        },
      },
    };
  } catch (error) {
    logger.error('Failed to start study session', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to start study session' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * PATCH /api/user/session
 * Update or end a study session
 */
export const onRequestPatch = authenticatedEndpoint(SessionUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/session [PATCH]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { sessionId, action, questionsAnswered, correctCount, thinkingTimeMs } =
      validated.body as {
        sessionId: string;
        action: string;
        questionsAnswered?: number;
        correctCount?: number;
        thinkingTimeMs?: number;
      };

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Verify session belongs to user
    const session = await prisma.studySession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!session) {
      return { status: 404, error: 'Session not found' };
    }

    // Build update data
    const updateData: any = {};

    if (action === 'end') {
      updateData.endedAt = new Date();
    }

    if (typeof questionsAnswered === 'number') {
      updateData.totalQuestions = questionsAnswered;
    }

    if (typeof correctCount === 'number') {
      updateData.correctAnswers = correctCount;
    }

    if (typeof thinkingTimeMs === 'number') {
      updateData.thinkingTimeMs = thinkingTimeMs;
    }

    // Update session
    const updatedSession = await prisma.studySession.update({
      where: { id: sessionId },
      data: updateData,
    });

    logger.info(`Study session ${action === 'end' ? 'ended' : 'updated'}`, {
      userId: user.id,
      sessionId: session.id,
      totalQuestions: updatedSession.totalQuestions,
    });

    return {
      data: {
        success: true,
        session: {
          id: updatedSession.id,
          questionsAnswered: updatedSession.totalQuestions,
          correctCount: updatedSession.correctAnswers,
          thinkingTimeMs: updatedSession.thinkingTimeMs ?? undefined,
          endedAt: updatedSession.endedAt?.toISOString() || null,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to update study session', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to update study session' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
