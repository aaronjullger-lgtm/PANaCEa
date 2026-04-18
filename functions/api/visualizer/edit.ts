/**
 * POST /api/visualizer/edit
 * Conversational image editing (Nano Banana / Gemini image model).
 * Body: { imageBase64, mimeType, userPrompt, thoughtSignature? }.
 * Returns { imageBase64, imageMime, thoughtSignature? }.
 * Send previous turn thoughtSignature to maintain visual consistency.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const EditBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().max(64).optional().default('image/png'),
  userPrompt: z.string().min(1).max(2000),
  thoughtSignature: z.string().max(10000).optional(),
});

type GeminiPart = { text?: string; inlineData?: { mimeType?: string; data?: string } };

function parseEditResponse(
  parts: GeminiPart[],
  fallbackMime: string,
  fallbackSignature?: string
): { imageBase64: string | null; imageMime: string; thoughtSignature?: string } {
  let imageBase64: string | null = null;
  let imageMime = fallbackMime;
  let thoughtSignature: string | undefined = fallbackSignature;
  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      imageMime = part.inlineData.mimeType || fallbackMime;
    }
    if (part.text) {
      try {
        const parsed = JSON.parse(part.text) as { thoughtSignature?: string };
        if (parsed.thoughtSignature) thoughtSignature = parsed.thoughtSignature;
      } catch {
        // keep previous
      }
    }
  }
  return { imageBase64, imageMime, thoughtSignature };
}

interface Env {
  GEMINI_API_KEY: string;
  VISUALIZER_EDIT_MODEL?: string;
}

export const onRequestOptions = withCors();

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): conversational image
// editing via Gemini image model (Nano Banana / gemini-2.5-flash-image etc).
// Multimodal image-in/image-out — expensive. 25 rpm 'ai' bucket.
export const onRequestPost = aiEndpoint(EditBodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof EditBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/visualizer/edit', auth.userId);

  if (!env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const model = env.VISUALIZER_EDIT_MODEL || 'gemini-2.0-flash-exp';
  const { imageBase64, mimeType, userPrompt, thoughtSignature } = validated;

  const systemInstruction =
    (thoughtSignature?.length ?? 0) > 0
      ? `Maintain visual consistency with the previous edit. Previous turn signature (opaque token): ${thoughtSignature.slice(0, 500)}.`
      : 'You are editing a medical/anatomical image. Preserve composition and only change what the user asks for.';

  const userContent = `${systemInstruction}\n\nUser request: ${userPrompt}`;

  const geminiUrl = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const geminiBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, '') } },
          { text: userContent },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    log.warn('Gemini edit failed', { status: geminiRes.status, text: text.slice(0, 300) });
    return new Response(
      JSON.stringify({
        error: 'Image edit failed',
        details: env.VISUALIZER_EDIT_MODEL ? text.slice(0, 200) : 'Set VISUALIZER_EDIT_MODEL (e.g. gemini-2.5-flash-image or gemini-3-pro-image-preview) for conversational editing.',
      }),
      { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const geminiData = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };
  const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
  const parsed = parseEditResponse(parts, mimeType, thoughtSignature);

  if (!parsed.imageBase64) {
    return new Response(
      JSON.stringify({
        error: 'Model did not return an image. Try VISUALIZER_EDIT_MODEL=gemini-2.5-flash-image or gemini-3-pro-image-preview when available.',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      data: {
        imageBase64: `data:${parsed.imageMime};base64,${parsed.imageBase64}`,
        imageMime: parsed.imageMime,
        thoughtSignature: parsed.thoughtSignature ?? thoughtSignature ?? undefined,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
