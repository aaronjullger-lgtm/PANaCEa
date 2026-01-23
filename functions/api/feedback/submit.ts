/**
 * Feedback Submission Endpoint
 * POST /api/feedback/submit
 *
 * Allows authenticated users to submit feedback about questions
 *
 * Security: authenticatedEndpoint with Zod validation
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const FeedbackSubmitSchema = z.object({
  body: z.object({
    questionId: z.string().min(1),
    flagType: z.enum(['incorrect_fact', 'unclear_question', 'typo', 'outdated', 'other']),
    description: z.string().min(1).max(2000),
    questionText: z.string().optional(),
    topic: z.string().optional(),
    system: z.string().optional(),
  }),
});

// ============================================================================
// OPTIONS HANDLER
// ============================================================================

export const onRequestOptions = withCors();

// ============================================================================
// POST HANDLER
// ============================================================================

export const onRequestPost = authenticatedEndpoint(
  FeedbackSubmitSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/feedback/submit', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const { questionId, flagType, description, questionText, topic, system } = validated.body;

      const feedback = await prisma.feedback.create({
        data: {
          userId: auth.userId,
          questionId,
          type: flagType,
          description,
          status: 'new',
          priority: flagType === 'incorrect_fact' ? 'high' : 'medium',
          context: {
            questionText,
            topic,
            system,
          },
        },
      });

      log.info('Feedback submitted successfully', { feedbackId: feedback.id });

      return {
        status: 201,
        data: { success: true, feedbackId: feedback.id },
      };
    } catch (error) {
      log.error('Error submitting feedback', error);
      return {
        status: 500,
        error: 'Feedback submission failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
