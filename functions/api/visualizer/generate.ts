/**
 * POST /api/visualizer/generate
 * "Anatomy Painter" (Phase 3): Adobe Firefly Image 3 + Structure Reference + Gemini segmentation.
 *
 * Student benefit: Custom, anatomically accurate diagrams for rare conditions not in standard
 * atlases. Standard AI hallucinates extra bones; structure reference locks bone geometry (PA precision).
 *
 * Cursor Implementation Plan (Phase 3):
 * 1. Structure Reference: CRITICAL — pass reference image to Firefly structure parameter.
 *    Use structureReferenceUrl or structureReferenceImageId (uploadId), or referenceAnatomyId
 *    (resolve from DB: AnatomyStructure.imageUrl or MediaAsset URL). Locks bone geometry.
 * 2. Generative Fill: Firefly "paints" pathology over the validated structure.
 * 3. Labeling: Gemini 2.5 Flash conversational segmentation → masks for ligaments/bones (clickable).
 * 4. Storage: Save asset to Supabase Storage; log metadata in Prisma (VisualizerGeneration).
 */

import { z } from 'zod';
import { assertAdobeHostAllowed } from '../_shared/adobeAllowlist';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const FIREFLY_GENERATE = 'https://firefly-api.adobe.io/v3/images/generate';
const IMS_TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';
const SEGMENTATION_MODEL = 'gemini-2.5-flash';
const VISUALIZER_BUCKET = 'medical-images';
const VISUALIZER_PREFIX = 'visualizer';

