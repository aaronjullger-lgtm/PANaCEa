/**
 * GET /api/content/all
 *
 * Returns a SUMMARY list of all conditions for dashboard/search.
 * Only returns essential fields to stay under 5MB Prisma Accelerate limit.
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Empty schema but still needs source: 'query' for GET requests
const AllContentSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  AllContentSchema,
  async (context) => {
    const { env } = context;
    const logger = createEndpointLogger('/api/content/all');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const allContent = await prisma.medicalContent.findMany({
        where: { status: 'published' },
        select: {
          conditionId: true,
          condition: true,
          system: true,
          subcategory: true,
          canonicalName: true,
          buzzwords: true,
          overview: true,
          pance_yield: true,
          classic_patient: true,
        },
        orderBy: { conditionId: 'asc' },
        take: 3000,
      });

      if (!allContent || allContent.length === 0) {
        logger.warn('No published medical content found');
        return { data: {}, headers: { 'Cache-Control': 'public, max-age=3600' } };
      }

      const contentMap: Record<string, any> = {};
      for (const item of allContent) {
        contentMap[item.conditionId] = {
          conditionId: item.conditionId,
          condition: item.condition,
          system: item.system,
          subcategory: item.subcategory,
          canonicalName: item.canonicalName,
          buzzwords:
            item.buzzwords && (item.buzzwords as any[]).length > 0 ? item.buzzwords : undefined,
          overview: item.overview,
          classic_patient: item.classic_patient,
          pance_yield: item.pance_yield,
          _isSummary: true,
        };
      }

      logger.info('Returned content summary', { count: Object.keys(contentMap).length });
      return { data: contentMap, headers: { 'Cache-Control': 'public, max-age=3600' } };
    } catch (error) {
      logger.error('Error fetching all content', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch content');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
