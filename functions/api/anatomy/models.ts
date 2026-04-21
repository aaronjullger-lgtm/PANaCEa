/**
 * API: GET /api/anatomy/models
 *
 * Fetch anatomy 3D models with filtering and pagination.
 * Supports filtering by system, status, and high-yield flag.
 *
 * PUBLIC endpoint - anatomy models are educational curriculum content
 */

import { publicEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const AnatomyModelsSchema = z.object({
  query: z.object({
    system: z.string().optional(),
    status: z.string().default('approved'),
    highYield: z.enum(['true', 'false']).optional(),
    limit: z.string().optional(),
    offset: z.string().optional(),
  }),
});

export const onRequestGet = publicEndpoint(AnatomyModelsSchema, async ({ env, validated }) => {
  const log = createEndpointLogger('/api/anatomy/models');
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const { system, status, highYield, limit: limitStr, offset: offsetStr } = validated.query;
    const highYieldOnly = highYield === 'true';
    const limit = Math.min(parseInt(limitStr || '20'), 100);
    const offset = parseInt(offsetStr || '0');

    log.info('Fetching anatomy models', { system, status, highYieldOnly, limit, offset });

    // Build where conditions for raw query
    const upperSystem = system?.toUpperCase();

    // Fetch models with dynamic conditions
    let modelsQuery: any[];
    let totalQuery: any[];

    if (system && highYieldOnly) {
      modelsQuery = await prisma.$queryRaw`
        SELECT 
          id, name, "displayName", description, system, "fileUrl", "thumbnailUrl",
          format, "fileSize", "isCompressed", structures, "clinicalPearls",
          "clinicalRelevance", "cameraPosition", "cameraTarget", "defaultZoom",
          "sourceName", "sourceUrl", license, "isHighYield", "panceYield", status, "createdAt"
        FROM "Anatomy3DModel"
        WHERE status = ${status} AND system = ${upperSystem} AND "isHighYield" = true
        ORDER BY "panceYield" DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalQuery = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Anatomy3DModel" 
        WHERE status = ${status} AND system = ${upperSystem} AND "isHighYield" = true
      `;
    } else if (system) {
      modelsQuery = await prisma.$queryRaw`
        SELECT 
          id, name, "displayName", description, system, "fileUrl", "thumbnailUrl",
          format, "fileSize", "isCompressed", structures, "clinicalPearls",
          "clinicalRelevance", "cameraPosition", "cameraTarget", "defaultZoom",
          "sourceName", "sourceUrl", license, "isHighYield", "panceYield", status, "createdAt"
        FROM "Anatomy3DModel"
        WHERE status = ${status} AND system = ${upperSystem}
        ORDER BY "panceYield" DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalQuery = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Anatomy3DModel" 
        WHERE status = ${status} AND system = ${upperSystem}
      `;
    } else if (highYieldOnly) {
      modelsQuery = await prisma.$queryRaw`
        SELECT 
          id, name, "displayName", description, system, "fileUrl", "thumbnailUrl",
          format, "fileSize", "isCompressed", structures, "clinicalPearls",
          "clinicalRelevance", "cameraPosition", "cameraTarget", "defaultZoom",
          "sourceName", "sourceUrl", license, "isHighYield", "panceYield", status, "createdAt"
        FROM "Anatomy3DModel"
        WHERE status = ${status} AND "isHighYield" = true
        ORDER BY "panceYield" DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalQuery = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Anatomy3DModel" 
        WHERE status = ${status} AND "isHighYield" = true
      `;
    } else {
      modelsQuery = await prisma.$queryRaw`
        SELECT 
          id, name, "displayName", description, system, "fileUrl", "thumbnailUrl",
          format, "fileSize", "isCompressed", structures, "clinicalPearls",
          "clinicalRelevance", "cameraPosition", "cameraTarget", "defaultZoom",
          "sourceName", "sourceUrl", license, "isHighYield", "panceYield", status, "createdAt"
        FROM "Anatomy3DModel"
        WHERE status = ${status}
        ORDER BY "panceYield" DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      totalQuery = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Anatomy3DModel" WHERE status = ${status}
      `;
    }

    // Get available systems for filtering
    const systemCounts = (await prisma.$queryRaw`
      SELECT system, COUNT(*)::int as count
      FROM "Anatomy3DModel"
      WHERE status = 'approved'
      GROUP BY system
      ORDER BY count DESC
    `) as Array<{ system: string; count: number }>;

    const total = (totalQuery as Array<{ count: number }>)[0]?.count || 0;

    log.info('Anatomy models fetched successfully', {
      count: modelsQuery.length,
      total,
    });

    return {
      success: true,
      data: {
        models: modelsQuery,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + modelsQuery.length < total,
        },
        filters: {
          systems: systemCounts,
        },
      },
    };
  } catch (error) {
    log.error('Error fetching anatomy models', error);
    return {
      status: 500,
      error: 'Failed to fetch anatomy models',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
