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
import { authenticatedEndpoint, withCors } from './_shared/middleware';
import { createEndpointLogger } from './_shared/secureLogger';

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

  // Parse query parameters manually since validation happens on body
  const url = new URL(context.request.url);
  const category = url.searchParams.get('category');
  const difficulty = url.searchParams.get('difficulty');
  const limitStr = url.searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  // Validate category is present
  if (!category) {
    log.warn('Missing category parameter');
    return { status: 400, error: 'Category parameter is required' };
  }

  try {
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Build where clause
    // For drill questions, we use tags to filter by category
    const where: any = {
      tags: {
        array_contains: category,
      },
    };

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
});

/**
 * OPTIONS handler for CORS preflight
 */
export const onRequestOptions = withCors();
