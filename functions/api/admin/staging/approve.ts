/**
 * POST /api/admin/staging/approve
 * Approve: mirror StagingQuestion -> PreGeneratedQuestion (live pool) and
 * retain the staging row as approved for provenance.
 * Body: { id: string }
 */

import { z } from 'zod';
import { adminEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { promoteToLive } from '../../_shared/staging-questions';
import { auditLog } from '../../_shared/auditLog';

const ApproveBodySchema = z.object({
  body: z.object({
    id: z.string().min(1),
  }),
});

export const onRequestPost = adminEndpoint(ApproveBodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/approve');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const stagingId = validated.body.id;

  try {
    const staging = await prisma.stagingQuestion.findUnique({
      where: { id: stagingId },
    });
    if (!staging) {
      return { status: 404, error: 'Staging question not found' };
    }
    if (staging.status === 'approved') {
      return { status: 400, error: 'Already approved' };
    }

    await promoteToLive(prisma, stagingId, {
      allowPendingHumanReview: staging.status === 'pending',
      reviewedBy: context.auth.userId,
    });

    log.info('Staging approved and mirrored to live pool', { stagingId });
    auditLog('admin_staging_approve', {
      userId: context.auth.userId,
      stagingId,
      system: staging.system,
    });
    return { data: { success: true, message: 'Approved and mirrored to live pool' } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('has not passed adequacy check')) {
      return {
        status: 400,
        error: 'Run adequacy check first or approve a pending question through human review.',
      };
    }
    log.error('Staging approve error', e);
    return { status: 500, error: 'Failed to approve' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
