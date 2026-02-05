/**
 * GET /api/osce/live-engine
 * Hyper-Real OSCE: Unified config for Live API (Voice + Text, dynamic persona, tools).
 * Returns setup (system instruction, tools get_current_vitals, reveal_lab_result) and
 * optionally an ephemeral token for client-to-Gemini WebSocket.
 *
 * Client connects to wss://generativelanguage.googleapis.com/ws/.../BidiGenerateContent
 * with token (or key for dev), sends setup first, then realtimeInput (audio) and
 * clientContent (text) in the same session. Barge-in: clientContent interrupts model.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_WS_PATH =
  'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const LIVE_MODEL = 'gemini-2.0-flash-exp';

const QuerySchema = z.object({
  caseId: z.string().optional(),
  sessionId: z.string().optional(),
  patientName: z.string().optional(),
  painLevel: z.number().min(0).max(10).optional(),
  mood: z.string().optional(),
});

/** Dynamic persona: pain and mood shift based on student empathy. */
function buildSystemInstruction(params: {
  patientName?: string;
  painLevel?: number;
  mood?: string;
}): string {
  const name = params.patientName ?? 'Marcus';
  const pain = params.painLevel ?? 8;
  const mood = params.mood ?? 'Anxious';
  return `You are ${name}, a patient in an OSCE encounter. Current Pain: ${pain}/10. Mood: ${mood}.
If the student validates your pain and shows empathy, lower Pain to 5/10 and Mood to 'Cooperative'.
If they ignore your concerns or are dismissive, raise Mood to 'Hostile' and keep Pain high.
Stay in character. When asked about vitals or labs, use get_current_vitals() or reveal_lab_result(test_name) and report the results naturally (e.g. "I think it's high, doc... 180 over 110.").
Keep answers brief and patient-like.`;
}

/** Tools: vitals and lab reveal for simulated encounter. */
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_current_vitals',
        description:
          'Returns current simulated vitals for this patient (BP, HR, RR, Temp, O2). Call when the student asks about blood pressure, heart rate, vitals, or vital signs.',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'reveal_lab_result',
        description:
          'Returns a specific lab result by test name. Call when the student asks about a particular lab (e.g. troponin, CBC, BMP).',
        parameters: {
          type: 'object',
          properties: {
            test_name: { type: 'string', description: 'Lab test name (e.g. Troponin, CBC, BMP)' },
          },
          required: ['test_name'],
        },
      },
    ],
  },
];

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/osce/live-engine');

  try {
    const systemInstruction = buildSystemInstruction({
      patientName: validated.patientName,
      painLevel: validated.painLevel,
      mood: validated.mood,
    });

    const setup = {
      model: `models/${LIVE_MODEL}`,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        responseModalities: ['AUDIO', 'TEXT'],
        speechConfig: { voiceName: 'Aoede' },
        temperature: 0.8,
      },
      tools: TOOLS,
      realtimeInputConfig: {
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS', // Barge-in enabled
      },
    };

    let token: string | null = null;
    const now = new Date();
    const expireTime = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now.getTime() + 60 * 1000).toISOString();

    try {
      const createTokenUrl = `https://generativelanguage.googleapis.com/v1beta/authTokens:createToken?key=${env.GEMINI_API_KEY}`;
      const tokenRes = await fetch(createTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authToken: {
            expireTime,
            newSessionExpireTime,
          },
          uses: 1,
        }),
      });
      if (tokenRes.ok) {
        const data = (await tokenRes.json()) as { name?: string };
        token = data.name ?? null;
      }
    } catch (e) {
      logger.warn('Ephemeral token creation failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const wsBase = 'wss://generativelanguage.googleapis.com/ws';
    const wsUrl = token
      ? `${wsBase}/${GEMINI_WS_PATH}?access_token=${encodeURIComponent(token)}`
      : `${wsBase}/${GEMINI_WS_PATH}?key=${env.GEMINI_API_KEY}`;

    logger.info('Live engine config requested', { sessionId: validated.sessionId });

    return new Response(
      JSON.stringify({
        data: {
          wsUrl,
          setup,
          sessionId: validated.sessionId ?? null,
          tokenUsed: !!token,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('live-engine error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId?.substring(0, 10),
    });
    throw new Error('Failed to get live engine config');
  }
}, { source: 'query' });
