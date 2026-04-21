import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
// Phase 1.3 optimization: cache building is summarization, not reasoning (was gemini-2.5-flash)
const CACHE_MODEL = 'gemini-2.0-flash';

const CreateCacheSchema = z.object({
  displayName: z.string().min(1).max(128),
  fileUri: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(86400).optional().default(DEFAULT_TTL_SECONDS),
  systemInstruction: z.string().max(8000).optional(),
  // Optional MIME type from upload (defaults to application/pdf for backward compatibility)
  mimeType: z.string().min(1).optional(),
});

export const onRequestPost = aiEndpoint(CreateCacheSchema, async (context) => {
  const { env, auth, validated } = context as {
    env: { DATABASE_URL: string; GEMINI_API_KEY: string };
    auth: { userId: string };
    validated: z.infer<typeof CreateCacheSchema>;
  };
  const logger = createEndpointLogger('/api/knowledge/cache');
  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
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
    const { displayName, fileUri, ttlSeconds, systemInstruction, mimeType } = validated;
    const instruction =
      systemInstruction ??
      'You are a senior clinical educator for PA students. Answer using the provided cached content. Cite sources with [Page X] when applicable.';
    const body = {
      model: `models/${CACHE_MODEL}`,
      contents: [
        {
          role: 'user',
          parts: [{ fileData: { fileUri, mimeType: mimeType || 'application/pdf' } }],
        },
      ],
      systemInstruction: { parts: [{ text: instruction }] },
      ttl: `${ttlSeconds}s`,
    };
    const res = await fetch(`${GEMINI_BASE}/v1beta/cachedContents?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn('Gemini cache create failed', { status: res.status, text: text.slice(0, 200) });
      return fail(ErrorCode.GEMINI_ERROR, { message: `Failed to create cache: ${res.status}` });
    }
    const data = (await res.json()) as { name?: string; expireTime?: string };
    const geminiCacheName = data.name;
    const expireTime = data.expireTime;
    if (!geminiCacheName || !expireTime) {
      return fail(ErrorCode.GEMINI_ERROR, { message: 'Invalid cache response from Gemini' });
    }
    const cache = await prisma.knowledgeCache.create({
      data: {
        userId: user.id,
        displayName,
        geminiCacheName,
        geminiFileIds: [fileUri],
        expiresAt: new Date(expireTime),
        source: 'upload',
        updatedAt: new Date(),
      },
    });
    logger.info('Knowledge cache created', { id: cache.id, displayName });
    return ok({
      id: cache.id,
      name: geminiCacheName,
      expireTime,
      displayName,
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
