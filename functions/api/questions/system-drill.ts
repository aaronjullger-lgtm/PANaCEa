/**
 * POST /api/questions/system-drill
 *
 * Generate system-specific question for System Drill mode
 * Filters questions by PANCE system code
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SystemDrillSchema = z.object({
  body: z.object({
    system: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    subcategory: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SystemDrillSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/system-drill');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, difficulty, subcategory } = validated.body;

    // Build where clause for question query
    // Note: question/options/explanation are required fields — no null checks needed
    const where: any = { system };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    // Get total count for random selection
    const totalCount = await prisma.question.count({ where });

    if (totalCount === 0) {
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

    // Select random question using skip
    const randomSkip = Math.floor(Math.random() * totalCount);

    const question = await prisma.question.findFirst({
      where,
      skip: randomSkip,
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
    });

    if (!question) {
      logger.error('Failed to retrieve question', { userId: auth.userId });
      throw new Error('Failed to retrieve question');
    }

    logger.info('System drill question retrieved', {
      userId: auth.userId,
      questionId: question.id,
      system: question.system,
    });

    // Normalize options: DB stores as {"A":"...", "B":"..."} — convert to array for client
    const rawOpts = question.options;
    const opts: string[] = Array.isArray(rawOpts)
      ? (rawOpts as string[])
      : rawOpts && typeof rawOpts === 'object'
        ? Object.values(rawOpts as Record<string, string>)
        : [];

    // Derive correctAnswerIndex from letter key (A=0, B=1, ...) or string match
    const correctIdx =
      typeof question.correctAnswer === 'string' && /^[A-E]$/.test(question.correctAnswer)
        ? question.correctAnswer.charCodeAt(0) - 65
        : opts.findIndex((o) => o === question.correctAnswer);

    return {
      data: {
        ...question,
        options: opts,
        rationale: question.explanation,
        correctAnswerIndex: Math.max(0, correctIdx),
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
