/**
 * POST /api/visualizer/generate
 * Step 1: Generate anatomy image via Adobe Firefly (optional structure reference).
 * Step 2: Segment the image with Gemini 2.5 Flash (conversational segmentation).
 * Returns image URL (or base64) + masks JSON for overlay.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const FIREFLY_GENERATE = 'https://firefly-api.adobe.io/v3/images/generate';
const IMS_TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';
const SEGMENTATION_MODEL = 'gemini-2.5-flash';

const GenerateBodySchema = z.object({
  prompt: z.string().min(1).max(1000).optional().default('Human hand anatomy, medical illustration style, exhibiting rheumatoid arthritis.'),
  segmentationPrompt: z.string().max(500).optional().default('Segment the inflamed joints. Return a JSON list of segmentation masks with keys "mask" and "label".'),
  structureReferenceImageId: z.string().optional(),
});

interface Env {
  GEMINI_API_KEY: string;
  ADOBE_CLIENT_ID?: string;
  ADOBE_CLIENT_SECRET?: string;
  ADOBE_ACCESS_TOKEN?: string;
}

async function getAdobeToken(env: Env): Promise<string> {
  if (env.ADOBE_ACCESS_TOKEN) return env.ADOBE_ACCESS_TOKEN;
  if (!env.ADOBE_CLIENT_ID || !env.ADOBE_CLIENT_SECRET) {
    throw new Error('Adobe credentials not configured (ADOBE_CLIENT_ID, ADOBE_CLIENT_SECRET or ADOBE_ACCESS_TOKEN)');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.ADOBE_CLIENT_ID,
    client_secret: env.ADOBE_CLIENT_SECRET,
    scope: 'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis',
  });
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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateBodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof GenerateBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/visualizer/generate', auth.userId);

  if (!env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { prompt, segmentationPrompt, structureReferenceImageId } = validated;
  let imageBase64: string | null = null;
  let imageMime = 'image/png';

  if (env.ADOBE_CLIENT_ID || env.ADOBE_ACCESS_TOKEN) {
    try {
      const token = await getAdobeToken(env);
      const fireflyBody: Record<string, unknown> = {
        prompt,
        numVariations: 1,
        size: { width: 1024, height: 1024 },
      };
      if (structureReferenceImageId) {
        fireflyBody.structure = { imageReference: { source: { uploadId: structureReferenceImageId } }, strength: 50 };
      }
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
      if (!fireflyRes.ok) {
        const text = await fireflyRes.text();
        log.warn('Firefly generate failed', { status: fireflyRes.status, text: text.slice(0, 200) });
        return new Response(
          JSON.stringify({ error: 'Firefly generation failed', details: text }),
          { status: fireflyRes.status, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const fireflyData = (await fireflyRes.json()) as {
        images?: Array<{ id?: string; seed?: number; image?: { uploadId?: string; source?: { url?: string } } }>;
      };
      const img = fireflyData.images?.[0]?.image;
      const imageUrl = img?.source?.url ?? img?.uploadId;
      if (imageUrl && imageUrl.startsWith('http')) {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          imageBase64 = b64;
          imageMime = imgRes.headers.get('content-type') || 'image/png';
        }
      }
    } catch (e) {
      log.error('Firefly error', e);
      return new Response(
        JSON.stringify({ error: 'Adobe Firefly error', details: e instanceof Error ? e.message : 'Unknown' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (!imageBase64) {
    return new Response(
      JSON.stringify({
        error: 'No image generated. Configure ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET (or ADOBE_ACCESS_TOKEN) for Firefly, or provide a base64 image in the request.',
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
    return new Response(
      JSON.stringify({ error: 'Segmentation failed', details: text }),
      { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const geminiData = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const textPart = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  let masks: Array<{ mask?: string; label?: string }> = [];
  try {
    const parsed = JSON.parse(textPart);
    masks = Array.isArray(parsed) ? parsed : parsed.masks ?? parsed.mask ?? [];
    if (!Array.isArray(masks)) masks = [masks];
  } catch {
    masks = [];
  }

  return new Response(
    JSON.stringify({
      data: {
        imageBase64: `data:${imageMime};base64,${imageBase64}`,
        imageMime,
        masks,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
