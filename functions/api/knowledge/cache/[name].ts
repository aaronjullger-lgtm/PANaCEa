/**
 * DELETE /api/knowledge/cache/:name
 *
 * Delete a knowledge cache by Gemini cache name (e.g. cachedContents/xxx).
 * Removes the DB row and calls Gemini cachedContents.delete.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (60/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { aiEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const logger = createEndpointLogger('/api/knowledge/cache/[name]');

export const onRequestDelete = aiEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth, params } = context;

    if (!env.GEMINI_API_KEY) {
      return { status: 500, error: 'Knowledge cache deletion is not configured' };
    }

    const rawName = params?.name;
    const name = rawName ? decodeURIComponent(rawName) : '';
    if (!name || !name.startsWith('cachedContents/')) {
      return { status: 400, error: 'Invalid cache name. Must be like cachedContents/xxx' };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      const record = await prisma.knowledgeCache.findFirst({
        where: { userId: user.id, geminiCacheName: name },
        select: { id: true },
      });
      if (!record) {
        return { status: 404, error: 'Cache not found or already deleted' };
      }

      const delRes = await fetch(`${GEMINI_BASE}/v1beta/${name}?key=${env.GEMINI_API_KEY}`, {
        method: 'DELETE',
      });
      if (!delRes.ok && delRes.status !== 404) {
        logger.warn('Gemini cache delete failed', {
          status: delRes.status,
          name,
        });
        return { status: 502, error: 'Failed to delete external cache' };
      }

      await prisma.knowledgeCache.delete({ where: { id: record.id } });

      logger.info('Knowledge cache deleted', { name, userId: user.id });
      return { data: { deleted: true, name } };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
