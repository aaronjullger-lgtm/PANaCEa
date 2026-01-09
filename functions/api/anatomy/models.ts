/**
 * API: GET /api/anatomy/models
 * 
 * Fetch anatomy 3D models with filtering and pagination.
 * Supports filtering by system, status, and high-yield flag.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

interface CloudflareEnv {
  DATABASE_URL: string;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

export async function onRequestGet(context: { request: Request; env: CloudflareEnv }): Promise<Response> {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const system = url.searchParams.get('system');
    const status = url.searchParams.get('status') || 'approved';
    const highYieldOnly = url.searchParams.get('highYield') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      status,
    };

    if (system) {
      where.system = system.toUpperCase();
    }

    if (highYieldOnly) {
      where.isHighYield = true;
    }

    // Fetch models
    const [models, total] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          id,
          name,
          "displayName",
          description,
          system,
          "fileUrl",
          "thumbnailUrl",
          format,
          "fileSize",
          "isCompressed",
          structures,
          "clinicalPearls",
          "clinicalRelevance",
          "cameraPosition",
          "cameraTarget",
          "defaultZoom",
          "sourceName",
          "sourceUrl",
          license,
          "isHighYield",
          "panceYield",
          status,
          "createdAt"
        FROM "Anatomy3DModel"
        WHERE status = ${status}
        ${system ? `AND system = ${system.toUpperCase()}` : ''}
        ${highYieldOnly ? `AND "isHighYield" = true` : ''}
        ORDER BY "panceYield" DESC NULLS LAST, name ASC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as any[],
      prisma.$queryRaw`
        SELECT COUNT(*)::int as count 
        FROM "Anatomy3DModel" 
        WHERE status = ${status}
        ${system ? `AND system = ${system.toUpperCase()}` : ''}
        ${highYieldOnly ? `AND "isHighYield" = true` : ''}
      ` as any[],
    ]);

    // Get available systems for filtering
    const systemCounts = await prisma.$queryRaw`
      SELECT system, COUNT(*)::int as count
      FROM "Anatomy3DModel"
      WHERE status = 'approved'
      GROUP BY system
      ORDER BY count DESC
    ` as any[];

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          models,
          pagination: {
            total: total[0]?.count || 0,
            limit,
            offset,
            hasMore: offset + models.length < (total[0]?.count || 0),
          },
          filters: {
            systems: systemCounts,
          },
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error fetching anatomy models:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch anatomy models',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
