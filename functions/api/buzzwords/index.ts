/**
 * GET /api/buzzwords
 * Returns all buzzwords for reference (public endpoint)
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const BuzzwordsSchema = z.object({});

export const onRequestGet = publicEndpoint(BuzzwordsSchema, async (context) => {
  const { env } = context;
  const logger = createEndpointLogger('/api/buzzwords');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const buzzwords = await prisma.buzzword.findMany({
      orderBy: { buzzword: 'asc' },
    });

    logger.info('Fetched buzzwords', { count: buzzwords.length });

    return { data: buzzwords };
  } catch (error) {
    logger.error('Error fetching buzzwords', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch buzzwords');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
