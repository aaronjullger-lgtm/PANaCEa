/**
 * Drug Search API
 * GET /api/drugs/search?q=metformin
 *
 * Public endpoint for drug reference lookups
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DrugSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(200).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(DrugSearchSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/drugs/search');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const query = validated.query.q;

    if (!query) {
      return { data: [] };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const drugs = await prisma.drug.findMany({
      where: {
        OR: [
          { genericName: { contains: query, mode: 'insensitive' } },
          { brandName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });

    logger.info('Drug search completed', {
      query: query.substring(0, 50),
      resultCount: drugs.length,
    });

    return { data: drugs };
  } catch (error) {
    logger.error('Drug search error', {
      error: error instanceof Error ? error.message : String(error),
      query: validated.query.q?.substring(0, 50),
    });
    throw new Error('Failed to search drugs');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
