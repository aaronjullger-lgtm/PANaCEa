/**
 * POST /api/questions/pharmacology-drill
 * Generate pharmacology question for Pharmacology Drill mode
 * Filters questions by topic='Pharmacology' or drugClass
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

// Zod schema for pharmacology drill request
const PharmacologyDrillSchema = z.object({
  body: z.object({
    drugClass: z.string().max(100).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
});

export const onRequestPost = authenticatedEndpoint(PharmacologyDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/pharmacology-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { drugClass, difficulty } = validated.body;

    // Build where clause for pharmacology questions
    // Question schema: topic, tags, relatedDrugs, explanation (not rationale)
    const where: Record<string, unknown> = withProductionQuestionSafety({
      OR: [
        { topic: 'Pharmacology' },
        { topic: 'Pharmacotherapy' },
        { tags: { hasSome: ['pharmacology', 'medications', 'drugs'] } },
      ],
    });

    if (drugClass) {
      const drugLower = drugClass.toLowerCase();
      (where as any).AND = [
        {
          OR: [
            { relatedDrugs: { hasSome: [drugClass] } },
            { tags: { has: drugLower } },
            { question: { contains: drugClass, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    const candidates = await prisma.question.findMany({
      where,
      select: {
        id: true,
        vignette: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        system: true,
        tags: true,
        difficulty: true,
        category: true,
        topic: true,
        conditionId: true,
        relatedDrugs: true,
        Condition: {
          select: { name: true, subcategory: true },
        },
      },
      orderBy: [{ contentHealthScore: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });

    if (candidates.length === 0) {
      logger.info('No pharmacology questions found', { drugClass, userId: auth.userId });

      return {
        data: {
          error: 'No pharmacology questions found',
          drugClass,
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
          logger.warn('Skipping pharmacology question with unresolvable correct answer', {
            userId: auth.userId,
            questionId: question.id,
          });
          return null;
        }

        return {
          ...question,
          options: opts,
          correctAnswerIndex: correctIdx,
        };
      })
      .filter(Boolean);

    if (usable.length === 0) {
      logger.error('No production-safe pharmacology questions were scorable', {
        userId: auth.userId,
        drugClass,
      });
      throw new Error('Question scoring data is incomplete');
    }

    const question = usable[Math.floor(Math.random() * usable.length)];

    logger.info('Pharmacology question retrieved', {
      userId: auth.userId,
      questionId: question.id,
      topic: question.topic,
    });

    return {
      data: {
        ...question,
        rationale: question.explanation,
        condition: question.Condition?.name ?? null,
        subcategory: question.Condition?.subcategory ?? question.category,
        metadata: buildLegacyStudyModeEndpointMetadata({
          replacement: '/api/study/session/generate',
          note:
            'Pharmacology is retained as a compatibility route while the production mode stays gated behind readiness.',
        }),
      },
    };
  } catch (error) {
    logger.error('Error generating pharmacology question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate pharmacology question');
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
