/**
 * GET/POST /api/questions/session
 * Fetch questions for a study session with NCCPA blueprint weighting
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  SessionService,
  type SessionQuestionRequest,
} from '../../../lib/services/session/sessionService';

const SessionGetSchema = z.object({
  count: z.string().optional(),
  system: z.string().optional(),
  mode: z.string().optional(),
});

const SessionPostSchema = z.object({
  count: z.number().int().min(1).max(50).optional(),
  system: z.string().optional(),
  mode: z.enum(['standard', 'review', 'weakness', 'random', 'interleaved']).optional(),
  systems: z.array(z.string()).optional(),
  prioritizeWeakAreas: z.boolean().optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  SessionGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/session');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          data: { error: 'User not found', message: 'Account not synced yet.' },
          status: 404,
        };
      }

      const count = Math.min(parseInt(validated?.count || '10', 10), 50);
      const system = validated?.system || undefined;
      const mode = (validated?.mode || 'standard') as SessionQuestionRequest['mode'];

      const sessionService = new SessionService(env.DATABASE_URL, env);
      const result = await sessionService.getSessionQuestions({
        userId: user.id,
        count,
        system,
        mode,
      });

      logger.info('Session questions fetched (GET)', {
        userId: auth.userId,
        count: result.questions?.length || 0,
      });

      return { data: result };
    } catch (error) {
      logger.error('Error fetching session questions', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
      });
      throw new Error('Failed to fetch session questions');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

export const onRequestPost = authenticatedEndpoint(SessionPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/session');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { data: { error: 'User not found', message: 'Account not synced yet.' }, status: 404 };
    }

    const sessionService = new SessionService(env.DATABASE_URL, env);
    const result = await sessionService.getSessionQuestions({
      ...validated,
      userId: user.id,
      count: Math.min(validated.count || 10, 50),
    });

    logger.info('Session questions fetched (POST)', {
      userId: auth.userId,
      count: result.questions?.length || 0,
    });

    return { data: result };
  } catch (error) {
    logger.error('Error fetching session questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch session questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
