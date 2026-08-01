/**
 * Metacognitive reflection API endpoint
 * Stores user reflection data after a study session.
 *
 * Sprint 6: Integration with Main Session Audit Execution Plan.
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from './_shared/prisma-edge';
import { authenticatedEndpoint } from './_shared/middleware';
import { createEndpointLogger } from './_shared/secureLogger';

// ============================================================================
// SCHEMAS
// ============================================================================

const ReflectionSchema = z.object({
  patternsNoticed: z.string().min(1).max(5000),
  improvementPlan: z.string().min(1).max(5000),
  topicsToReview: z.array(z.string()).max(50),
  sessionId: z.string().max(100).optional(),
  // NOTE: No confidenceRating — confidence is derived implicitly from
  // behavioral telemetry (lib/confidence/**). Self-rating is not accepted.
});

const PostReflectionSchema = z.object({
  reflection: ReflectionSchema,
});

// ============================================================================
// HANDLER
// ============================================================================

/**
 * POST /api/reflection
 * Creates or updates a reflection entry for the authenticated user.
 */
export const onRequestPost = authenticatedEndpoint(PostReflectionSchema, async (context) => {
  const log = createEndpointLogger('POST /api/reflection', context.auth.userId);
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  log.info('Creating reflection', { sessionId: context.validated.reflection.sessionId });

  try {
    const { reflection } = context.validated;
    const { userId } = context.auth;

    // Check if a reflection already exists for this session (if sessionId provided)
    const existingReflection = reflection.sessionId
      ? await prisma.reflection.findUnique({
          where: { sessionId: reflection.sessionId },
        })
      : null;

    // Prepare data for Prisma
    const reflectionData = {
      userId,
      sessionId: reflection.sessionId ?? null,
      patternsNoticed: reflection.patternsNoticed,
      improvementPlan: reflection.improvementPlan,
      confidenceRating: 0, // implicit-only: self-rating not accepted
      topicsToReview: reflection.topicsToReview,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    let result;
    if (existingReflection) {
      // Update existing reflection
      result = await prisma.reflection.update({
        where: { id: existingReflection.id },
        data: reflectionData,
      });
      log.info('Updated existing reflection', { reflectionId: result.id });
    } else {
      // Create new reflection
      result = await prisma.reflection.create({
        data: reflectionData,
      });
      log.info('Created new reflection', { reflectionId: result.id });
    }

    return {
      data: {
        success: true,
        message: existingReflection ? 'Reflection updated' : 'Reflection saved',
        reflection: {
          id: result.id,
          completedAt: result.completedAt,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Reflection POST failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { status: 500, error: `Reflection POST failed: ${errorMessage}` };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * OPTIONS handler for CORS preflight
 */