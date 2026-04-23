/**
 * GET /api/veo/status?operation=<operationName>
 * Poll Veo video generation status. When done, fetches video, uploads to storage, returns URL.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_STORAGE_BUCKET = 'medical-images';
const VEO_STORAGE_PREFIX = 'veo';
const VEO_ATLAS_PREFIX = 'veo/atlas';
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

interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RATE_LIMIT_KV?: KVNamespace;
}

/** Download video from Gemini URI (requires API key in header) */
async function downloadVideo(uri: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(uri, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Upload video to Supabase Storage. Optionally also upsert to atlas cache. */
async function uploadToSupabase(
  env: Env,
  buffer: ArrayBuffer,
  mimeType: string,
  atlasPreset?: string
): Promise<{ storagePath: string; storageUrl: string } | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const storagePath = `${VEO_STORAGE_PREFIX}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${VEO_STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );
  if (!res.ok) {
    console.warn('[Veo] Supabase upload failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${VEO_STORAGE_BUCKET}/${storagePath}`;

  // Atlas strategy: upsert to preset path for future cache hits
  if (atlasPreset && VALID_PRESETS.includes(atlasPreset as (typeof VALID_PRESETS)[number])) {
    const atlasPath = `${VEO_ATLAS_PREFIX}/${atlasPreset}.mp4`;
    const atlasRes = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/${VEO_STORAGE_BUCKET}/${atlasPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: buffer,
      }
    );
    if (!atlasRes.ok) {
      console.warn('[Veo] Atlas cache upsert failed', atlasPreset, atlasRes.status);
    }
  }

  return { storagePath, storageUrl };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCodePoint(b);
  }
  return btoa(binary);
}

const StatusQuerySchema = z.object({});

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): polls Gemini Veo
// long-running operation, downloads video on completion, uploads to Supabase.
// Same 'ai' bucket as veo/generate since they share a session lifecycle.
export const onRequestGet = aiEndpoint(
  StatusQuerySchema,
  async (context) => {
    const { request, env, auth } = context as {
      request: Request;
      env: Env;
      auth: { userId: string };
    };
    const log = createEndpointLogger('/api/veo/status', auth.userId);

    const url = new URL(request.url);
    const rawOp = url.searchParams.get('operation');
    if (!rawOp?.trim()) {
      return fail(ErrorCode.MISSING_PARAMETER, { message: 'Missing operation query parameter' });
    }
    // Sanitize: allow only alphanumeric, hyphens, underscores, slashes (Gemini op format)
    const operationName = rawOp.replace(/^\/*/, '').trim();
    if (!operationName || /\.\.|[<>"']/.test(operationName)) {
      return fail(ErrorCode.VALIDATION_FAILED, { message: 'Invalid operation parameter' });
    }

    const preset = url.searchParams.get('preset');
    const atlasPreset =
      preset?.trim() && VALID_PRESETS.includes(preset.trim() as (typeof VALID_PRESETS)[number])
        ? preset.trim()
        : undefined;

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const identifier = getRateLimitIdentifier(request, auth.userId);
    const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
      env as { RATE_LIMIT_KV?: KVNamespace },
      identifier,
      'veo'
    );
    if (rateLimitResponse) return rateLimitResponse;

    const apiKey = env.GEMINI_API_KEY;
    const opUrl = `${GEMINI_BASE}/${operationName.replace(/^\//, '')}?key=${apiKey}`;

    const res = await fetch(opUrl);
    if (!res.ok) {
      const text = await res.text();
      log.warn('Veo status fetch failed', { status: res.status, text: text.slice(0, 200) });
      return fail(ErrorCode.GEMINI_ERROR, {
        message: 'Failed to get operation status',
        details: text.slice(0, 300),
        headers: rateLimitHeaders as Record<string, string>,
      });
    }

    const data = (await res.json()) as {
      done?: boolean;
      error?: { code?: number; message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
        };
      };
    };

    const rlHeaders = rateLimitHeaders as Record<string, string>;

    if (data.error) {
      return ok(
        { status: 'failed', error: data.error.message || 'Video generation failed' },
        { headers: rlHeaders }
      );
    }

    if (!data.done) {
      return ok(
        { status: 'pending', message: 'Video generation in progress. Poll again in 10–15 seconds.', pollIntervalSeconds: 12 },
        { headers: { 'Cache-Control': 'no-store, no-cache', 'Retry-After': '12', ...rlHeaders } }
      );
    }

    const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      return ok({ status: 'failed', error: 'No video in completed response' }, { headers: rlHeaders });
    }

    try {
      const buffer = await downloadVideo(videoUri, apiKey);
      const mimeType = 'video/mp4';

      const uploadResult = await uploadToSupabase(env, buffer, mimeType, atlasPreset);

      if (uploadResult) {
        return ok(
          { status: 'ready', videoUrl: uploadResult.storageUrl, disclaimer: 'AI-generated for education. Verify with clinical reference.' },
          { headers: { 'Cache-Control': 'private, max-age=3600', ...rlHeaders } }
        );
      }

      const base64 = arrayBufferToBase64(buffer);
      const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
      if (buffer.byteLength > 8 * 1024 * 1024) {
        log.warn('Video too large for inline response', { sizeMB });
        return ok(
          { status: 'ready', error: 'Video generated but storage not configured. Configure Supabase for video URLs.', videoBase64: null },
          { headers: rlHeaders }
        );
      }

      return ok(
        { status: 'ready', videoBase64: `data:${mimeType};base64,${base64}`, mimeType, disclaimer: 'AI-generated for education. Verify with clinical reference.' },
        { headers: rlHeaders }
      );
    } catch (error_) {
      log.error('Veo video download/upload error', error_);
      return ok({ status: 'failed', error: 'Failed to retrieve or store video' }, { headers: rlHeaders });
    }
  },
  { source: 'query' }
);
