/**
 * POST /api/questions/pharmacology-drill
 * Generate pharmacology question for Pharmacology Drill mode
 * Filters questions by topic='Pharmacology' or drugClass
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

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
    const where: Record<string, unknown> = {
      OR: [
        { topic: 'Pharmacology' },
        { topic: 'Pharmacotherapy' },
        { tags: { hasSome: ['pharmacology', 'medications', 'drugs'] } },
      ],
    };

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

    // Get total count for random selection
    const totalCount = await prisma.question.count({ where });

    if (totalCount === 0) {
      logger.info('No pharmacology questions found', { drugClass, userId: auth.userId });

      return {
        data: {
          error: 'No pharmacology questions found',
          drugClass,
        },
        status: 404,
      };
    }

    // Select random question using skip
    const randomSkip = Math.floor(Math.random() * totalCount);

    const question = await prisma.question.findFirst({
      where,
      skip: randomSkip,
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
    });

    if (!question) {
      logger.error('Failed to retrieve pharmacology question', { userId: auth.userId });
      throw new Error('Failed to retrieve pharmacology question');
    }

    // Derive correctAnswerIndex from options + correctAnswer for client compatibility
    const opts = Array.isArray(question.options) ? question.options : [];
    const correctIdx =
      typeof question.correctAnswer === 'string'
        ? opts.findIndex((o: unknown) => String(o) === question.correctAnswer)
        : -1;

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
        correctAnswerIndex: Math.max(0, correctIdx),
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
