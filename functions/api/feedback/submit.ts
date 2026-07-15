/**
 * Feedback Submission Endpoint
 * POST /api/feedback/submit
 *
 * Allows authenticated users to submit feedback about questions
 *
 * Security: authenticatedEndpoint with Zod validation
 */

import { authenticatedEndpoint } from '../_shared/middleware';
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

// Bounded lengths on every free-text field (all persisted to QuestionFlag) to
// reject oversized/abusive payloads; `.strict()` rejects unknown fields. Legit
// feedback stays well within these limits.
export const FeedbackSubmitSchema = z.object({
  body: z
    .object({
      questionId: z.string().min(1).max(200),
      flagType: z.enum(['incorrect_fact', 'unclear_question', 'typo', 'outdated', 'other']),
      description: z.string().min(1).max(2000),
      questionText: z.string().max(5000).optional(),
      topic: z.string().max(200).optional(),
      system: z.string().max(100).optional(),
    })
    .strict(),
});

// ============================================================================
// OPTIONS HANDLER
// ============================================================================

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

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true, email: true, firstName: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      const { questionId, flagType, description, questionText, topic, system } = validated.body;

      const flag = await prisma.questionFlag.create({
        data: {
          id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.id,
          userEmail: user.email,
          userFirstName: user.firstName,
          questionId,
          questionText: questionText ?? '',
          description,
          flagType,
          status: 'pending',
          priority: flagType === 'incorrect_fact' ? 'high' : 'medium',
          topic: topic ?? null,
          system: system ?? null,
          updatedAt: new Date(),
        },
      });

      log.info('Feedback submitted successfully', { feedbackId: flag.id });

      return {
        status: 201,
        data: { success: true, feedbackId: flag.id },
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
