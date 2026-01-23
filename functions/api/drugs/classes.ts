/**
 * GET /api/drugs/classes
 *
 * Returns distinct drug classes with drug counts.
 * Used to populate filter dropdowns in the drug library browser.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DrugClassesSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(DrugClassesSchema, async (context) => {
  const { env } = context;
  const logger = createEndpointLogger('/api/drugs/classes');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const allDrugs = await prisma.drug.findMany({
      select: { drugClass: true },
    });

    // drugClass is String[] - flatten and count
    const classCounts = new Map<string, number>();
    for (const { drugClass } of allDrugs) {
      if (drugClass && Array.isArray(drugClass)) {
        for (const cls of drugClass) {
          if (cls) classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
        }
      }
    }

    const classes = Array.from(classCounts.entries())
      .map(([cls, count]) => ({ id: cls, label: cls, count }))
      .sort((a, b) => b.count - a.count);

    logger.info('Drug classes fetched', { count: classes.length });
    return { data: classes, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Failed to fetch drug classes', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch drug classes');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
