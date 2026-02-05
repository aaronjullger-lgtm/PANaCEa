/**
 * POST /api/admin/staging/reject
 * Reject: set StagingQuestion status to 'rejected'.
 * Body: { id: string }
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { discardStagingQuestion } from '../../_shared/staging-questions';

const RejectBodySchema = z.object({
  body: z.object({
    id: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminEndpoint(RejectBodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/reject');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const stagingId = validated.body.id;

  try {
    const staging = await prisma.stagingQuestion.findUnique({
      where: { id: stagingId },
    });
    if (!staging) {
      return { status: 404, error: 'Staging question not found' };
    }

    await discardStagingQuestion(prisma, stagingId);
    log.info('Staging rejected', { stagingId });
    return { data: { success: true, message: 'Rejected' } };
  } catch (e) {
    log.error('Staging reject error', e);
    return { status: 500, error: 'Failed to reject' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
