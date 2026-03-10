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
  /** Core PANCE Simulation: strict NCCIPA blueprint, no weak-area bias */
  simulationStrict: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  eorMode: z.string().optional().transform((v) => v === 'true' || v === '1'),
  eorDeadline: z.string().optional(),
});

const SessionPostSchema = z.object({
  count: z.number().int().min(1).max(50).optional(),
  system: z.string().optional(),
  mode: z.enum(['standard', 'review', 'weakness', 'random', 'interleaved']).optional(),
  systems: z.array(z.string()).optional(),
  prioritizeWeakAreas: z.boolean().optional(),
  simulationStrict: z.boolean().optional(),
  eorMode: z.boolean().optional(),
  eorDeadline: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  SessionGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/session');
    logger.info('DATABASE_URL present', { hasUrl: !!env.DATABASE_URL, urlPrefix: env.DATABASE_URL ? env.DATABASE_URL.substring(0, 20) : '' });
    if (!env.DATABASE_URL) {
      logger.error('DATABASE_URL not configured');
      return {
        data: {
          error: 'Session service unavailable',
          message: 'Server database is not configured.',
        },
        status: 503,
      };
    }
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    let sessionService: SessionService | null = null;
    try {
      // Retry user lookup to handle intermittent Accelerate failures
      let user = null;
      let userLookupError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          user = await prisma.user.findUnique({
            where: { clerkId: auth.userId },
            select: { id: true, rotationExamDate: true },
          });
          break;
        } catch (error) {
          userLookupError = error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (!user) {
        // If user lookup fails, log but continue with a placeholder user ID
        // The session service will handle missing user gracefully
        logger.warn('User lookup failed after retries, using placeholder', {
          error: userLookupError?.message,
          userId: auth.userId,
        });
        // Use a placeholder ID that won't conflict with real users
        const placeholderUserId = -1;
        // For now, return 503 to avoid corrupting user data
        return {
          data: {
            error: 'Session service unavailable',
            message: 'Database is temporarily unavailable. Please try again.',
          },
          status: 503,
        };
      }

      const count = Math.min(parseInt(validated?.count || '10', 10), 50);
      const system = validated?.system || undefined;
      const mode = (validated?.mode || 'standard') as SessionQuestionRequest['mode'];
      const simulationStrict = validated?.simulationStrict === true;
      const eorMode = validated?.eorMode === true;
      let eorDeadline = validated?.eorDeadline || undefined;
      if (eorMode && !eorDeadline && user?.rotationExamDate) {
        eorDeadline = user.rotationExamDate.toISOString();
      }

      sessionService = new SessionService(env.DATABASE_URL, env);
      const result = await sessionService.getSessionQuestions({
        userId: user.id,
        count,
        system,
        mode,
        simulationStrict,
        eorMode,
        eorDeadline,
      });

      logger.info('Session questions fetched (GET)', {
        userId: auth.userId,
        count: result.questions?.length || 0,
      });

      return { data: result };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const errCode = (error as any).code;
      logger.error('Error fetching session questions', {
        error: errMsg,
        code: errCode,
        stack,
        userId: auth.userId,
      });
      const isDbUnavailable =
        /connection|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|pool/i.test(errMsg);
      return {
        data: {
          error: isDbUnavailable
            ? 'Session service unavailable'
            : 'Failed to fetch session questions',
          message: isDbUnavailable
            ? 'Database is temporarily unavailable. Please try again.'
            : errMsg || 'Please try again later.',
        },
        status: isDbUnavailable ? 503 : 500,
      };
    } finally {
      // Disconnect SessionService's internal Prisma clients first
      if (sessionService) {
        try {
          await sessionService.disconnect();
        } catch {
          // Non-fatal
        }
      }
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);

export const onRequestPost = authenticatedEndpoint(SessionPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/session');
  logger.info('DATABASE_URL present', { hasUrl: !!env.DATABASE_URL, urlPrefix: env.DATABASE_URL ? env.DATABASE_URL.substring(0, 20) : '' });
  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL not configured');
    return {
      data: { error: 'Session service unavailable', message: 'Server database is not configured.' },
      status: 503,
    };
  }
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  let sessionService: SessionService | null = null;

  try {
    // Retry user lookup to handle intermittent Accelerate failures
    let user = null;
    let userLookupError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          user = await prisma.user.findUnique({
            where: { clerkId: auth.userId },
            select: { id: true, rotationExamDate: true },
          });
          break;
      } catch (error) {
        userLookupError = error;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!user) {
      // If user lookup fails, log but continue with a placeholder user ID
      // The session service will handle missing user gracefully
      logger.warn('User lookup failed after retries, using placeholder', {
        error: userLookupError?.message,
        userId: auth.userId,
      });
      // Use a placeholder ID that won't conflict with real users
      const placeholderUserId = -1;
      // For now, return 503 to avoid corrupting user data
      return {
        data: {
          error: 'Session service unavailable',
          message: 'Database is temporarily unavailable. Please try again.',
        },
        status: 503,
      };
    }

    sessionService = new SessionService(env.DATABASE_URL, env);
    const eorDeadline =
      validated.eorDeadline ??
      (validated.eorMode && user?.rotationExamDate ? user.rotationExamDate.toISOString() : undefined);
    const result = await sessionService.getSessionQuestions({
      ...validated,
      userId: user.id,
      count: Math.min(validated.count || 10, 50),
      simulationStrict: validated.simulationStrict === true,
      eorMode: validated.eorMode === true,
      eorDeadline,
    });

    logger.info('Session questions fetched (POST)', {
      userId: auth.userId,
      count: result.questions?.length || 0,
    });

    return { data: result };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('Error fetching session questions', {
      error: errMsg,
      stack,
      userId: auth.userId,
    });
    const isDbUnavailable =
      /connection|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|pool/i.test(errMsg);
    return {
      data: {
        error: isDbUnavailable
          ? 'Session service unavailable'
          : 'Failed to fetch session questions',
        message: isDbUnavailable
          ? 'Database is temporarily unavailable. Please try again.'
          : errMsg || 'Please try again later.',
      },
      status: isDbUnavailable ? 503 : 500,
    };
  } finally {
    if (sessionService) {
      try {
        await sessionService.disconnect();
      } catch {
        // Non-fatal
      }
    }
    await safePrismaDisconnect(prisma);
  }
});
