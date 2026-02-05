/**
 * POST /api/vision/analyze
 * "Clinical Eye" (Phase 2) Visual Diagnostics: bounding box detection and code execution.
 *
 * Student benefit: Trains the eye to spot pathologies in X-rays, ECGs, and derm photos
 * without "cheating" by reading the report. PANCE: Dermatology (4%), Musculoskeletal (8%).
 *
 * Cursor Implementation Plan (Phase 2):
 * 1. Bounding Box: Use Gemini to detect pathology; request box_2d / bounding_box [ymin, xmin, ymax, xmax] normalized 0-1000.
 * 2. Coordinate Mapping: Map Gemini 0-1000 to frontend image pixels via useBoundingBox (toCSS → top/left/width/height %, toPixels for overlay).
 * 3. Code Execution (ECGs): Enable tools: [{ code_execution: {} }] so the model uses Python (numpy/PIL) to compute R-R intervals and heart rate—no visual estimation.
 * Pedagogical note: Frontend should call analyze only after the student submits a guess; then show bounding box overlay.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
/** Gemini 3 Pro for best spatial understanding; fallback to gemini-2.5-pro if 3 not available. */
const VISION_MODEL = 'gemini-3-pro-preview';
const MAX_IMAGE_BASE64 = 4 * 1024 * 1024;

const AnalyzeBodySchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1),
    mimeType: z.string().optional().default('image/png'),
    /** Student question, e.g. "Where is the fracture?" Overrides default prompt when set. */
    studentQuery: z.string().min(1).max(2000).optional(),
    prompt: z.string().min(1).max(4096).optional().default('Detect the primary pathology. Return a JSON object with "diagnosis", "reasoning", and "bounding_box" as [ymin, xmin, ymax, xmax] normalized 0-1000.'),
    /** Set true for ECG images to enable code_execution (numpy/PIL for R-R intervals / HR). */
    isEcg: z.boolean().optional().default(false),
    /** Override model; default gemini-3-pro-preview (spatial). Use gemini-2.5-pro if 3 unavailable. */
    modelName: z.string().min(1).max(64).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

function parseVisionResponse(text: string): {
  diagnosis: string | undefined;
  reasoning: string | undefined;
  bounding_box: [number, number, number, number] | undefined;
} {
  let diagnosis: string | undefined;
  let reasoning: string | undefined;
  let bounding_box: [number, number, number, number] | undefined;
  try {
    const stripped = text.replaceAll(/```json|```/gi, '').trim();
    const parsed = JSON.parse(stripped) as {
      diagnosis?: string;
      reasoning?: string;
      bounding_box?: number[];
      box_2d?: number[];
    };
    diagnosis = parsed.diagnosis;
    reasoning = parsed.reasoning;
    const raw = parsed.bounding_box ?? parsed.box_2d;
    if (Array.isArray(raw) && raw.length >= 4) {
      const [ymin, xmin, ymax, xmax] = raw.map(Number);
      if (Number.isFinite(ymin) && Number.isFinite(xmin) && Number.isFinite(ymax) && Number.isFinite(xmax)) {
        bounding_box = [ymin, xmin, ymax, xmax];
      }
    }
  } catch {
    // optional parse
  }
  return { diagnosis, reasoning, bounding_box };
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(AnalyzeBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof AnalyzeBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/vision/analyze', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(env, identifier, 'gemini');
  if (rateLimitResponse) return rateLimitResponse;

  const { imageBase64, mimeType, studentQuery, prompt: defaultPrompt, isEcg, modelName: modelOverride } = validated.body;
  const modelName = modelOverride ?? VISION_MODEL;
  const prompt = studentQuery
    ? `${studentQuery}\n\nReturn a JSON object with "diagnosis", "reasoning", and "bounding_box" as [ymin, xmin, ymax, xmax] normalized 0-1000 for overlay.`
    : defaultPrompt;
  if (imageBase64.length > MAX_IMAGE_BASE64) {
    return new Response(JSON.stringify({ error: 'Image too large (max ~4MB base64)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };
  if (isEcg) requestBody.tools = [{ code_execution: {} }];

  const url = `${GEMINI_BASE}/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    log.warn('Vision analyze fetch error', { msg: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: 'Vision service unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    });
  }

  if (res.ok) {
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = parseVisionResponse(text);
    return new Response(
      JSON.stringify({
        data: {
          diagnosis: parsed.diagnosis,
          reasoning: parsed.reasoning,
          bounding_box: parsed.bounding_box,
          model: modelName,
          usageMetadata: data.usageMetadata,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  }

  const text = await res.text();
  log.warn('Vision Gemini error', { status: res.status, text: text.slice(0, 300) });
  return new Response(
    JSON.stringify({
      error: res.status === 429 ? 'Rate limit exceeded' : 'Analysis failed',
      details: text.slice(0, 500),
    }),
    {
      status: res.status === 429 ? 429 : 502,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    }
  );
});
