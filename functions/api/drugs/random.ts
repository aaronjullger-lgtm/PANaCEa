/**
 * Random Drugs API
 * GET /api/drugs/random?count=10
 *
 * Public endpoint for random drug flashcards/quizzes
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const RandomDrugsSchema = z.object({
  count: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  RandomDrugsSchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/drugs/random');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      const count = Math.min(validated.count || 10, 50); // Cap at 50

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Use raw SQL for random selection for better performance
      const drugs = await prisma.$queryRaw`SELECT * FROM "Drug" ORDER BY RANDOM() LIMIT ${count}`;

      logger.info('Random drugs fetched', {
        requestedCount: validated.count,
        actualCount: Array.isArray(drugs) ? drugs.length : 0,
      });

      return { data: drugs };
    } catch (error) {
      logger.error('Random drugs error', {
        error: error instanceof Error ? error.message : String(error),
        count: validated.count,
      });
      throw new Error('Failed to fetch random drugs');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
