/**
 * GET/POST /api/questions/session
 * Fetch questions for a study session with NCCPA blueprint weighting
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import {
  SessionService,
  type SessionQuestionRequest,
} from '../../../lib/services/session/sessionService';
import { inferLearnerPhase } from '../../../lib/nccpa-question-weighting';

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
  /** Sprint 3: session lane — 'main' (blueprint-enforced) | 'eor' (rotation-specific) */
  sessionLane: z.enum(['main', 'eor', 'drill']).optional(),
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
  /** Sprint 3: session lane — 'main' (blueprint-enforced) | 'eor' (rotation-specific) */
  sessionLane: z.enum(['main', 'eor', 'drill']).optional(),
});

export const onRequestGet = authenticatedEndpoint(
  SessionGetSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/session');
    const userSelect = {
      id: true,
      rotationExamDate: true,
      currentRotation: true,
      eorTestDate: true,
      rotationEndDate: true,
      examDate: true,
      yearInProgram: true,
      trainingPhase: true,
    } as const;
    logger.info('DATABASE_URL configured', { hasUrl: !!env.DATABASE_URL });
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
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, userSelect);

      const count = Math.min(parseInt(validated?.count || '10', 10), 50);
      const system = validated?.system || undefined;
      const mode = (validated?.mode || 'standard') as SessionQuestionRequest['mode'];
      const simulationStrict = validated?.simulationStrict === true;
      const eorMode = validated?.eorMode === true;
      let eorDeadline = validated?.eorDeadline || undefined;
      if (eorMode && !eorDeadline && user?.rotationExamDate) {
        eorDeadline = user.rotationExamDate.toISOString();
      }

      // Sprint 3: Derive sessionLane from request params.
      // EOR mode → 'eor' lane (rotation-specific, separate from main stats).
      // simulationStrict or no system filter → 'main' lane (blueprint-enforced).
      // Explicit system filter without EOR → legacy behavior (drill lane).
      const sessionLane: 'main' | 'eor' | 'drill' | undefined =
        validated?.sessionLane ??
        (eorMode ? 'eor' : (system && !simulationStrict ? undefined : 'main'));

      sessionService = new SessionService(env.DATABASE_URL, env);
      const learnerPhase = inferLearnerPhase(user);
      const result = await sessionService.getSessionQuestions({
        userId: user.id,
        count,
        system,
        mode,
        simulationStrict,
        eorMode,
        eorDeadline,
        learnerPhase,
        sessionLane,
      });

      logger.info('Session questions fetched (GET)', {
        userId: auth.userId,
        count: result.questions?.length || 0,
        requestedCount: count,
        simulationStrict,
      });

      const emptyState =
        result.questions.length === 0
          ? {
              code: simulationStrict ? 'SIMULATION_EMPTY' : 'SESSION_EMPTY',
              message: simulationStrict
                ? 'No eligible questions are currently available for a strict simulation. Please try again shortly.'
                : 'No questions matched this session configuration. Try a broader focus or try again later.',
            }
          : undefined;

      if (emptyState) {
        logger.warn('Session request returned no questions', {
          userId: auth.userId,
          code: emptyState.code,
          requestedCount: count,
          simulationStrict,
          sessionLane,
        });
      }

      return { data: emptyState ? { ...result, emptyState } : result };
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
        /connect|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|accelerate|pool/i.test(errMsg);
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
  const userSelect = {
    id: true,
    rotationExamDate: true,
    currentRotation: true,
    eorTestDate: true,
    rotationEndDate: true,
    examDate: true,
    yearInProgram: true,
    trainingPhase: true,
  } as const;
  logger.info('DATABASE_URL configured', { hasUrl: !!env.DATABASE_URL });
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
    const user = await resolveOrCreateUserRecord(prisma, auth.userId, userSelect);

    sessionService = new SessionService(env.DATABASE_URL, env);
    const learnerPhasePost = inferLearnerPhase(user);
    const eorDeadline =
      validated.eorDeadline ??
      (validated.eorMode && user?.rotationExamDate ? user.rotationExamDate.toISOString() : undefined);

    // Sprint 3: Derive sessionLane for POST handler
    const postEorMode = validated.eorMode === true;
    const postSystem = validated.system;
    const postSimStrict = validated.simulationStrict === true;
    const postSessionLane: 'main' | 'eor' | 'drill' | undefined =
      validated.sessionLane ??
      (postEorMode ? 'eor' : (postSystem && !postSimStrict ? undefined : 'main'));

    const result = await sessionService.getSessionQuestions({
      ...validated,
      userId: user.id,
      count: Math.min(validated.count || 10, 50),
      simulationStrict: postSimStrict,
      eorMode: postEorMode,
      eorDeadline,
      learnerPhase: learnerPhasePost,
      sessionLane: postSessionLane,
    });

    logger.info('Session questions fetched (POST)', {
      userId: auth.userId,
      count: result.questions?.length || 0,
      requestedCount: Math.min(validated.count || 10, 50),
      simulationStrict: postSimStrict,
    });

    const emptyState =
      result.questions.length === 0
        ? {
            code: postSimStrict ? 'SIMULATION_EMPTY' : 'SESSION_EMPTY',
            message: postSimStrict
              ? 'No eligible questions are currently available for a strict simulation. Please try again shortly.'
              : 'No questions matched this session configuration. Try a broader focus or try again later.',
          }
        : undefined;

    if (emptyState) {
      logger.warn('Session request returned no questions', {
        userId: auth.userId,
        code: emptyState.code,
        requestedCount: Math.min(validated.count || 10, 50),
        simulationStrict: postSimStrict,
        sessionLane: postSessionLane,
      });
    }

    return { data: emptyState ? { ...result, emptyState } : result };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('Error fetching session questions', {
      error: errMsg,
      stack,
      userId: auth.userId,
    });
    const isDbUnavailable =
      /connect|ECONNREFUSED|timeout|database.*unavailable|P1001|P1017|accelerate|pool/i.test(errMsg);
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
