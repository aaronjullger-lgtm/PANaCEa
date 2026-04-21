/**
 * Cloudflare Function: Get Contrastive Drill Batch
 *
 * Returns a batch of DDx comparison questions from ContrastiveSet table
 *
 * Endpoint: GET /api/drills/contrastive-batch
 * Query Params:
 * - system: Optional organ system filter
 * - difficulty: Optional difficulty filter
 * - count: Number of questions (default 10, max 50)
 * - personalized: Use user's confusion pairs (default false)
 *
 * Migrated from /api/drill/contrastive-batch to consolidate all drill
 * endpoints under /api/drills/. Uses authenticatedEndpoint: adds rate
 * limiting (300/min), CORS, structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getContrastiveDrillBatch } from '../../../services/drill/contrastiveDrill.service';

const ContrastiveBatchSchema = z.object({
  query: z
    .object({
      system: z.string().optional(),
      difficulty: z.string().optional(),
      count: z.coerce.number().int().min(1).max(50).optional().default(10),
      personalized: z.enum(['true', 'false']).optional().default('false'),
    })
    .optional(),
});

export const onRequestGet = authenticatedEndpoint(
  ContrastiveBatchSchema,
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const system = url.searchParams.get('system') || undefined;
      const difficulty = url.searchParams.get('difficulty') || undefined;
      const count = Math.min(parseInt(url.searchParams.get('count') || '10', 10), 50);
      const personalized = url.searchParams.get('personalized') === 'true';

      const questions = await getContrastiveDrillBatch({
        prisma,
        userId: personalized ? auth.userId : undefined,
        system,
        difficulty: difficulty as any,
        count,
      });

      return { data: questions };
    } catch (error) {
      console.error('Error fetching contrastive drill batch:', error);
      return { status: 500, error: 'Failed to fetch contrastive drill batch' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
