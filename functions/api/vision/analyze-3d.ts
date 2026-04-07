/**
 * POST /api/vision/analyze-3d
 * 3D spatial bounding boxes for anatomy: infer depth, orientation, volume from 2D images.
 * Returns a list of { label, box_3d } where box_3d is [x_center, y_center, z_center, x_size, y_size, z_size, roll, pitch, yaw].
 * Frontend must render via 3D canvas (e.g. Three.js / React Three Fiber), not a 2D div overlay.
 * See docs/implementation/3D_SPATIAL_BOUNDING_BOXES.md.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';
import { callGemini, GeminiModel } from '../_shared/ai-service';
const MAX_IMAGE_BASE64 = 4 * 1024 * 1024;

const BOX_3D_PROMPT = `
Output a JSON list where each entry contains "label" and "box_3d".
The 3D bounding box format must be: [x_center, y_center, z_center, x_size, y_size, z_size, roll, pitch, yaw].
Use meters or normalized 0-1 units consistently; state which in a single "units" field at the top level if needed.
`;

const Analyze3DBodySchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1),
    mimeType: z.string().optional().default('image/png'),
    /** Optional list of structures to detect (e.g. ["femur", "tibia"]). If omitted, model chooses anatomical structures. */
    labels: z.array(z.string().min(1).max(64)).max(20).optional(),
    /** Override the detection prompt; must still request JSON list with "label" and "box_3d". */
    prompt: z.string().min(1).max(4096).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

type Box3D = [number, number, number, number, number, number, number, number, number];

function parse3DResponse(text: string): Array<{ label: string; box_3d: Box3D }> {
  const results: Array<{ label: string; box_3d: Box3D }> = [];
  try {
    const stripped = text.replaceAll(/```json|```/gi, '').trim();
    const parsed = JSON.parse(stripped) as
      | Array<{ label?: string; box_3d?: unknown }>
      | { boxes?: Array<{ label?: string; box_3d?: unknown }>; units?: string };
    const list = Array.isArray(parsed) ? parsed : (parsed?.boxes ?? []);
    for (const item of list) {
      const label = typeof item.label === 'string' ? item.label : 'unknown';
      const raw = item.box_3d;
      if (!Array.isArray(raw) || raw.length < 9) continue;
      const nums = raw.slice(0, 9).map(Number);
      if (nums.every(Number.isFinite)) {
        results.push({ label, box_3d: nums as Box3D });
      }
    }
  } catch {
    // return empty on parse error
  }
  return results;
}

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(Analyze3DBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof Analyze3DBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/vision/analyze-3d', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env,
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { imageBase64, mimeType, labels, prompt: customPrompt } = validated.body;
  if (imageBase64.length > MAX_IMAGE_BASE64) {
    return new Response(JSON.stringify({ error: 'Image too large (max ~4MB base64)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const structureList = labels?.length
    ? labels.join(', ')
    : 'anatomical structures visible in the image (e.g. femur, tibia, talus)';
  const prompt = customPrompt ?? `Detect the following: ${structureList}. ${BOX_3D_PROMPT}`.trim();

  try {
    const result = await callGemini({ env }, {
      model: GeminiModel.PRO_2_5,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      endpoint: '/api/vision/analyze-3d',
    });

    const boxes = parse3DResponse(result.text);
    return new Response(
      JSON.stringify({
        data: {
          boxes,
          usageMetadata: result.usage,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const errMsg = (err as { error?: string })?.error ?? 'Unknown error';
    log.warn('Vision 3D Gemini error', { status, error: errMsg });
    return new Response(
      JSON.stringify({
        error: status === 429 ? 'Rate limit exceeded' : '3D analysis failed',
      }),
      {
        status: status === 429 ? 429 : 502,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
      }
    );
  }
});
