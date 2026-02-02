/**
 * GET /api/osce/live-config
 * Returns config needed for the client to connect to Gemini Live (model, wsUrl, apiKey).
 * Auth'd. Uses ephemeral tokens: server calls Gemini v1alpha auth_tokens create, returns
 * short-lived token name to client so GEMINI_API_KEY never touches the browser.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

/** Default: 1 min to start a new Live session; 30 min to send messages over the connection. */
const NEW_SESSION_EXPIRE_MINUTES = 1;
const TOKEN_EXPIRE_MINUTES = 30;

const EmptySchema = z.object({});

interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context as { env: Env; auth: { userId: string } };
  const log = createEndpointLogger('/api/osce/live-config', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const now = Date.now();
  const newSessionExpireTime = new Date(now + NEW_SESSION_EXPIRE_MINUTES * 60 * 1000).toISOString();
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
      log.warn('Gemini auth_tokens create failed', { status: res.status, body: text.slice(0, 200) });
      return new Response(
        JSON.stringify({
          error: 'Failed to create Live session token',
          details: res.status === 401 ? 'Invalid or missing Gemini API key' : undefined,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = (await res.json()) as { name?: string };
    ephemeralTokenName = data?.name ?? '';
    if (!ephemeralTokenName) {
      log.warn('Gemini auth_tokens response missing name', { keys: Object.keys(data || {}) });
      return new Response(
        JSON.stringify({ error: 'Invalid token response from Live API' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err) {
    log.error('Gemini auth_tokens request error', err);
    return new Response(
      JSON.stringify({
        error: 'Live session token service unavailable',
        details: err instanceof Error ? err.message : 'Unknown',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      data: {
        model: LIVE_MODEL,
        wsUrl: WS_URL,
        apiKey: ephemeralTokenName,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}, { source: 'query' });
