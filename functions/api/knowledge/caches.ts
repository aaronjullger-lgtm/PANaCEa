/**
 * GET /api/knowledge/caches
 *
 * List the current user's knowledge caches (for "My Library").
 * Returns only caches that have not yet expired.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const EmptySchema = z.object({});

export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context as {
    env: { DATABASE_URL: string };
    auth: { userId: string };
  };
  const logger = createEndpointLogger('/api/knowledge/caches');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return fail(ErrorCode.NOT_FOUND, { message: 'User not found' });
    }
    const now = new Date();
    const caches = await prisma.knowledgeCache.findMany({
      where: { userId: user.id, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        geminiCacheName: true,
        expiresAt: true,
        source: true,
        createdAt: true,
      },
    });
    const list = caches.map(
      (c: {
        id: string;
        displayName: string;
        geminiCacheName: string;
        expiresAt: Date;
        source: string;
        createdAt: Date;
      }) => ({
        id: c.id,
        displayName: c.displayName,
        geminiCacheName: c.geminiCacheName,
        expiresAt: c.expiresAt.toISOString(),
        source: c.source,
        createdAt: c.createdAt.toISOString(),
      })
    );
    logger.info('Knowledge caches listed', { userId: user.id, count: list.length });
    return ok({ caches: list });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
