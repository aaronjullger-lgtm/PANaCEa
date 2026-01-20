/**
 * Drug Library API  
 * GET /api/drugs?limit=50&offset=0&search=beta
 * 
 * Public endpoint for browsing drug library with pagination
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Flattened schema for query params (no nested 'query' wrapper)
const DrugLibrarySchema = z.object({
  limit: z.string().optional().transform(val => val ? Math.min(Number(val), 100) : 50),
  offset: z.string().optional().transform(val => val ? Number(val) : 0),
  search: z.string().max(200).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(DrugLibrarySchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/drugs');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Direct access to validated fields (no longer nested under .query)
    const { limit, offset, search } = validated;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { genericName: { contains: search, mode: 'insensitive' as const } },
            { brandName: { contains: search, mode: 'insensitive' as const } },
            { drugClass: { hasSome: [search] } },
          ],
        }
      : {};

    // Fetch paginated results with limited fields to reduce response size
    const [drugs, total] = await Promise.all([
      prisma.drug.findMany({
        where,
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
          // Exclude large text fields from list view
        },
        orderBy: { genericName: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.drug.count({ where }),
    ]);

    logger.info('Drug library fetched', {
      search: search?.substring(0, 50),
      limit,
      offset,
      total,
      returned: drugs.length,
    });

    return {
      data: {
        drugs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + drugs.length < total,
        },
      },
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    };
  } catch (error) {
    logger.error('Drug library error', {
      error: error instanceof Error ? error.message : String(error),
      search: validated.search?.substring(0, 50),
      limit: validated.limit,
      offset: validated.offset,
    });
    throw new Error('Failed to fetch drugs');
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { source: 'query' });