/**
 * POST /api/admin/staging/run-critic
 * Run Critic (Gemini 1.5 Pro) on pending staging questions and apply automation:
 * score > 90 → auto-promote to PreGeneratedQuestion & delete; < 70 → delete; 70–90 → flag for human review.
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { processStagingQueueWithCritic } from '../../_shared/stagingExports';

const BodySchema = z.object({
  body: z
    .object({ limit: z.number().int().min(1).max(50).optional().default(10) })
    .optional()
    .default({ limit: 10 }),
});

export const onRequestOptions = withCors();

export const onRequestPost = adminEndpoint(BodySchema, async (context) => {
  const { env, validated } = context;
  const log = createEndpointLogger('/api/admin/staging/run-critic');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const limit = validated?.body?.limit ?? 10;

  try {
    const results = await processStagingQueueWithCritic(prisma, env, limit);
    log.info('Critic run completed', { processed: results.length, results });
    return { data: { success: true, processed: results.length, results } };
  } catch (e) {
    log.error('Run critic error', e);
    return { status: 500, error: 'Failed to run critic' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
