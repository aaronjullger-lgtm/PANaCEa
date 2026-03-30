/**
 * Imaging Studies Reference API
 *
 * GET /api/reference/imaging - Fetch imaging studies
 * Query params: modality (optional)
 *
 * Security: authenticatedEndpoint with Zod validation
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const GetImagingSchema = z.object({
  query: z
    .object({
      modality: z.string().optional(),
      bodyRegion: z.string().optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  GetImagingSchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/imaging', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      log.info('Fetching imaging studies', { modality: validated?.query?.modality });

      if (!env.DATABASE_URL) {
        log.error('Database not configured');
        return { status: 500, error: 'Database not configured' };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const modality = validated?.query?.modality;
      const bodyRegion = validated?.query?.bodyRegion;
      const searchQuery = validated?.query?.query;
      const highYield = validated?.query?.highYield === 'true';

      const where: any = {};
      if (modality) where.modality = modality;
      if (bodyRegion) where.bodyRegion = bodyRegion;
      if (highYield) where.isHighYield = true;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { modality: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.imagingStudy.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
      });

      log.info('Imaging studies fetched successfully', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching imaging studies', error);
      return {
        status: 500,
        error: 'Failed to fetch imaging studies',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
