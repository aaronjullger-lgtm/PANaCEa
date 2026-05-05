/**
 * Custom Study Session API Endpoint
 * POST /api/questions/custom-session
 * Fetches questions matching custom filters for ephemeral study sessions.
 * No FSRS tracking - questions are returned without modifying user progress.
 */

import { z } from 'zod';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { withProductionQuestionSafety } from '../../../lib/services/questionServingSafety';

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
    if (config.systems && config.systems.length > 0) {
      whereConditions.push({
        system: { in: config.systems },
      });
    }

    // Filter by category (Question model has category, not subcategory)
    if (config.subcategories && config.subcategories.length > 0) {
      whereConditions.push({
        category: { in: config.subcategories },
      });
    }

    // Filter by specific conditions (if specified)
    if (config.conditions && config.conditions.length > 0) {
      whereConditions.push({
        conditionId: { in: config.conditions },
      });
    }

    const whereClause = withProductionQuestionSafety(
      whereConditions.length > 0 ? { AND: whereConditions } : {}
    );
    const poolQuestions = await prisma.question.findMany({
      where: whereClause,
      select: {
        id: true,
        question: true,
        vignette: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        topic: true,
        system: true,
        category: true,
        conditionId: true,
        difficulty: true,
      },
      take: requestedCount * 3,
    });

    type PoolQuestion = (typeof poolQuestions)[0];

    // Apply difficulty weighting if specified
    let weightedQuestions = poolQuestions;
    if (config.difficulty && config.difficulty !== 'same') {
      const difficultyMode = config.difficulty;
      weightedQuestions = [...poolQuestions].sort((a, b) => {
        const aDiff = Number(a.difficulty) || 50;
        const bDiff = Number(b.difficulty) || 50;
        if (difficultyMode === 'easier') return aDiff - bDiff;
        return bDiff - aDiff;
      });
    }

    const shuffled = shuffleArray(weightedQuestions);
    const selectedQuestions = shuffled.slice(0, requestedCount);

    const optionsArr = (opts: unknown): string[] => (Array.isArray(opts) ? (opts as string[]) : []);

    const questions = selectedQuestions
      .map((q) => {
        const opts = optionsArr(q.options);
        if (opts.length === 0) {
          logger.warn('Skipping custom-session question with no options', { id: q.id });
          return null;
        }
        if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) {
          logger.warn('Skipping custom-session question with missing correctAnswer', {
            id: q.id,
          });
          return null;
        }
        const correctIdx = resolveCorrectAnswerIndex(q.correctAnswer, opts);
        if (correctIdx === null) {
          logger.warn(
            'Skipping custom-session question — correctAnswer does not resolve to any option',
            { id: q.id, correctAnswer: q.correctAnswer },
          );
          return null;
        }
        return {
          id: q.id,
          question: q.question,
          options: opts,
          correctAnswerIndex: correctIdx,
          rationale: q.explanation ?? '',
          topic: q.topic ?? q.system,
          system: q.system,
          subcategory: q.category,
          conditionId: q.conditionId,
          condition: 'Unknown',
          pearls: [],
          focusArea: null,
          difficulty: q.difficulty,
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    const totalAvailable = await prisma.question.count({
      where: whereClause,
    });

    // Generate warning if not enough questions
    let warning: string | undefined;
    if (questions.length < requestedCount) {
      warning = `Only ${questions.length} questions available matching your filters. Consider broadening your selection.`;
    }

    logger.info('Custom session questions fetched', {
      userId,
      count: questions.length,
      systems: config.systems,
    });

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
    const temp = shuffled[i];
    const swapVal = shuffled[j];
    if (temp !== undefined && swapVal !== undefined) {
      shuffled[i] = swapVal;
      shuffled[j] = temp;
    }
  }
  return shuffled;
}
