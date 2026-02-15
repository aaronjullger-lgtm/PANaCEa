/**
 * POST /api/veo/generate
 * Clinical Motion Flashcards – Start Veo video generation.
 *
 * Accepts a text prompt (or preset pathology key), calls Gemini Veo API,
 * returns an operation ID for polling. See VEO_CLINICAL_MOTION_SPEC.md.
 *
 * Safety: AI-generated for education only. Verify with clinical reference.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.1-generate-preview';
const MAX_PROMPT_LENGTH = 1024;
const VEO_ATLAS_PREFIX = 'veo/atlas';

/**
 * Medically accurate, detailed prompts for clinical education.
 * Maps simple preset keys to highly specific Veo prompts to improve accuracy.
 */
const PRESET_PROMPTS: Record<string, string> = {
  parkinsonian_gait:
    'Cinematic, photorealistic video of an elderly patient walking. Medical focus: stooped posture, reduced arm swing, festinating gait (small shuffling steps that speed up), and pill-rolling tremor in right hand. Neutral hospital hallway background.',
  cerebellar_ataxia:
    'Cinematic, photorealistic video of a middle-aged patient walking. Medical focus: wide-based, staggering gait; heel-to-shin dysmetria; inability to walk tandem; truncal ataxia. Clinic setting.',
  antalgic_gait:
    'Cinematic, photorealistic video of an adult patient walking with a limp. Medical focus: shortened stance phase on the affected (right) leg; weight shifted away from pain; decreased time on affected side. Clinic corridor.',
  hemiplegic_gait:
    'Cinematic, photorealistic video of a patient post-stroke walking. Medical focus: circumduction of the affected leg (swinging leg outward in arc); foot drop; arm flexed and adducted on affected side. Rehabilitation setting.',
  tonic_clonic_seizure:
    'Cinematic, photorealistic video simulating a generalized tonic-clonic seizure. Medical focus: sudden loss of consciousness; tonic phase with rigidity; clonic phase with rhythmic jerking of limbs; duration ~30 seconds. Hospital bed, educational context.',
  syncope_presyncope:
    'Cinematic, photorealistic video of a patient demonstrating presyncope. Medical focus: gradual loss of postural tone; slumping; pallor; slow collapse rather than sudden drop. Clinic room.',
  resting_tremor:
    'Cinematic, photorealistic video of an elderly patient at rest. Medical focus: pill-rolling tremor of both hands (thumb and fingers); tremor at rest, diminishes with purposeful movement. Neutral background.',
  waddling_gait:
    'Cinematic, photorealistic video of a patient with bilateral hip weakness walking. Medical focus: waddling, Trendelenburg gait; lateral trunk shift over stance leg; duck-like walk. Clinic setting.',
  steppage_gait:
    'Cinematic, photorealistic video of a patient with foot drop walking. Medical focus: high-stepping gait; excessive hip and knee flexion to clear the toes; foot slap on landing. Neutral hallway.',
  normal_gait:
    'Cinematic, photorealistic video of a healthy adult walking normally. Medical education reference: symmetrical arm swing, heel-to-toe stride, normal base width. Neutral hallway, for comparison with pathological gaits.',
};

const GenerateBodySchema = z.object({
  /** Custom prompt or preset key from PRESET_PROMPTS */
  prompt: z.string().min(1).max(MAX_PROMPT_LENGTH).optional(),
  /** Preset pathology key (e.g. parkinsonian_gait). Ignored if prompt is provided. */
  preset: z
    .enum([
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
    ])
    .optional(),
  /** Aspect ratio: 16:9 (default) or 9:16 */
  aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9'),
  /** Duration: 4, 6, or 8 seconds */
  durationSeconds: z.enum(['4', '6', '8']).optional().default('8'),
  /** Negative prompt – elements to avoid */
  negativePrompt: z
    .string()
    .max(500)
    .optional()
    .default('cartoon, animated, low quality, unrealistic'),
});

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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateBodySchema, async (context) => {
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
      return new Response(
        JSON.stringify({
          data: {
            status: 'ready',
            videoUrl: cachedUrl,
            preset,
            fromCache: true,
            disclaimer: 'AI-generated for education. Verify with clinical reference.',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=86400',
          },
        }
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
      return new Response(
        JSON.stringify({
          error: res.status === 429 ? 'Rate limit exceeded' : 'Failed to start video generation',
          details: text.slice(0, 500),
        }),
        {
          status: res.status === 429 ? 429 : 502,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
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
      return new Response(JSON.stringify({ error: 'No operation name in Veo response' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
      });
    }

    log.info('Veo generation started', { operationName, preset: validated.preset });

    const pollUrl = preset
      ? `/api/veo/status?operation=${encodeURIComponent(operationName)}&preset=${encodeURIComponent(preset)}`
      : `/api/veo/status?operation=${encodeURIComponent(operationName)}`;

    return new Response(
      JSON.stringify({
        data: {
          operationName,
          preset: preset ?? undefined,
          status: 'pending',
          pollUrl,
          message: 'Video generation started. Poll the status URL for result.',
        },
      }),
      {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...rateLimitHeaders,
        },
      }
    );
  } catch (err) {
    log.error('Veo generate error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
