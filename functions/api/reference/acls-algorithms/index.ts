/**
 * ACLS Algorithms Reference API
 *
 * GET /api/reference/acls-algorithms
 * Supports: ?category=Tachycardia&rhythm=VFib&highYield=true&query=pea
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const QuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    rhythm: z.string().optional(),
    query: z.string().max(200).optional(),
    highYield: z.string().optional(),
  }).optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/acls-algorithms', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const rhythm = url.searchParams.get('rhythm');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const where: Record<string, unknown> = {};
      if (category) where.category = category;
      if (rhythm) where.rhythm = { contains: rhythm, mode: 'insensitive' };
      if (highYield === 'true') where.isHighYield = true;
      if (query) {
        where.OR = [
          { algorithmName: { contains: query, mode: 'insensitive' } },
          { rhythm: { contains: query, mode: 'insensitive' } },
          { correctIntervention: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.aCLSAlgorithm.findMany({
        where,
        orderBy: [{ isHighYield: 'desc' }, { algorithmName: 'asc' }, { algorithmStep: 'asc' }],
      });

      log.info('Fetched ACLS algorithms', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching ACLS algorithms', error);
      return { status: 500, error: 'Failed to fetch ACLS algorithms' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
