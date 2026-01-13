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

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestGet = async (context: CloudflareContext) => {

  // Authenticate user
  const env = context.env as any;
  const authResult = await authenticateRequest(context.request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system');
    const subcategory = url.searchParams.get('subcategory');
    const search = url.searchParams.get('search');
    const highYield = url.searchParams.get('highYield');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

    // REQUIRE system selection unless searching
    // This prevents loading 2000+ conditions at once
    if ((!system || system === 'all') && !search) {
      return new Response(
        JSON.stringify({
          content: [],
          count: 0,
          message: 'Please select a system to browse conditions',
          requiresSelection: true,
        }),
        {
          status: 200,
          headers: CORS_HEADERS,
        }
      );
    }

    // Build where clause
    const where: any = {};

    // SYSTEM FILTER
    if (system && system !== 'all') {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    // HIGH YIELD FILTER - pance_yield >= 3
    if (highYield === 'true') {
      where.pance_yield = { gte: 3 };
    }

    // Apply search filter
    let searchResults: string[] | undefined;
    if (search && search.trim()) {
      // Use PostgreSQL full-text search for better performance and relevance
      try {
        const ftsResults = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "MedicalContent"
          WHERE search_vector @@ websearch_to_tsquery('english', ${search})
          ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC
        `;
        searchResults = ftsResults.map(r => r.id);
        
        // If full-text search returns results, filter by those IDs
        if (searchResults.length > 0) {
          where.id = { in: searchResults };
        } else {
          // No results from full-text search, return empty result
          where.id = { in: [] };
        }
      } catch (error) {
        // Fallback to LIKE search if full-text search fails
        console.error('Full-text search failed, falling back to LIKE:', error);
        where.OR = [
          { condition: { contains: search, mode: 'insensitive' } },
          { overview: { contains: search, mode: 'insensitive' } },
          { classic_patient: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    // Fetch content with ALL fields needed for detail view
    const content = await prisma.medicalContent.findMany({
      where,
      select: {
        id: true,
        condition: true,
        conditionId: true,
        system: true,
        subcategory: true,
        pance_yield: true,
        // Card preview fields
        classic_patient: true,
        buzzwords: true,
        gold_standard_dx: true,
        first_line_rx: true,
        // Detail panel - Essentials
        epidemiology: true,
        etiology: true,
        riskFactors: true,
        // Detail panel - Pathophysiology
        pathophysiology: true,
        // Detail panel - Clinical Presentation
        symptoms: true,
        physicalExam: true,
        classic_triad: true,
        clinical_pearls: true,
        // Detail panel - Workup & Treatment
        best_initial_test: true,
        diagnostics: true,
        treatment: true,
        complications: true,
        prognosis: true,
        // Additional useful fields
        overview: true,
      },
      orderBy: searchResults
        ? undefined // Keep search ranking order if searching
        : [
            { pance_yield: 'desc' },  // High yield first
            { subcategory: 'asc' },   // Then by subcategory
            { condition: 'asc' },     // Then alphabetical
          ],
    });

    // If we have search results, reorder content by the search ranking
    if (searchResults && searchResults.length > 0) {
      const rankMap = new Map(searchResults.map((id, index) => [id, index]));
      content.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
    }

    return new Response(
      JSON.stringify({
        content,
        count: content.length,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
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
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
