/**
 * POST /api/knowledge/cache/student-context
 * Create or reuse the per-user "study brain" cache: static layer (optional file URIs) + dynamic layer (last 50 incorrect attempts).
 * Returns cached_content_name for use in generateContent.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, aiEndpoint} from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { generateTutorContext } from '../../ai/learning/profile-crud';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const CACHE_MODEL = 'gemini-2.0-flash';
const STUDENT_CONTEXT_TTL = 3600; // 1 hour
const MIN_REMAINING_MINUTES = 10;
const WEAK_SPOT_SYSTEM_BASE =
  'You are a personalized board tutor. Use the cached "Weak Spot Profile" (the student\'s last incorrect questions) to tailor your explanations. Cite specific weak areas when relevant.';

const StudentContextBodySchema = z.object({
  ttlSeconds: z.number().int().min(60).max(86400).optional().default(STUDENT_CONTEXT_TTL),
  fileUris: z.array(z.string().url()).max(5).optional(), // optional static layer (e.g. PANCE Blueprint)
});

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
}

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(StudentContextBodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof StudentContextBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/knowledge/cache/student-context', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'DATABASE');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const apiKey = env.GEMINI_API_KEY;
  const { ttlSeconds, fileUris } = validated;

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
    const minExpiry = new Date(now.getTime() + MIN_REMAINING_MINUTES * 60 * 1000);

    const existing = await prisma.knowledgeCache.findFirst({
      where: { userId: user.id, source: 'student-context' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, geminiCacheName: true, expiresAt: true },
    });

    if (existing && existing.expiresAt >= minExpiry) {
      return new Response(
        JSON.stringify({
          data: {
            cachedContentName: existing.geminiCacheName,
            expiresAt: existing.expiresAt.toISOString(),
            reused: true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [attempts, tutorContext] = await Promise.all([
      prisma.questionAttempt.findMany({
        where: { userId: user.id, wasCorrect: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          selectedAnswer: true,
          system: true,
          conditionId: true,
          questionType: true,
        },
      }),
      generateTutorContext(prisma, user.id),
    ]);

    const systemInstruction = `${WEAK_SPOT_SYSTEM_BASE}\n\n${tutorContext}`;

    const weakSpotLines = attempts.map(
      (a, i) =>
        `[${i + 1}] System: ${a.system ?? 'unknown'} | Condition: ${a.conditionId ?? 'N/A'} | You chose: ${a.selectedAnswer ?? 'N/A'}`
    );
    const weakSpotText =
      weakSpotLines.length > 0
        ? `${tutorContext}\n\nRecent incorrect attempts:\n${weakSpotLines.join('\n')}`
        : tutorContext;

    const dynamicPart = {
      role: 'user' as const,
      parts: [{ text: `## Weak Spot Profile\n${weakSpotText}` }],
    };

    const staticParts: {
      role: 'user';
      parts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
    }[] = [];
    if (fileUris && fileUris.length > 0) {
      for (const fileUri of fileUris) {
        staticParts.push({
          role: 'user',
          parts: [{ fileData: { fileUri, mimeType: 'application/pdf' } }],
        });
      }
    }

    const contents = staticParts.length > 0 ? [...staticParts, dynamicPart] : [dynamicPart];

    const body = {
      model: `models/${CACHE_MODEL}`,
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      ttl: `${ttlSeconds}s`,
    };

    const res = await fetch(`${GEMINI_BASE}/v1beta/cachedContents?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.warn('Gemini student-context cache create failed', {
        status: res.status,
        text: text.slice(0, 300),
      });
      return new Response(
        JSON.stringify({ error: 'Failed to create student context cache', details: text }),
        { status: res.status === 429 ? 429 : 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = (await res.json()) as { name?: string; expireTime?: string };
    const geminiCacheName = data.name;
    const expireTime = data.expireTime;
    if (!geminiCacheName || !expireTime) {
      return new Response(
        JSON.stringify({ error: 'Gemini cache response missing name or expireTime' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existing) {
      await prisma.knowledgeCache.delete({ where: { id: existing.id } });
    }

    await prisma.knowledgeCache.create({
      data: {
        userId: user.id,
        displayName: 'Student context (weak spots)',
        geminiCacheName,
        geminiFileIds: fileUris ?? [],
        expiresAt: new Date(expireTime),
        source: 'student-context',
        updatedAt: now,
      },
    });

    log.info('Student context cache created', { userId: user.id, name: geminiCacheName });

    return new Response(
      JSON.stringify({
        data: {
          cachedContentName: geminiCacheName,
          expiresAt: expireTime,
          reused: false,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    log.error('Student context cache error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
