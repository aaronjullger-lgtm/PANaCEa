/**
 * API Endpoint: /api/questions
 *
 * Fetch questions for drill modes from the database
 * Uses tags array to filter by category (ventilator, physiology, anatomy)
 *
 * Sprint 3 Security: Updated to use secure middleware pattern
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from './_shared/prisma-edge';
import { authenticatedEndpoint } from './_shared/middleware';
import { createEndpointLogger } from './_shared/secureLogger';
import { withProductionQuestionSafety } from '../../lib/services/questionServingSafety';

// ============================================================================
// SCHEMAS
// ============================================================================

const GetQuestionsSchema = z.object({
  category: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/questions
 * Fetch questions filtered by category and optional difficulty
 */
export const onRequestGet = authenticatedEndpoint(GetQuestionsSchema, async (context) => {
  const log = createEndpointLogger('GET /api/questions', context.auth.userId);
  let prisma: EdgePrismaClient | null = null;
  const { category, difficulty, limit } = context.validated;

  try {
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Build where clause
    // For drill questions, we use tags to filter by category
    const where: any = withProductionQuestionSafety({
      tags: {
        array_contains: category,
      },
    });

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: {
        createdAt: 'desc',
      },
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
      },
    });

    log.info('Questions fetched', {
      category,
      difficulty,
      count: questions.length,
    });

    return {
      data: { questions },
    };
  } catch (error) {
    log.error('Error fetching questions', error);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { source: 'query', requestsPerMinute: 120 });

/**
 * OPTIONS handler for CORS preflight
 */
