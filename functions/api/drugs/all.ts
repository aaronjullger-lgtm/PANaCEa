/**
 * Drug Library All API
 * GET /api/drugs/all - Fetch all drugs (no pagination)
 *
 * Authenticated endpoint for loading complete drug library
 * Used by data loader for caching all drugs client-side
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Empty schema - no query params needed
const DrugAllSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  DrugAllSchema,
  async (context) => {
    const { env } = context;
    const logger = createEndpointLogger('/api/drugs/all');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Fetch all drugs
      const drugs = await prisma.drug.findMany({
        select: {
          id: true,
          genericName: true,
          brandName: true,
          drugClass: true,
          mechanismOfAction: true,
          indications: true,
          sideEffects: true,
          contraindications: true,
          isHighYield: true,
          interactions: true,
          dosing: true,
          monitoringParams: true,
          clinicalPearls: true,
        },
        orderBy: { genericName: 'asc' },
        take: 2000,
      });

      logger.info('All drugs fetched', { count: drugs.length });

      return {
        data: {
          drugs,
          total: drugs.length,
        },
      };
    } catch (error) {
      logger.error('Error fetching all drugs', error);
      return {
        status: 500,
        error: 'Failed to fetch drugs',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
