/**
 * GET /api/content/systems
 *
 * Returns distinct organ systems with content counts.
 * Used to populate filter dropdowns in the library browser.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ContentSystemsSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ContentSystemsSchema, async (context) => {
  const { env } = context;
  const logger = createEndpointLogger('/api/content/systems');
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

    logger.info('Systems fetched', { count: systems.length });
    return { data: systems, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Failed to fetch systems', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to fetch systems');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
