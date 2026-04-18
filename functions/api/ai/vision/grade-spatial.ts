/**
 * POST /api/vision/grade-spatial
 *
 * Spatial Verification: Grade a student's drawn bounding box against the
 * pathology/finding in a medical image. Uses vision reasoning to identify
 * the correct box when no cached coords exist; caches the result on
 * MediaAsset.spatialAnswerCoords for future hits.
 *
 * Migrated to the unified AI Gateway (Sprint 4). All model access flows
 * through `gateway.callVision()` — no direct callGemini, no regex code-fence
 * stripping, no unvalidated JSON.parse on model output. The bounding box is
 * validated against BoundingBoxSchema with a single schema-repair pass
 * permitted before we give up and tell the caller we couldn't identify the
 * pathology.
 *
 * Grading remains deterministic: IoU-style overlap between the student's
 * box and the model's (or cached) correct box, threshold OVERLAP_THRESHOLD.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../../_shared/rateLimiter';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  BoundingBoxSchema,
  BOUNDING_BOX_DESCRIPTION,
} from '@/lib/ai/schemas/extraction';

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
    /** Pathology to look for (e.g. "ST-elevation in V1-V4"); helps the model when no cache hit */
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

/**
 * Ask the vision model to identify the primary pathology/finding and return
 * a normalized [ymin, xmin, ymax, xmax] bounding box. Returns null when the
 * model refuses, times out, or produces output that can't be coerced to a
 * valid BoundingBox even after one repair pass.
 *
 * The endpoint treats null as "could not identify pathology" (502 to caller)
 * — matching the prior graceful behavior. We never silently substitute a
 * fabricated box.
 */
async function callModelForCorrectBox(
  ctx: {
    env: unknown;
    auth?: { userId?: string } | null;
    waitUntil?: (p: Promise<unknown>) => void;
  },
  imageBase64: string,
  mimeType: string,
  pathology: string | undefined,
  log: ReturnType<typeof createEndpointLogger>
): Promise<[number, number, number, number] | null> {
  const systemPrompt =
    'You are a precise medical-imaging annotator. Return only the requested JSON object — no prose, no code fences.';

  const userPrompt = pathology
    ? `Identify the ${pathology} in this medical image.

Return ONLY a JSON object conforming to this schema:
${BOUNDING_BOX_DESCRIPTION}`
    : `Identify the primary pathology/finding in this medical image.

Return ONLY a JSON object conforming to this schema:
${BOUNDING_BOX_DESCRIPTION}`;

  try {
    const response = await gateway.callVision(toGatewayContext(ctx), {
      mode: 'vision-structured',
      task: 'extraction',
      endpoint: '/api/vision/grade-spatial',
      tier: 'powerful',
      schema: BoundingBoxSchema,
      schemaDescription: BOUNDING_BOX_DESCRIPTION,
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxOutputTokens: 256,
      images: [{ mimeType, data: imageBase64 }],
    });

    if (response.mode !== 'structured') {
      log.warn('Vision gateway returned non-structured response', {
        mode: response.mode,
      });
      return null;
    }

    const [ymin, xmin, ymax, xmax] = response.data.bounding_box;
    if (
      typeof ymin !== 'number' ||
      typeof xmin !== 'number' ||
      typeof ymax !== 'number' ||
      typeof xmax !== 'number' ||
      !Number.isFinite(ymin) ||
      !Number.isFinite(xmin) ||
      !Number.isFinite(ymax) ||
      !Number.isFinite(xmax)
    ) {
      log.warn('Bounding box contained non-finite values', {
        bbox: response.data.bounding_box,
      });
      return null;
    }

    return [ymin, xmin, ymax, xmax];
  } catch (error) {
    if (error instanceof GatewayError) {
      log.warn('Vision gateway failed for spatial grading', {
        code: error.code,
        requestId: error.requestId,
        traceId: error.traceId,
        message: error.message,
      });
    } else {
      log.warn('Unexpected vision gateway error', { error });
    }
    return null;
  }
}

export const onRequestOptions = withCors();

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): vision-based spatial
// grading hits multimodal Gemini (image + prompt). 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { request, env, validated, auth } = context as unknown as {
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

  // Cache hit path — use pre-computed coords if we have them.
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

  // Cache miss — ask the vision model and write the result back for next time.
  if (!correctBox) {
    correctBox = await callModelForCorrectBox(
      context,
      imageBase64,
      mimeType,
      pathology,
      log
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
