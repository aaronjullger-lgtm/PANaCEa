/**
 * POST /api/questions/condition-drill
 *
 * Generate filtered questions for Condition Drill mode
 * Supports filtering by system and/or subcategory
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

const ConditionDrillSchema = z.object({
  body: z.object({
    conditionId: z.string().optional(),
    system: z.string().optional(),
    subcategory: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    count: z.number().int().min(1).max(20).default(1),
  }).refine(
    (body) => Boolean(body.conditionId || body.system || body.subcategory),
    'conditionId, system, or subcategory is required'
  ),
});

export const onRequestPost = authenticatedEndpoint(ConditionDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/condition-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { conditionId, system, subcategory, difficulty, count } = validated.body;

    // Compatibility endpoint: direct condition drill now uses the same
    // production serving gate as canonical generated study sessions.
    const where: any = withProductionQuestionSafety({});

    // Apply filters if provided
    if (conditionId) {
      where.conditionId = conditionId;
    }

    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (difficulty) {
      where.difficulty = difficulty;
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
      take: Math.max(count * 5, 25),
    });

    if (candidates.length === 0) {
      logger.info('No questions found for filters', {
        conditionId,
        system,
        subcategory,
        difficulty,
        userId: auth.userId,
      });

      return {
        data: {
          success: false,
          error: 'No questions found for the specified filters',
          filters: { conditionId, system, subcategory, difficulty },
        },
        status: 404,
      };
    }

    const questions = shuffleArray(candidates)
      .map((question: any) => {
        const opts = normalizeOptions(question.options);
        const correctIdx =
          typeof question.correctAnswer === 'string'
            ? resolveCorrectAnswerIndex(question.correctAnswer, opts)
            : null;

        if (correctIdx === null) {
          logger.warn('Skipping condition-drill question with unresolvable correct answer', {
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
      }
      )
      .filter(Boolean)
      .slice(0, count);

    if (questions.length === 0) {
      logger.error('Failed to retrieve questions', { userId: auth.userId });
      throw new Error('Failed to retrieve questions');
    }

    logger.info('Condition drill questions retrieved', {
      userId: auth.userId,
      count: questions.length,
      conditionId,
      system,
      subcategory,
      difficulty,
    });

    return {
      data: {
        success: true,
        questions,
        totalAvailable: candidates.length,
        metadata: buildLegacyStudyModeEndpointMetadata({
          replacement: '/api/study/session/generate',
          canonicalRequest: {
            mode: conditionId ? 'condition' : system ? 'system' : 'adaptive',
            conditionId,
            system,
            subcategory,
            size: Math.max(count, 5),
            sessionLane: 'drill',
          },
        }),
      },
    };
  } catch (error) {
    logger.error('Error generating condition drill questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate condition drill questions');
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

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