const GenerateBodySchema = z.object({
  body: z.object({
    /** Student prompt, e.g. "Grade 3 Ankle Sprain" or "Femur fracture". */
    prompt: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .default('Human hand anatomy, medical illustration style, exhibiting rheumatoid arthritis.'),
    segmentationPrompt: z
      .string()
      .max(500)
      .optional()
      .default(
        'Segment the inflamed joints. Return a JSON list of segmentation masks with keys "mask" and "label".'
      ),
    /** Firefly: uploadId from prior upload (structure reference). */
    structureReferenceImageId: z.string().optional(),
    /** Firefly: URL of reference image. Locks bone geometry to prevent hallucination. */
    structureReferenceUrl: z
      .string()
      .optional()
      .refine((s) => s === undefined || s.startsWith('https://') || s.startsWith('http://'), {
        message: 'Must be http(s) URL',
      }),
    /** Reference anatomy from DB: AnatomyStructure.id or MediaAsset.id. Resolved to URL for structure. */
    referenceAnatomyId: z.string().optional(),
    /** Firefly: "art" = Medical Illustration; "photo" = Hyper-realistic. */
    contentClass: z.enum(['photo', 'art']).optional().default('art'),
    /** Condition ID for logging (e.g. Grade 3 Ankle Sprain). */
    conditionId: z.string().optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  ADOBE_ACCESS_TOKEN?: string;
}

/** Resolve reference image URL from DB: AnatomyStructure.imageUrl or first MediaAsset (originalUrl or public storage URL). */
async function resolveReferenceUrlFromDb(
  env: Env,
  referenceAnatomyId: string
): Promise<string | null> {
  if (!env.DATABASE_URL || !env.SUPABASE_URL) return null;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const structure = await prisma.anatomyStructure.findUnique({
      where: { id: referenceAnatomyId },
      select: { imageUrl: true },
    });
    if (structure?.imageUrl) return structure.imageUrl;
    const asset = await prisma.mediaAsset.findFirst({
      where: { anatomyId: referenceAnatomyId },
      select: { originalUrl: true, storagePath: true },
    });
    if (asset?.originalUrl) return asset.originalUrl;
    if (asset?.storagePath)
      return `${env.SUPABASE_URL}/storage/v1/object/public/${VISUALIZER_BUCKET}/${asset.storagePath}`;
    const assetById = await prisma.mediaAsset.findUnique({
      where: { id: referenceAnatomyId },
      select: { originalUrl: true, storagePath: true },
    });
    if (assetById?.originalUrl) return assetById.originalUrl;
    if (assetById?.storagePath)
      return `${env.SUPABASE_URL}/storage/v1/object/public/${VISUALIZER_BUCKET}/${assetById.storagePath}`;
    return null;
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

async function getAdobeToken(env: Env): Promise<string> {
  if (env.ADOBE_ACCESS_TOKEN) return env.ADOBE_ACCESS_TOKEN;
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    throw new Error(
      'Adobe credentials not configured (ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET or ADOBE_ACCESS_TOKEN)'
    );
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.ADOBE_CLIENT_ID,
    client_secret: env.ADOBE_CLIENT_SECRET,
    scope: 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis',
  });
  assertAdobeHostAllowed(IMS_TOKEN);
  const res = await fetch(IMS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Adobe token failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in Adobe response');
  return data.access_token;
}

/** Fetch image bytes and return base64. fromCharCode is correct for bytes 0-255; fromCodePoint is for Unicode. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const str = bytes.reduce((acc, b) => acc + String.fromCodePoint(b), '');
  return btoa(str);
}

type FireflyInput = {
  prompt: string;
  structureReferenceImageId?: string;
  structureReferenceUrl?: string | null;
  contentClass: 'art' | 'photo';
};

async function generateFireflyImage(
  env: Env,
  input: FireflyInput
): Promise<{ imageBase64: string; imageMime: string } | null> {
  const token = await getAdobeToken(env);
  const { prompt, structureReferenceImageId, structureReferenceUrl, contentClass } = input;
  const fireflyBody: Record<string, unknown> = {
    prompt,
    numVariations: 1,
    size: { width: 1024, height: 1024 },
    contentClass,
  };
  if (structureReferenceUrl) {
    fireflyBody.structure = {
      imageReference: { source: { url: structureReferenceUrl } },
      strength: 50,
    };
  } else if (structureReferenceImageId) {
    fireflyBody.structure = {
      imageReference: { source: { uploadId: structureReferenceImageId } },
      strength: 50,
    };
  }
  assertAdobeHostAllowed(FIREFLY_GENERATE);
  const fireflyRes = await fetch(FIREFLY_GENERATE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': env.ADOBE_CLIENT_ID ?? '',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(fireflyBody),
  });
  if (!fireflyRes.ok) return null;
  const fireflyData = (await fireflyRes.json()) as {
    images?: Array<{ image?: { uploadId?: string; source?: { url?: string } } }>;
  };
  const img = fireflyData.images?.[0]?.image;
  const imageUrl = img?.source?.url ?? img?.uploadId;
  if (!imageUrl?.startsWith('http')) return null;
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const buf = await imgRes.arrayBuffer();
  const imageBase64 = arrayBufferToBase64(buf);
  const imageMime = imgRes.headers.get('content-type') || 'image/png';
  return { imageBase64, imageMime };
}

function parseSegmentationMasks(textPart: string): Array<{ mask?: string; label?: string }> {
  try {
    const parsed = JSON.parse(textPart);
    let masks = Array.isArray(parsed) ? parsed : (parsed.masks ?? parsed.mask ?? []);
    if (!Array.isArray(masks)) masks = [masks];
    return masks;
  } catch {
    return [];
  }
}

export const onRequestOptions = withCors();

/** Upload base64 image to Supabase Storage; returns storage path and public URL or null. */
async function uploadToSupabase(
  env: Env,
  imageBase64: string,
  mimeType: string
): Promise<{ storagePath: string; storageUrl: string } | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const storagePath = `${VISUALIZER_PREFIX}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const binary = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${VISUALIZER_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: binary,
    }
  );
  if (!res.ok) return null;
  const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${VISUALIZER_BUCKET}/${storagePath}`;
  return { storagePath, storageUrl };
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): Anatomy Painter —
// Adobe Firefly Image 3 generation + Gemini 2.5 Flash segmentation. Multi-call
// AI pipeline, very expensive. 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(GenerateBodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof GenerateBodySchema>;
    auth: { userId: string };
  };
  const body = validated.body;
  const log = createEndpointLogger('/api/visualizer/generate', auth.userId);

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let structureReferenceUrl = body.structureReferenceUrl ?? null;
  if (body.referenceAnatomyId && !structureReferenceUrl && !body.structureReferenceImageId) {
    structureReferenceUrl = await resolveReferenceUrlFromDb(env, body.referenceAnatomyId);
  }

  const fireflyInput: FireflyInput = {
    prompt: body.prompt ?? '',
    structureReferenceImageId: body.structureReferenceImageId,
    structureReferenceUrl,
    contentClass: body.contentClass ?? 'art',
  };

  const { segmentationPrompt, conditionId, contentClass } = body;
  let imageBase64: string | null = null;
  let imageMime = 'image/png';

  if (env.ADOBE_CLIENT_ID || env.ADOBE_ACCESS_TOKEN) {
    try {
      const result = await generateFireflyImage(env, fireflyInput);
      if (result) {
        imageBase64 = result.imageBase64;
        imageMime = result.imageMime;
      }
    } catch (e) {
      log.error('Firefly error', e);
      return new Response(
        JSON.stringify({
          error: 'Adobe Firefly error',
          details: e instanceof Error ? e.message : 'Unknown',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (!imageBase64) {
    return new Response(
      JSON.stringify({
        error:
          'No image generated. Configure ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET (or ADOBE_ACCESS_TOKEN) for Firefly, or provide a base64 image in the request.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const geminiUrl = `${GEMINI_BASE}/v1beta/models/${SEGMENTATION_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const geminiBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: imageMime, data: imageBase64 } },
          { text: segmentationPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    log.warn('Gemini segmentation failed', { status: geminiRes.status, text: text.slice(0, 200) });
    return new Response(JSON.stringify({ error: 'Segmentation failed', details: text }), {
      status: geminiRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const geminiData = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const textPart = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  const masks = parseSegmentationMasks(textPart);

  let storagePath: string | undefined;
  let storageUrl: string | undefined;
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const uploadResult = await uploadToSupabase(env, imageBase64, imageMime);
    if (uploadResult) {
      storagePath = uploadResult.storagePath;
      storageUrl = uploadResult.storageUrl;
    }
  }

  if (env.DATABASE_URL && storagePath && storageUrl) {
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (user) {
        await prisma.visualizerGeneration.create({
          data: {
            userId: user.id,
            conditionId: conditionId ?? undefined,
            prompt: body.prompt ?? '',
            contentClass: contentClass ?? 'art',
            storagePath,
            storageUrl,
            referenceAnatomyId: body.referenceAnatomyId ?? undefined,
          },
        });
      }
    } catch (e) {
      log.warn('VisualizerGeneration log failed', {
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  }

  return new Response(
    JSON.stringify({
      data: {
        imageBase64: `data:${imageMime};base64,${imageBase64}`,
        imageMime,
        masks,
        conditionId: conditionId ?? undefined,
        contentClass,
        storageUrl: storageUrl ?? undefined,
        storagePath: storagePath ?? undefined,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
