/**
 * POST /api/questions/pharmacology-drill
 * Generate pharmacology question for Pharmacology Drill mode
 * Filters questions by topic='Pharmacology' or drugClass
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Zod schema for pharmacology drill request
const PharmacologyDrillSchema = z.object({
  body: z.object({
    drugClass: z.string().max(100).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(PharmacologyDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/pharmacology-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { drugClass, difficulty } = validated.body;

    // Build where clause for pharmacology questions
    const where: any = {
      OR: [
        { topic: 'Pharmacology' },
        { topic: 'Pharmacotherapy' },
        // Also include questions tagged with drug classes
        { tags: { hasSome: ['pharmacology', 'medications', 'drugs'] } },
      ],
      // Exclude questions without proper structure
      question: { not: null },
      options: { not: null },
      rationale: { not: null },
    };

    if (drugClass) {
      // Filter by specific drug class if provided
      where.AND = [
        {
          OR: [
            { drugClass },
            { tags: { has: drugClass.toLowerCase() } },
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
        question: true,
        options: true,
        correctAnswerIndex: true,
        rationale: true,
        pearls: true,
        condition: true,
        conditionId: true,
        system: true,
        subcategory: true,
        topic: true,
        difficulty: true,
        panceYield: true,
        drugClass: true,
        mechanism: true,
        imageUrl: true,
      },
    });

    if (!question) {
      logger.error('Failed to retrieve pharmacology question', { userId: auth.userId });
      throw new Error('Failed to retrieve pharmacology question');
    }

    logger.info('Pharmacology question retrieved', {
      userId: auth.userId,
      questionId: question.id,
      drugClass: question.drugClass,
    });

    return {
      data: question,
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
