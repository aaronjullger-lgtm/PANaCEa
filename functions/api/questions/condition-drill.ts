/**
 * POST /api/questions/condition-drill
 *
 * Generate filtered questions for Condition Drill mode
 * Supports filtering by system and/or subcategory
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ConditionDrillSchema = z.object({
  body: z.object({
    system: z.string().optional(),
    subcategory: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    count: z.number().int().min(1).max(20).default(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(ConditionDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/condition-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, subcategory, difficulty, count } = validated.body;

    // Build where clause for question query
    const where: any = {
      // Exclude questions without proper structure
      question: { not: null },
      options: { not: null },
      rationale: { not: null },
    };

    // Apply filters if provided
    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Get total count for random selection
    const totalCount = await prisma.question.count({ where });

    if (totalCount === 0) {
      logger.info('No questions found for filters', {
        system,
        subcategory,
        difficulty,
        userId: auth.userId,
      });

      return {
        data: {
          success: false,
          error: 'No questions found for the specified filters',
          filters: { system, subcategory, difficulty },
        },
        status: 404,
      };
    }

    // Fetch multiple random questions
    const questions = [];
    const requestedCount = Math.min(count, totalCount);

    for (let i = 0; i < requestedCount; i++) {
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
          imageUrl: true,
        },
      });

      if (question) {
        questions.push(question);
      }
    }

    if (questions.length === 0) {
      logger.error('Failed to retrieve questions', { userId: auth.userId });
      throw new Error('Failed to retrieve questions');
    }

    logger.info('Condition drill questions retrieved', {
      userId: auth.userId,
      count: questions.length,
      system,
      subcategory,
      difficulty,
    });

    return {
      data: {
        success: true,
        questions,
        totalAvailable: totalCount,
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
