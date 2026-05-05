/**
 * POST /api/admin/staging/run-critic
 * Run Critic on pending staging questions and apply automation:
 * score > 90 plus structural validation → mirror to PreGeneratedQuestion and
 * retain approved staging provenance; < 70 → mark rejected; 70–90 → flag for
 * human review.
 */

import { z } from 'zod';
import { adminEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { processStagingQueueWithCritic } from '../../_shared/stagingExports';
import { auditLog } from '../../_shared/auditLog';

const BodySchema = z.object({
  body: z
    .object({ limit: z.number().int().min(1).max(50).optional().default(10) })
    .optional()
    .default({ limit: 10 }),
});

export const onRequestPost = adminEndpoint(BodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/run-critic');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const limit = validated?.body?.limit ?? 10;

  try {
    const results = await processStagingQueueWithCritic(prisma, env, limit);
    log.info('Critic run completed', { processed: results.length, results });
    auditLog('admin_staging_run_critic', {
      userId: context.auth.userId,
      processed: results.length,
      limit,
    });
    return { data: { success: true, processed: results.length, results } };
  } catch (e) {
    log.error('Run critic error', e);
    return { status: 500, error: 'Failed to run critic' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
