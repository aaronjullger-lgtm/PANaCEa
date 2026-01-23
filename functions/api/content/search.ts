/**
 * GET /api/content/search
 *
 * Content Search API Endpoint
 * Uses database-driven search with intelligent ranking
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { searchContent } from '../_shared/content-search';

const SearchSchema = z.object({
  query: z.object({
    q: z.string().min(2, 'Search query must be at least 2 characters'),
    limit: z.string().optional(),
    type: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(SearchSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/content/search');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const query = validated.query?.q?.trim() || '';
    const limit = Math.min(Math.max(parseInt(validated.query?.limit || '10', 10), 1), 50);

    // Parse content types to search
    let includeTypes: ('condition' | 'drug')[] = ['condition', 'drug'];
    if (validated.query?.type) {
      const types = validated.query.type.split(',').map((t) => t.trim().toLowerCase());
      includeTypes = types.filter((t) => t === 'condition' || t === 'drug') as (
        | 'condition'
        | 'drug'
      )[];
      if (includeTypes.length === 0) includeTypes = ['condition', 'drug'];
    }

    const results = await searchContent(prisma, query, limit, includeTypes);
    logger.info('Content search completed', { query, count: results.length });

    return {
      data: { results, count: results.length, query, limit },
      headers: { 'Cache-Control': 'public, max-age=300' },
    };
  } catch (error) {
    logger.error('Error searching content', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to search content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
