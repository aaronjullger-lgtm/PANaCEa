/**
 * Custom Study Session API Endpoint
 * POST /api/questions/custom-session
 * Fetches questions matching custom filters for ephemeral study sessions.
 * No FSRS tracking - questions are returned without modifying user progress.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const CustomSessionSchema = z.object({
  body: z.object({
    config: z.object({
      systems: z.array(z.string()).optional(),
      subcategories: z.array(z.string()).optional(),
      conditions: z.array(z.string()).optional(),
      focusAreas: z.array(z.string()).optional(),
      difficulty: z.enum(['same', 'easier', 'harder']).optional(),
    }),
    count: z.number().int().min(1).max(50).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(CustomSessionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/custom-session');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { config, count } = validated.body;
    const requestedCount = Math.min(count || 10, 50);
    const userId = auth.userId || 'anonymous';

    // Build query filters
    const whereConditions: any[] = [];

    // Filter by systems
    if (config.systems.length > 0) {
      whereConditions.push({
        system: { in: config.systems },
      });
    }

    // Filter by subcategories (if specified)
    if (config.subcategories && config.subcategories.length > 0) {
      whereConditions.push({
        subcategory: { in: config.subcategories },
      });
    }

    // Filter by specific conditions (if specified)
    if (config.conditions && config.conditions.length > 0) {
      whereConditions.push({
        conditionId: { in: config.conditions },
      });
    }

    // Only fetch approved questions
    whereConditions.push({
      status: 'approved',
    });

    // Fetch questions from pool
    const poolQuestions = await prisma.questionPool.findMany({
      where: {
        AND: whereConditions,
      },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswerIndex: true,
        rationale: true,
        topic: true,
        system: true,
        subcategory: true,
        conditionId: true,
        condition: true,
        pearls: true,
        difficulty: true,
        focusArea: true,
        metadata: true,
      },
      take: requestedCount * 3,
    });

    // Apply focus area filtering if specified
    let filteredQuestions = poolQuestions;
    if (config.focusAreas && config.focusAreas.length > 0) {
      filteredQuestions = poolQuestions.filter(
        (q) => !q.focusArea || config.focusAreas.includes(q.focusArea)
      );
    }

    // Apply difficulty weighting
    let weightedQuestions = filteredQuestions;
    if (config.difficulty && config.difficulty !== 'same') {
      weightedQuestions = filteredQuestions.sort((a, b) => {
        const aDiff = a.difficulty || 50;
        const bDiff = b.difficulty || 50;

        if (config.difficulty === 'easier') {
          return aDiff - bDiff;
        } else {
          return bDiff - aDiff;
        }
      });
    }

    // Shuffle and select requested count
    const shuffled = shuffleArray(weightedQuestions);
    const selectedQuestions = shuffled.slice(0, requestedCount);

    // Transform to Question format expected by client
    const questions = selectedQuestions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options as string[],
      correctAnswerIndex: q.correctAnswerIndex,
      rationale: q.rationale || '',
      topic: q.topic || q.system,
      system: q.system,
      subcategory: q.subcategory,
      conditionId: q.conditionId,
      condition: q.condition || 'Unknown',
      pearls: (q.pearls as string[]) || [],
      focusArea: q.focusArea,
      difficulty: q.difficulty,
    }));

    // Calculate total available
    const totalAvailable = await prisma.questionPool.count({
      where: {
        AND: whereConditions,
      },
    });

    // Generate warning if not enough questions
    let warning: string | undefined;
    if (questions.length < requestedCount) {
      warning = `Only ${questions.length} questions available matching your filters. Consider broadening your selection.`;
    }

    logger.info('Custom session questions fetched', { userId, count: questions.length, systems: config.systems });

    return {
      data: {
        questions,
        totalAvailable,
        warning,
      },
    };
  } catch (error) {
    logger.error('Error fetching custom session questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId || 'anonymous',
    });
    throw new Error('Failed to fetch custom session questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
