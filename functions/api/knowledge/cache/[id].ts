/**
 * DELETE /api/knowledge/cache/:id
 * Delete a knowledge cache by DB id (and call Gemini cachedContents delete if still valid).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const DeleteParamsSchema = z.object({
  id: z.string().min(1, 'Cache id is required'),
});

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY?: string;
}

export const onRequestOptions = withCors();

export const onRequestDelete = authenticatedEndpoint(
  DeleteParamsSchema,
  async (context) => {
    const { env, validated, auth } = context as {
      env: Env;
      validated: z.infer<typeof DeleteParamsSchema>;
      auth: { userId: string };
    };
    const log = createEndpointLogger('/api/knowledge/cache/[id]', auth.userId);

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'DATABASE');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

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

      const record = await prisma.knowledgeCache.findFirst({
        where: { id: validated.id, userId: user.id },
        select: { id: true, geminiCacheName: true, expiresAt: true },
      });

      if (!record) {
        return new Response(JSON.stringify({ error: 'Cache not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await prisma.knowledgeCache.delete({ where: { id: record.id } });

      if (env.GEMINI_API_KEY && record.expiresAt > new Date()) {
        const url = `${GEMINI_BASE}/v1beta/${record.geminiCacheName}?key=${env.GEMINI_API_KEY}`;
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) {
          log.warn('Gemini cache delete failed (cache may already be expired)', {
            status: res.status,
            name: record.geminiCacheName,
          });
        }
      }

      return new Response(JSON.stringify({ data: { deleted: true, id: record.id } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      log.error('Knowledge cache delete error', err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
