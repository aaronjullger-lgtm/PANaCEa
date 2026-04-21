/**
 * GET /api/osce/live-config
 * Phase 4: Simulated Patient (OSCE) — config for voice-to-voice Gemini Live WebSocket.
 *
 * Student benefit: Real-time voice practice for history taking; tests soft skills and
 * efficiency. PANCE: History Taking (16%). Latency kills immersion; WebSocket + native
 * audio avoids text round-trip.
 *
 * Cursor Implementation Plan (Phase 4):
 * 1. Protocol: Client uses WebSocket (not REST) to connect to Gemini Live (BidiGenerateContent).
 * 2. Audio: Stream raw 16 kHz PCM bi-directionally; do not transcode to text first (adds latency).
 * 3. Barge-in: Model handles interruptions natively; if the student speaks over the AI, the AI stops.
 * 4. Tech: Server returns ephemeral token + wsUrl + model; client connects to Gemini with token
 *    so GEMINI_API_KEY never touches the browser.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

/** Default: 1 min to start a new Live session; 30 min to send messages over the connection. */
const NEW_SESSION_EXPIRE_MINUTES = 1;
const TOKEN_EXPIRE_MINUTES = 30;

const EmptySchema = z.object({});

interface Env {
  GEMINI_API_KEY: string;
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): mints ephemeral
// auth token for client-to-Gemini Live WebSocket (voice-to-voice OSCE).
// 25 rpm 'ai' bucket.
export const onRequestGet = aiEndpoint(
  EmptySchema,
  async (context) => {
    const { env, auth } = context as { env: Env; auth: { userId: string } };
    const log = createEndpointLogger('/api/osce/live-config', auth.userId);

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const now = Date.now();
    const newSessionExpireTime = new Date(
      now + NEW_SESSION_EXPIRE_MINUTES * 60 * 1000
    ).toISOString();
    const expireTime = new Date(now + TOKEN_EXPIRE_MINUTES * 60 * 1000).toISOString();

    const url = `${GEMINI_BASE}/v1alpha/auth_tokens?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const body = {
      newSessionExpireTime,
      expireTime,
      uses: 1,
    };

    let ephemeralTokenName: string;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        log.warn('Gemini auth_tokens create failed', {
          status: res.status,
          body: text.slice(0, 200),
        });
        return fail(ErrorCode.GEMINI_ERROR, {
          message: res.status === 401
            ? 'Invalid or missing Gemini API key'
            : 'Failed to create Live session token',
        });
      }
      const data = (await res.json()) as { name?: string };
      ephemeralTokenName = data?.name ?? '';
      if (!ephemeralTokenName) {
        log.warn('Gemini auth_tokens response missing name', { keys: Object.keys(data || {}) });
        return fail(ErrorCode.GEMINI_ERROR, { message: 'Invalid token response from Live API' });
      }
    } catch (err) {
      log.error('Gemini auth_tokens request error', err);
      return fail(ErrorCode.GEMINI_ERROR, {
        message: err instanceof Error ? err.message : 'Live session token service unavailable',
      });
    }

    return ok({
      model: LIVE_MODEL,
      wsUrl: WS_URL,
      apiKey: ephemeralTokenName,
      /** Session Resumption: store sessionResumptionUpdate.newHandle; pass as setup.sessionResumption.handle on reconnect. */
      sessionResumptionHint:
        'Store sessionResumptionUpdate.newHandle from server messages; pass as setup.sessionResumption.handle when reconnecting.',
    });
  },
  { source: 'query' }
);
