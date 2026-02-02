/**
 * GET /api/knowledge/caches
 *
 * List the current user's knowledge caches (for "My Library").
 * Returns only caches that have not yet expired.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const EmptySchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
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
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
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
      const list = caches.map((c: { id: string; displayName: string; geminiCacheName: string; expiresAt: Date; source: string; createdAt: Date }) => ({
        id: c.id,
        displayName: c.displayName,
        geminiCacheName: c.geminiCacheName,
        expiresAt: c.expiresAt.toISOString(),
        source: c.source,
        createdAt: c.createdAt.toISOString(),
      }));
      logger.info('Knowledge caches listed', { userId: user.id, count: list.length });
      return new Response(JSON.stringify({ caches: list }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
