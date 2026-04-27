/**
 * POST /api/veo/generate
 * Generate short clinical videos (e.g. gait, movement) via Veo.
 * Body: { prompt: string, durationSeconds?: number }.
 * Returns { videoUrl? } or { jobId? } for async polling.
 * Set VEO_ENABLED and Vertex AI credentials to enable.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

const VALID_PRESETS = [
  'parkinsonian_gait',
  'cerebellar_ataxia',
  'antalgic_gait',
  'hemiplegic_gait',
  'tonic_clonic_seizure',
  'syncope_presyncope',
  'resting_tremor',
  'waddling_gait',
  'steppage_gait',
  'normal_gait',
] as const;

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-2.0-generate-001';
const VEO_ATLAS_PREFIX = 'veo/atlas';
const MAX_PROMPT_LENGTH = 2000;
const PRESET_PROMPTS: Record<(typeof VALID_PRESETS)[number], string> = {
  parkinsonian_gait: 'Clinical education video showing a Parkinsonian gait pattern.',
  cerebellar_ataxia: 'Clinical education video showing cerebellar ataxic gait.',
  antalgic_gait: 'Clinical education video showing an antalgic gait pattern.',
  hemiplegic_gait: 'Clinical education video showing a hemiplegic gait pattern.',
  tonic_clonic_seizure: 'Clinical education video showing a tonic-clonic seizure presentation.',
  syncope_presyncope: 'Clinical education video showing syncope and presyncope presentation.',
  resting_tremor: 'Clinical education video showing a resting tremor.',
  waddling_gait: 'Clinical education video showing a waddling gait pattern.',
  steppage_gait: 'Clinical education video showing a steppage gait pattern.',
  normal_gait: 'Clinical education video showing a normal gait pattern.',
};

const GenerateBodySchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_LENGTH).optional(),
  preset: z.enum(VALID_PRESETS).optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional(),
  negativePrompt: z.string().max(1000).optional(),
  durationSeconds: z.number().min(1).max(30).optional().default(5),
});

/** Check if a preset video exists in the Atlas cache (Supabase). */
async function checkAtlasCache(env: Env, preset: string): Promise<string | null> {
  if (!env.SUPABASE_URL || !VALID_PRESETS.includes(preset as (typeof VALID_PRESETS)[number]))
    return null;
  const atlasPath = `${VEO_ATLAS_PREFIX}/${preset}.mp4`;
  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/medical-images/${atlasPath}`;
  const res = await fetch(publicUrl, { method: 'HEAD' });
  return res.ok ? publicUrl : null;
}

function resolvePrompt(body: z.infer<typeof GenerateBodySchema>): string {
  const custom = body.prompt?.trim();
  if (custom) return custom.slice(0, MAX_PROMPT_LENGTH);
  if (body.preset && body.preset in PRESET_PROMPTS) {
    return (PRESET_PROMPTS as Record<string, string>)[body.preset] ?? '';
  }
  return (PRESET_PROMPTS.parkinsonian_gait as string) ?? '';
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): Gemini Veo video
// generation (long-running op). In addition to the advisory 25 rpm 'ai' bucket
// below, the endpoint keeps a stricter dedicated 'veo' rate-limiter inside the
// handler because Veo tokens are an order of magnitude more expensive than a
// standard Gemini text call.
export const onRequestPost = aiEndpoint(GenerateBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof GenerateBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/veo/generate', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  // Atlas strategy: if preset and cached, return immediately (no Veo call, no rate-limit consumption)
  const preset = validated.preset;
  if (preset) {
    const cachedUrl = await checkAtlasCache(env, preset);
    if (cachedUrl) {
      log.info('Veo atlas cache hit', { preset });
      return ok(
        {
          status: 'ready',
          videoUrl: cachedUrl,
          preset,
          fromCache: true,
          disclaimer: 'AI-generated for education. Verify with clinical reference.',
        },
        { headers: { 'Cache-Control': 'private, max-age=86400' } }
      );
    }
  }

  const identifier = getRateLimitIdentifier(request, auth.userId);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'veo'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const prompt = resolvePrompt(validated);
  const apiKey = env.GEMINI_API_KEY;
  const url = `${GEMINI_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio: validated.aspectRatio,
      durationSeconds: validated.durationSeconds,
      negativePrompt: validated.negativePrompt,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      log.warn('Veo predictLongRunning error', { status: res.status, text: text.slice(0, 300) });
      return fail(
        res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.GEMINI_ERROR,
        {
          message: res.status === 429 ? 'Rate limit exceeded' : 'Failed to start video generation',
          details: text.slice(0, 500),
          headers: rateLimitHeaders as Record<string, string>,
        }
      );
    }

    const data = (await res.json()) as { name?: string };
    const rawName = data.name;
    const operationName =
      typeof rawName === 'string' && rawName.length > 0 && !/[\0<>"']/.test(rawName)
        ? rawName.trim()
        : null;

    if (!operationName) {
      return fail(ErrorCode.GEMINI_ERROR, {
        message: 'No operation name in Veo response',
        headers: rateLimitHeaders as Record<string, string>,
      });
    }

    log.info('Veo generation started', { operationName, preset: validated.preset });

    const pollUrl = preset
      ? `/api/veo/status?operation=${encodeURIComponent(operationName)}&preset=${encodeURIComponent(preset)}`
      : `/api/veo/status?operation=${encodeURIComponent(operationName)}`;

    return ok(
      {
        operationName,
        preset: preset ?? undefined,
        status: 'pending',
        pollUrl,
        message: 'Video generation started. Poll the status URL for result.',
      },
      {
        status: 202,
        headers: { 'Cache-Control': 'no-store', ...(rateLimitHeaders as Record<string, string>) },
      }
    );
  } catch (err) {
    log.error('Veo generate error', err);
    return fail(ErrorCode.INTERNAL_ERROR, { message: 'Internal server error' });
  }
});
