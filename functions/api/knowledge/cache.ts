import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_TTL_SECONDS = 3600; // 1 hour
const CACHE_MODEL = 'gemini-1.5-pro';

const CreateCacheSchema = z.object({
  displayName: z.string().min(1).max(128),
  fileUri: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(86400).optional().default(DEFAULT_TTL_SECONDS),
  systemInstruction: z.string().max(8000).optional(),
  // Optional MIME type from upload (defaults to application/pdf for backward compatibility)
  mimeType: z.string().min(1).optional(),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(CreateCacheSchema, async (context) => {
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
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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
      return new Response(
        JSON.stringify({ error: `Failed to create cache: ${res.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = (await res.json()) as { name?: string; expireTime?: string };
    const geminiCacheName = data.name;
    const expireTime = data.expireTime;
    if (!geminiCacheName || !expireTime) {
      return new Response(JSON.stringify({ error: 'Invalid cache response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
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
    return new Response(
      JSON.stringify({
        id: cache.id,
        name: geminiCacheName,
        expireTime,
        displayName,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
