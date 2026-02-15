/**
 * POST /api/vision/grade-spatial
 *
 * Spatial Verification: Grade student's drawn bounding box against the pathology.
 * Uses Gemini Vision when no cached coords; stores correct coords in MediaAsset for future cache hits.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const VISION_MODEL = 'gemini-2.5-pro';
const OVERLAP_THRESHOLD = 0.5;

const BodySchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1),
    mimeType: z.string().optional().default('image/png'),
    /** User box: x, y, width, height in normalized 0-1000 coords */
    userBox: z.object({
      x: z.number().min(0).max(1000),
      y: z.number().min(0).max(1000),
      width: z.number().min(0).max(1000),
      height: z.number().min(0).max(1000),
    }),
    /** MediaAsset ID for cache lookup/write */
    mediaAssetId: z.string().optional(),
    /** Pathology to look for (e.g. "ST-elevation in V1-V4"); helps Gemini when generating */
    pathology: z.string().max(500).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  DATABASE_URL?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

/** IoU-like overlap: intersection area / min(userArea, correctArea). 0-1. */
function overlap(
  user: { x: number; y: number; width: number; height: number },
  correct: [number, number, number, number]
): number {
  const [ymin, xmin, ymax, xmax] = correct;
  const ux1 = user.x;
  const uy1 = user.y;
  const ux2 = user.x + user.width;
  const uy2 = user.y + user.height;
  const cx1 = xmin;
  const cy1 = ymin;
  const cx2 = xmax;
  const cy2 = ymax;
  const ix1 = Math.max(ux1, cx1);
  const iy1 = Math.max(uy1, cy1);
  const ix2 = Math.min(ux2, cx2);
  const iy2 = Math.min(uy2, cy2);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const userArea = user.width * user.height;
  const correctArea = (cx2 - cx1) * (cy2 - cy1);
  const minArea = Math.min(userArea, correctArea);
  return minArea > 0 ? inter / minArea : 0;
}

async function callGeminiForCorrectBox(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  pathology?: string
): Promise<[number, number, number, number] | null> {
  const prompt = pathology
    ? `Identify the ${pathology} in this medical image. Return ONLY a JSON object: {"bounding_box": [ymin, xmin, ymax, xmax]} with coordinates normalized 0-1000.`
    : `Identify the primary pathology/finding in this medical image. Return ONLY a JSON object: {"bounding_box": [ymin, xmin, ymax, xmax]} with coordinates normalized 0-1000.`;
  const url = `${GEMINI_BASE}/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(
      text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()
    ) as {
      bounding_box?: number[];
    };
    const raw = parsed.bounding_box;
    if (Array.isArray(raw) && raw.length >= 4) {
      const n = raw.map(Number);
      const ymin = n[0] ?? 0;
      const xmin = n[1] ?? 0;
      const ymax = n[2] ?? 0;
      const xmax = n[3] ?? 0;
      if (
        Number.isFinite(ymin) &&
        Number.isFinite(xmin) &&
        Number.isFinite(ymax) &&
        Number.isFinite(xmax)
      ) {
        return [ymin, xmin, ymax, xmax];
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/vision/grade-spatial', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { imageBase64, mimeType, userBox, mediaAssetId, pathology } = validated.body;

  let correctBox: [number, number, number, number] | null = null;

  if (mediaAssetId && env.DATABASE_URL) {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const asset = await prisma.mediaAsset.findUnique({
        where: { id: mediaAssetId },
        select: { spatialAnswerCoords: true },
      });
      const coords = asset?.spatialAnswerCoords;
      if (Array.isArray(coords) && coords.length >= 4) {
        correctBox = coords.slice(0, 4).map(Number) as [number, number, number, number];
      }
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }

  if (!correctBox) {
    correctBox = await callGeminiForCorrectBox(
      env.GEMINI_API_KEY,
      imageBase64,
      mimeType,
      pathology
    );
    if (correctBox && mediaAssetId && env.DATABASE_URL) {
      const prisma = createEdgePrismaClient(env.DATABASE_URL);
      try {
        await prisma.mediaAsset.update({
          where: { id: mediaAssetId },
          data: { spatialAnswerCoords: correctBox },
        });
      } catch (err) {
        log.warn('Failed to cache spatial coords', { mediaAssetId, err });
      } finally {
        await safePrismaDisconnect(prisma);
      }
    }
  }

  if (!correctBox) {
    return { status: 502, error: 'Could not identify pathology for grading' };
  }

  const ov = overlap(userBox, correctBox);
  const isCorrect = ov >= OVERLAP_THRESHOLD;

  return {
    data: {
      isCorrect,
      overlapRatio: Math.round(ov * 100) / 100,
      correctBox: isCorrect ? undefined : correctBox,
    },
  };
});
