/**
 * GET /api/osce/live
 *
 * OSCE Live Client bootstrap: one-shot config for voice-to-voice Gemini Live WebSocket.
 * Returns ephemeral token + wsUrl + model + systemInstruction + tools + speechConfig
 * so the client can connect to Gemini (wss://) and handle tool_call (get_vitals) + Session Resumption.
 *
 * Client flow:
 * 1. GET /api/osce/live (with auth) → receive data below.
 * 2. Connect WebSocket to data.wsUrl with ?key=data.apiKey (or Authorization: Token <apiKey>).
 * 3. Send first message: setup { model, systemInstruction, tools, generationConfig: { responseModalities, speechConfig }, sessionResumption: {} }.
 *    If reconnecting after WiFi drop, pass setup.sessionResumption.handle = stored sessionResumptionUpdate.newHandle.
 * 4. Stream PCM 16 kHz audio via realtimeInput.audio; receive serverContent (audio) and toolCall.
 * 5. On toolCall (get_vitals): GET /api/osce/session/:sessionId/vitals with auth, then send toolResponse with functionResponses[{ id, response: { vitals } }].
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const NEW_SESSION_EXPIRE_MINUTES = 1;
const TOKEN_EXPIRE_MINUTES = 30;

const DEFAULT_SYSTEM_INSTRUCTION = `You are a 55-year-old male patient named Marcus presenting with chest pain. You are scared and anxious. Be brief in your answers. If the student is empathetic and asks open-ended questions, open up about your symptoms and concerns. If they are rude or dismissive, shut down and give short answers. You are here to practice history-taking; stay in character as the patient. When asked about vitals or labs, use the get_vitals tool to retrieve the simulated values and report them naturally.`;

const getVitalsExample = {
  BP: '160/95',
  HR: 110,
  RR: 18,
  Temp: '98.6°F',
  O2Sat: 96,
  ECG: 'Sinus tachycardia, no ST elevation',
  Troponin: 'Negative',
  CK: 'Mildly elevated',
};

const QuerySchema = z.object({
  /** Optional: pass when reconnecting; client should send this as setup.sessionResumption.handle so Gemini restores "Patient" context. */
  sessionResumptionHandle: z.string().max(2000).optional(),
});

interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, auth, validated } = context as { env: Env; auth: { userId: string }; validated: z.infer<typeof QuerySchema> };
  const log = createEndpointLogger('/api/osce/live', auth.userId);

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
  let ephemeralTokenName: string;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newSessionExpireTime, expireTime, uses: 1 }),
    });
    if (!res.ok) {
      const text = await res.text();
      log.warn('Gemini auth_tokens create failed', { status: res.status, body: text.slice(0, 100) });
      return new Response(
        JSON.stringify({ error: 'Failed to create Live session token', details: res.status === 401 ? 'Invalid or missing Gemini API key' : text.slice(0, 200) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = (await res.json()) as { name?: string };
    ephemeralTokenName = data?.name ?? '';
    if (!ephemeralTokenName) {
      return new Response(JSON.stringify({ error: 'Invalid token response from Live API' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    log.error('Gemini auth_tokens request error', err);
    return new Response(
      JSON.stringify({ error: 'Live session token service unavailable', details: err instanceof Error ? err.message : 'Unknown' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tools = [
    {
      get_vitals: {
        description: 'Returns simulated vitals and labs for this patient. Call when the student asks about blood pressure, heart rate, labs, or other objective data.',
      },
    },
  ];

  return new Response(
    JSON.stringify({
      data: {
        model: LIVE_MODEL,
        wsUrl: WS_URL,
        apiKey: ephemeralTokenName,
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        tools,
        getVitalsExample,
        responseModalities: ['AUDIO'],
        speechConfig: { voiceName: 'Aoede' },
        /** Include in setup when reconnecting so the Patient remembers context (e.g. after WiFi drop). */
        sessionResumptionHandle: validated.sessionResumptionHandle ?? null,
        sessionResumptionHint: 'Store sessionResumptionUpdate.newHandle from server messages; on reconnect call GET /api/osce/live?sessionResumptionHandle=<handle> and pass handle in setup.sessionResumption.handle.',
        toolHandlingHint: 'On server toolCall for get_vitals, GET /api/osce/session/:sessionId/vitals (with auth) and send toolResponse with functionResponses[{ id, response: { vitals } }].',
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}, { source: 'query' });
