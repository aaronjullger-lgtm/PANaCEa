/**
 * SRS Items List API
 * GET /api/srs
 * 
 * Fetch all SRS items for the authenticated user
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SRSListSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(SRSListSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/srs');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('User not found in database', { clerkId: auth.userId.substring(0, 10) });
      return {
        data: { error: 'User not found' },
        status: 404,
      };
    }

    const items = await prisma.sRSItem.findMany({
      where: { userId: user.id },
      orderBy: { dueDate: 'asc' },
    });

    logger.info('SRS items retrieved', {
      userId: user.id.substring(0, 10),
      itemCount: items.length,
    });

    return {
      data: { items },
    };
  } catch (error) {
    logger.error('SRS items error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId.substring(0, 10),
    });
    throw new Error('Failed to fetch SRS items');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
