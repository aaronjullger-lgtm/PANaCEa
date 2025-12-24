/**
 * GET /api/content/library
 * 
 * Fetch filtered library content for Clinical Library browser
 * Supports filtering by system, subcategory, and search
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: any) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  // Authenticate user
  const { user, error: authError } = await authenticateRequest(context);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
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
    const where: any = {
      content_type: 'condition', // Only conditions for library
    };

    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (search && search.trim()) {
      // Full-text search across condition, definition, symptoms
      where.OR = [
        { condition: { contains: search, mode: 'insensitive' } },
        { definition: { contains: search, mode: 'insensitive' } },
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
          definition: true,
          symptoms: true,
          buzzwords: true,
          clinical_pearls: true,
          classic_patient: true,
          pance_yield: true,
          content_type: true,
        },
        orderBy: [
          { system: 'asc' },
          { subcategory: 'asc' },
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
          'Cache-Control': 'public, s-maxage=300', // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('[library] Error fetching content:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch library content',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
