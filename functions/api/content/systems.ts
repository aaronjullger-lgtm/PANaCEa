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
const SYSTEMS_CACHE_KEY = 'content:systems';
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
      data: { error: 'Systems unavailable', message: 'Database is not configured.' },
      status: 503,
    };
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const allSystems = await prisma.medicalContent.findMany({
      select: { system: true },
    });

    const systemCounts = new Map<string, number>();
    for (const { system } of allSystems) {
      if (system) systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
    }

    const systems = Array.from(systemCounts.entries())
      .map(([system, count]) => ({ id: system, label: system, count }))
      .sort((a, b) => b.count - a.count);

    await setCached(env as { CACHE?: KVNamespace }, SYSTEMS_CACHE_KEY, systems, CACHE_TTL);
    logger.info('Systems fetched', { count: systems.length });
    return { data: systems, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch systems', { error: errMsg });
    return {
      data: { error: 'Failed to fetch systems', message: 'Please try again later.' },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
