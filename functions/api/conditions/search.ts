// functions/api/conditions/search.ts
// GET endpoint for condition search with fuzzy matching

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/**
 * GET /api/conditions/search?q={query}&system={system}&subcategory={subcategory}
 * Searches conditions by name, aliases, synonyms with fuzzy matching
 * Returns ranked results based on relevance score
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // Authenticate the request
  const authResult = await authenticateRequest(request, env);
  if (!authResult) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Authentication required to search conditions' 
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    const system = url.searchParams.get('system');
    const subcategory = url.searchParams.get('subcategory');
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter "q" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build where clause for filtering
    const where: any = {
      status: 'published',
    };

    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    // Search conditions with case-insensitive matching
    // PostgreSQL full-text search or ILIKE for fuzzy matching
    const conditions = await prisma.condition.findMany({
      where: {
        ...where,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { subcategory: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        status: true,
      },
      take: limit,
    });

    // Get full content for matched conditions to extract aliases/synonyms
    const conditionIds = conditions.map(c => c.id);
    const medicalContent = await prisma.medicalContent.findMany({
      where: {
        conditionId: { in: conditionIds },
      },
      select: {
        conditionId: true,
        synonyms: true,
      },
    });

    // Create a map of conditionId -> synonyms for quick lookup
    const synonymsMap = new Map(
      medicalContent.map(mc => [mc.conditionId, mc.synonyms || []])
    );

    // Score and rank results
    const results = conditions
      .map(condition => {
        const aliases = synonymsMap.get(condition.id) || [];
        const score = calculateRelevanceScore(query, condition.name, aliases);

        return {
          id: condition.id,
          condition: condition.name,
          system: condition.system,
          subcategory: condition.subcategory,
          aliases,
          score,
        };
      })
      .filter(result => result.score > 0.1) // Filter out very low matches
      .sort((a, b) => {
        // Sort by score desc, then alphabetically
        if (Math.abs(b.score - a.score) < 0.01) {
          return a.condition.localeCompare(b.condition);
        }
        return b.score - a.score;
      })
      .slice(0, limit);

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error searching conditions:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Calculate relevance score for a search result
 * Higher score = better match
 */
function calculateRelevanceScore(
  query: string,
  conditionName: string,
  aliases: string[]
): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedName = conditionName.toLowerCase();
  
  // Exact match = highest score
  if (normalizedName === normalizedQuery) {
    return 3.0;
  }
  
  // Starts with query = high score
  if (normalizedName.startsWith(normalizedQuery)) {
    return 2.5;
  }
  
  // Contains query = good score
  if (normalizedName.includes(normalizedQuery)) {
    const lengthRatio = normalizedQuery.length / normalizedName.length;
    return 2.0 + lengthRatio;
  }
  
  // Check aliases
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase();
    if (normalizedAlias === normalizedQuery) return 2.8;
    if (normalizedAlias.startsWith(normalizedQuery)) return 2.3;
    if (normalizedAlias.includes(normalizedQuery)) {
      const lengthRatio = normalizedQuery.length / normalizedAlias.length;
      return 1.8 + lengthRatio;
    }
  }
  
  // Fuzzy match based on word overlap
  const queryWords = normalizedQuery.split(/\s+/);
  const nameWords = normalizedName.split(/\s+/);
  const matchedWords = queryWords.filter(qw => 
    nameWords.some(nw => nw.includes(qw) || qw.includes(nw))
  );
  
  if (matchedWords.length > 0) {
    return matchedWords.length / queryWords.length;
  }
  
  return 0;
}
