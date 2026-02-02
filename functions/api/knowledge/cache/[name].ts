/**
 * DELETE /api/knowledge/cache/:name
 *
 * Delete a knowledge cache by Gemini cache name (e.g. cachedContents/xxx).
 * Removes the DB row and calls Gemini cachedContents.delete.
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

export async function onRequestDelete(context: {
  request: Request;
  env: Env & { GEMINI_API_KEY?: string; DATABASE_URL?: string };
  params: { name?: string };
}) {
  const { request, env, params } = context;
  const logger = createEndpointLogger('/api/knowledge/cache/[name]');

  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  try {
    validateFunctionEnv(env as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  const rawName = params.name;
  const name = rawName ? decodeURIComponent(rawName) : '';
  if (!name || !name.startsWith('cachedContents/')) {
    return createErrorResponse(
      request,
      'Invalid cache name. Must be like cachedContents/xxx',
      400,
      undefined,
      env
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL!);
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return createErrorResponse(request, 'User not found', 404, undefined, env);
    }

    const deleted = await prisma.knowledgeCache.deleteMany({
      where: { userId: user.id, geminiCacheName: name },
    });

    if (deleted.count === 0) {
      return createErrorResponse(request, 'Cache not found or already deleted', 404, undefined, env);
    }

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
    return createSuccessResponse(request, { deleted: true, name }, 200, 0, env);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
