/**
 * Drug Library API
 * GET /api/drugs?limit=50&cursor=abc123&search=beta
 *
 * Public endpoint for browsing drug library with keyset pagination
 * Optimized for Prisma Accelerate with cacheStrategy
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Schema with keyset pagination (cursor instead of offset)
const DrugLibrarySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(Number(val), 100) : 50)),
  cursor: z.string().optional(), // Last drug ID for keyset pagination
  search: z.string().max(200).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  DrugLibrarySchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/drugs');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      const { limit, cursor, search } = validated;

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

      // Keyset pagination query with Accelerate cacheStrategy
      const drugs = await prisma.drug.findMany({
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
        },
        orderBy: { genericName: 'asc' },
        take: limit + 1, // Fetch one extra to determine hasMore
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1, // Skip the cursor item itself
        }),
      });

      // Determine if there are more results
      const hasMore = drugs.length > limit;
      const resultDrugs = hasMore ? drugs.slice(0, limit) : drugs;
      const nextCursor = hasMore ? resultDrugs[resultDrugs.length - 1]?.id : null;

      // Get total count with caching (separate query for count)
      const total = await prisma.drug.count({
        where,
      });

      logger.info('Drug library fetched', {
        search: search?.substring(0, 50),
        limit,
        cursor: cursor?.substring(0, 10),
        total,
        returned: resultDrugs.length,
      });

      return {
        data: {
          drugs: resultDrugs,
          pagination: {
            total,
            limit,
            cursor: nextCursor,
            hasMore,
          },
        },
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        },
      };
    } catch (error) {
      logger.error('Drug library error', {
        error: error instanceof Error ? error.message : String(error),
        search: validated.search?.substring(0, 50),
        limit: validated.limit,
        cursor: validated.cursor?.substring(0, 10),
      });
      throw new Error('Failed to fetch drugs');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
