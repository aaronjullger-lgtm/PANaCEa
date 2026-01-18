/**
 * Grand Rounds System Challenge API
 * Database-first high-yield question fetching for specific organ systems
 *
 * @security authenticatedEndpoint - Requires authentication
 * @pattern Middleware Pattern (Sprint 4)
 */

import { z } from 'zod';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  authenticatedEndpoint,
  withCors,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import { logger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const GrandRoundsSystemSchema = z.object({
  params: z.object({
    system: z
      .string()
      .min(1, 'System parameter is required')
      .max(50, 'System name too long'),
  }),
});

type GrandRoundsSystemInput = z.infer<typeof GrandRoundsSystemSchema>;

// ============================================================================
// API HANDLER
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  GrandRoundsSystemSchema,
  async (
    context: AuthenticatedContext & ValidatedContext<GrandRoundsSystemInput>
  ) => {
    const { env, auth, params } = context;

    // Extract system from path params
    const url = new URL(context.request.url);
    const system = params?.system || url.pathname.split('/').pop();

    if (!system || system === 'system') {
      return { status: 400, error: 'System parameter required' };
    }

    const prisma = createEdgePrismaClient(env);

    try {
      // Check if user completed this system today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const completedToday = await prisma.grandRoundsAttempt.findFirst({
        where: {
          userId: auth.userId,
          system,
          createdAt: { gte: today },
        },
      });

      if (completedToday) {
        logger.info('Grand Rounds already completed today', {
          userId: auth.userId,
          system,
          score: completedToday.score,
        });

        return {
          data: {
            status: 'completed',
            stats: {
              score: completedToday.score,
              correctCount: completedToday.correctAnswers,
              totalQuestions: completedToday.totalQuestions,
              timeSpentMs: completedToday.timeSpentMs,
              percentile: completedToday.percentile || 50,
              ranking: completedToday.globalRank || 1,
            },
          },
        };
      }

      // Fetch 10 high-yield questions from MedicalContent for this system
      const questions = await prisma.medicalContent.findMany({
        where: {
          system,
          publishStatus: 'published',
          isHighYield: true,
        },
        take: 10,
        orderBy: {
          updatedAt: 'desc', // Most recently updated high-yield content
        },
        select: {
          id: true,
          condition: true,
          system: true,
          content: true,
          clinical_pearls: true,
          gold_standard_dx: true,
        },
      });

      if (questions.length === 0) {
        return {
          status: 404,
          error: 'No questions available for this system',
        };
      }

      // Transform MedicalContent into Question format
      const formattedQuestions = questions.map((q) => {
        const content = (q.content as any) || {};
        const options = content.questionOptions || [
          q.gold_standard_dx || q.condition,
          ...(content.differentials || ['Option B', 'Option C', 'Option D']).slice(0, 3),
        ];

        return {
          id: q.id,
          question:
            content.clinicalScenario ||
            `A patient presents with ${q.condition}. What is the most likely diagnosis?`,
          options: options.slice(0, 4),
          correctIndex: 0, // Correct answer is always first (shuffle on client if needed)
          condition: q.condition,
          topic: q.system,
          system: q.system,
          category: 'Formulating Diagnosis',
          difficulty: 'board',
          rationale: content.rationale || q.clinical_pearls?.[0] || 'Clinical reasoning',
          boardRelevance: 'high_yield',
          mediaType: null,
          mediaUrl: null,
        };
      });

      const challengeId = `${system}-${today.toISOString().split('T')[0]}-${auth.userId}`;

      logger.info('Grand Rounds challenge started', {
        userId: auth.userId,
        system,
        questionCount: formattedQuestions.length,
        challengeId,
      });

      return {
        data: {
          status: 'active',
          challengeId,
          questions: formattedQuestions,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);