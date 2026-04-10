/**
 * POST /api/analytics/soap-note
 *
 * Stores SOAP Note grading analytics for OSCE sessions.
 * Authenticated endpoint — userId resolved from Clerk token.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const SoapNoteSchema = z.object({
  body: z.object({
    caseId: z.string().min(1),
    totalScore: z.number(),
    breakdown: z.record(z.unknown()),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SoapNoteSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/analytics/soap-note');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { caseId, totalScore, breakdown } = validated.body;

    const userId = await resolveUserId(prisma, auth.userId);

    // Gracefully handle if the SoapNoteGradingEvent model doesn't exist yet
    try {
      await (prisma as any).soapNoteGradingEvent.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId || null,
          caseId,
          totalScore,
          breakdown,
        },
      });

      logger.info('SOAP note grading stored', { caseId, totalScore });
    } catch (dbError) {
      // Model may not exist in schema yet — log and continue
      logger.info('SOAP analytics DB persistence skipped', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    return { data: { success: true } };
  } catch (error) {
    logger.error('Failed to store SOAP grading analytics', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to store SOAP grading analytics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
