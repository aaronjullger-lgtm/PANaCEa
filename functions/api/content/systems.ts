/**
 * GET /api/content/systems
 *
 * Returns distinct organ systems with content counts.
 * Used to populate filter dropdowns in the library browser.
 * Sprint 5: KV cache TTL 1h.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getCached, setCached } from '../_shared/kv-cache';

const ContentSystemsSchema = z.object({});
// v2: now filters by status='published', old cache entries are stale
const SYSTEMS_CACHE_KEY = 'content:systems:v2';
const CACHE_TTL = 3600; // 1h

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ContentSystemsSchema, async (context) => {
  const { env } = context;
  const logger = createEndpointLogger('/api/content/systems');

  const cached = await getCached<Array<{ id: string; label: string; count: number }>>(
    env as { CACHE?: KVNamespace },
    SYSTEMS_CACHE_KEY
  );
  if (cached) {
    return { data: cached, headers: { 'Cache-Control': 'public, max-age=3600' } };
  }

  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL not configured');
    return {
      error: 'Systems unavailable: Database is not configured.',
      status: 503,
    };
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // groupBy is far more efficient than findMany + JS counting.
    // Only published content is surfaced to learners.
    const systemGroups = await prisma.medicalContent.groupBy({
      by: ['system'],
      where: { status: 'published', system: { not: null } },
      _count: { system: true },
      orderBy: { _count: { system: 'desc' } },
    });

    const systems = systemGroups
      .filter((g) => g.system)
      .map((g) => ({ id: g.system!, label: g.system!, count: g._count.system }));

    await setCached(env as { CACHE?: KVNamespace }, SYSTEMS_CACHE_KEY, systems, CACHE_TTL);
    logger.info('Systems fetched', { count: systems.length });
    return { data: systems, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch systems', { error: errMsg });
    return {
      error: 'Failed to fetch systems. Please try again later.',
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
