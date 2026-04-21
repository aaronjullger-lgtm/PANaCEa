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
import { authenticatedEndpoint, withCors, aiEndpoint} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const logger = createEndpointLogger('/api/knowledge/cache/[name]');

export const onRequestOptions = withCors();

export const onRequestDelete = aiEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth, params } = context;

    if (!env.GEMINI_API_KEY) {
      return { status: 500, error: 'GEMINI_API_KEY environment variable is not set' };
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

      const deleted = await prisma.knowledgeCache.deleteMany({
        where: { userId: user.id, geminiCacheName: name },
      });

      if (deleted.count === 0) {
        return { status: 404, error: 'Cache not found or already deleted' };
      }

      // Clean up on Gemini side (best-effort)
      const delRes = await fetch(`${GEMINI_BASE}/v1beta/${name}?key=${env.GEMINI_API_KEY}`, {
        method: 'DELETE',
      });
      if (!delRes.ok && delRes.status !== 404) {
        logger.warn('Gemini cache delete failed (DB already updated)', {
          status: delRes.status,
          name,
        });
      }

      logger.info('Knowledge cache deleted', { name, userId: user.id });
      return { data: { deleted: true, name } };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
