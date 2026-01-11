/**
 * GET /api/content/library
 * 
 * Fetch filtered library content for Clinical Library browser
 * Supports filtering by system, subcategory, and search
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';
import { CloudflareContext } from '../_shared/types';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: CloudflareContext) => {

  // Authenticate user
  const env = context.env as any;
  const authResult = await authenticateRequest(context.request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system');
    const subcategory = url.searchParams.get('subcategory');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (search && search.trim()) {
      // Full-text search across condition, overview, symptoms
      where.OR = [
        { condition: { contains: search, mode: 'insensitive' } },
        { overview: { contains: search, mode: 'insensitive' } },
        { classic_patient: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch content with pagination
    const [content, total] = await Promise.all([
      prisma.medicalContent.findMany({
        where,
        select: {
          id: true,
          condition: true,
          conditionId: true,
          system: true,
          subcategory: true,
          symptoms: true,
          buzzwords: true,
          clinical_pearls: true,
          classic_patient: true,
          pance_yield: true,
        },
        orderBy: [
          { pance_yield: 'desc' },
          { system: 'asc' },
          { condition: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.medicalContent.count({ where }),
    ]);

    return new Response(
      JSON.stringify({
        content,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + content.length < total,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    // Enhanced error logging for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      prismaCode: (error as any)?.code,
      prismaClientVersion: (error as any)?.clientVersion,
    };
    console.error('[library] Error fetching content:', JSON.stringify(errorDetails, null, 2));
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch library content',
        details: errorDetails.message,
        code: errorDetails.prismaCode,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
