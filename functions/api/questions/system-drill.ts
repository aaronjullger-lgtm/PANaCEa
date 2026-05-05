/**
 * POST /api/questions/system-drill
 *
 * Generate system-specific question for System Drill mode
 * Filters questions by PANCE system code
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';
import {
  buildLegacyStudyModeEndpointMetadata,
  withProductionQuestionSafety,
} from '../../../lib/services/questionServingSafety';

const SystemDrillSchema = z.object({
  body: z.object({
    system: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    subcategory: z.string().optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(SystemDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/system-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, difficulty, subcategory } = validated.body;

    // Compatibility endpoint: keep older callers working, but apply the same
    // production serving gate used by canonical study sessions.
    const where: any = withProductionQuestionSafety({ system });

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    const candidates = await prisma.question.findMany({
      where,
      select: {
        id: true,
        question: true,
        vignette: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        conditionId: true,
        system: true,
        category: true,
        topic: true,
        difficulty: true,
      },
      orderBy: [{ contentHealthScore: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });

    if (candidates.length === 0) {
      logger.info('No questions found for system', {
        system,
        subcategory,
        userId: auth.userId,
      });

      return {
        data: {
          error: 'No questions found for this system',
          system,
          subcategory,
        },
        status: 404,
      };
    }

    const usable = candidates
      .map((question: any) => {
        const opts = normalizeOptions(question.options);
        const correctIdx =
          typeof question.correctAnswer === 'string'
            ? resolveCorrectAnswerIndex(question.correctAnswer, opts)
            : null;

        if (correctIdx === null) {
          logger.warn('Skipping system-drill question with unresolvable correct answer', {
            userId: auth.userId,
            questionId: question.id,
          });
          return null;
        }

        return {
          ...question,
          options: opts,
          rationale: question.explanation,
          correctAnswerIndex: correctIdx,
        };
      })
      .filter(Boolean);

    if (usable.length === 0) {
      logger.error('No production-safe system drill questions were scorable', {
        userId: auth.userId,
        system,
      });
      throw new Error('Question scoring data is incomplete');
    }

    const question = usable[Math.floor(Math.random() * usable.length)];

    logger.info('System drill question retrieved', {
      userId: auth.userId,
      questionId: question.id,
      system: question.system,
    });

    return {
      data: {
        ...question,
        metadata: buildLegacyStudyModeEndpointMetadata({
          replacement: '/api/study/session/generate',
          canonicalRequest: { mode: 'system', system, size: 20, sessionLane: 'drill' },
        }),
      },
    };
  } catch (error) {
    logger.error('Error generating system drill question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate system drill question');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((option) => String(option ?? '').trim()).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((option) => String(option ?? '').trim())
      .filter(Boolean);
  }
  return [];
}
