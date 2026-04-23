/**
 * POST /api/srs/generate-visual
 *
 * Generative Mnemonics for FSRS: Adobe Firefly image for flashcard front/back
 * (e.g. "Lyme Disease" / "Bullseye Rash"). Visual Semantic Anchoring improves retention.
 *
 * Input: Flashcard front + back (or conditionId + taskType). If anatomy/pathology implied,
 * prompt: "Medical illustration of [Pathology], white background, photorealistic."
 * Optional structure reference (body part image) locks anatomy; Firefly "paints" the finding.
 *
 * When user rates a card "Hard" (1), frontend can call with style: "exaggerated" for
 * "Cartoon style, exaggerated features for memory aid."
 */

import { z } from 'zod';
import { assertAdobeHostAllowed } from '../_shared/adobeAllowlist';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const FIREFLY_GENERATE = 'https://firefly-api.adobe.io/v3/images/generate';
const IMS_TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';
const VISUALIZER_BUCKET = 'medical-images';
const MNEMONIC_PREFIX = 'srs-mnemonic';

const GenerateVisualBodySchema = z.object({
  body: z.object({
    /** Flashcard front (e.g. "Lyme Disease"). */
    front: z.string().min(1).max(500),
    /** Flashcard back / finding (e.g. "Bullseye Rash"). */
    back: z.string().min(1).max(500),
    /** photorealistic = medical illustration; exaggerated = cartoon mnemonic for Hard (1) re-generation. */
    style: z.enum(['photorealistic', 'exaggerated']).optional().default('photorealistic'),
    /** Optional: AnatomyStructure.id or MediaAsset.id for structure reference (e.g. arm for rash). */
    structureReferenceId: z.string().optional(),
    /** Optional: URL of reference image for structure (locks anatomy). */
    structureReferenceUrl: z.string().url().optional(),
    /** Optional: conditionId for logging. */
    conditionId: z.string().optional(),
    /** Optional: questionId for logging. */
    questionId: z.string().optional(),
  }),
});

interface Env {
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  ADOBE_ACCESS_TOKEN?: string;
}

async function getAdobeToken(env: Env): Promise<string> {
  if (env.ADOBE_ACCESS_TOKEN) return env.ADOBE_ACCESS_TOKEN;
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    throw new Error('Adobe credentials not configured');
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
  if (!res.ok) throw new Error(`Adobe token failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in Adobe response');
  return data.access_token;
}

async function resolveReferenceUrl(env: Env, referenceId: string): Promise<string | null> {
  if (!env.DATABASE_URL || !env.SUPABASE_URL) return null;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  try {
    const structure = await prisma.anatomyStructure.findUnique({
      where: { id: referenceId },
      select: { imageUrl: true },
    });
    if (structure?.imageUrl) return structure.imageUrl;
    const asset = await prisma.mediaAsset.findFirst({
      where: { anatomyId: referenceId },
      select: { originalUrl: true, storagePath: true },
    });
    if (asset?.originalUrl) return asset.originalUrl;
    if (asset?.storagePath)
      return `${env.SUPABASE_URL}/storage/v1/object/public/${VISUALIZER_BUCKET}/${asset.storagePath}`;
    const assetById = await prisma.mediaAsset.findUnique({
      where: { id: referenceId },
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

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const str = bytes.reduce((acc, b) => acc + String.fromCodePoint(b), '');
  return btoa(str);
}

export const onRequestPost = authenticatedEndpoint(GenerateVisualBodySchema, async (context) => {
  const { env, auth, validated } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof GenerateVisualBodySchema>;
  };
  const log = createEndpointLogger('/api/srs/generate-visual', auth.userId);
  const {
    front,
    back,
    style,
    structureReferenceId,
    structureReferenceUrl,
    conditionId,
    questionId,
  } = validated.body;

  try {
    const token = await getAdobeToken(env);
    const pathology = back.trim();
    const prompt =
      style === 'exaggerated'
        ? `Cartoon style medical mnemonic for "${front}: ${pathology}". Exaggerated, memorable features for memory aid. White background, educational illustration.`
        : `Medical illustration of ${pathology}, white background, photorealistic. Clinical finding for "${front}".`;

    const fireflyBody: Record<string, unknown> = {
      prompt,
      numVariations: 1,
      size: { width: 1024, height: 1024 },
      contentClass: 'art',
    };

    let refUrl = structureReferenceUrl ?? null;
    if (!refUrl && structureReferenceId) {
      refUrl = await resolveReferenceUrl(env, structureReferenceId);
    }
    if (refUrl) {
      fireflyBody.structure = {
        imageReference: { source: { url: refUrl } },
        strength: 50,
      };
    }

    assertAdobeHostAllowed(FIREFLY_GENERATE);
    const res = await fetch(FIREFLY_GENERATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': env.ADOBE_CLIENT_ID ?? '',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fireflyBody),
    });

    if (!res.ok) {
      const text = await res.text();
      log.warn('Firefly generate-visual failed', { status: res.status, body: text.slice(0, 200) });
      return fail(ErrorCode.UPSTREAM_ERROR, { message: 'Failed to generate mnemonic image', details: text.slice(0, 300) });
    }

    const data = (await res.json()) as {
      images?: Array<{ image?: { uploadId?: string; source?: { url?: string } } }>;
    };
    const img = data.images?.[0]?.image;
    const imageUrl = img?.source?.url ?? img?.uploadId;
    if (!imageUrl?.startsWith('http')) {
      return fail(ErrorCode.UPSTREAM_ERROR, { message: 'No image URL in Firefly response' });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return fail(ErrorCode.UPSTREAM_ERROR, { message: 'Failed to fetch generated image' });
    }
    const buf = await imgRes.arrayBuffer();
    const imageBase64 = arrayBufferToBase64(buf);
    const imageMime = imgRes.headers.get('content-type') || 'image/png';

    log.info('SRS mnemonic generated', {
      front: front.slice(0, 30),
      style,
      conditionId: conditionId ?? undefined,
    });

    return ok({
      imageBase64,
      imageMime,
      imageUrl,
      front,
      back,
      style,
      conditionId: conditionId ?? undefined,
      questionId: questionId ?? undefined,
    });
  } catch (err) {
    log.error('SRS generate-visual error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to generate visual mnemonic' });
  }
});
