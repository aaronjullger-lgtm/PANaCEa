/**
 * DELETE /api/knowledge/cache/:id
 * Delete a knowledge cache by DB id (and call Gemini cachedContents delete if still valid).
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
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
        return fail(ErrorCode.NOT_FOUND, { message: 'User not found' });
      }

      const record = await prisma.knowledgeCache.findFirst({
        where: { id: validated.id, userId: user.id },
        select: { id: true, geminiCacheName: true, expiresAt: true },
      });

      if (!record) {
        return fail(ErrorCode.NOT_FOUND, { message: 'Cache not found' });
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

      return ok({ deleted: true, id: record.id });
    } catch (err) {
      log.error('Knowledge cache delete error', err);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Internal server error' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
