/**
 * GET /api/osce/live-session-config
 * Phase 4: Simulated Patient (OSCE) — system instruction, tools, and speech config for Live.
 *
 * Objective: Voice conversation with "Marcus" (55yo male, chest pain, anxious/evasive).
 * When the student asks "What were your labs?", the model calls get_vitals; client
 * returns JSON (e.g. BP, HR) and the AI reads it naturally.
 *
 * Cursor Implementation Plan (Phase 4):
 * - response_modalities: ["AUDIO"]
 * - speech_config: voice_name "Aoede" (Conversational)
 * - System instruction: 55yo male, chest pain, scared, brief; empathetic → open up, rude → shut down.
 * - Tool: get_vitals() — returns JSON { BP, HR, ... }; client wires to GET /api/osce/session/:id/vitals or mock.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuerySchema = z.object({
  caseId: z.string().optional(),
});

const DEFAULT_SYSTEM_INSTRUCTION = `You are a 55-year-old male patient named Marcus presenting with chest pain. You are scared and anxious. Be brief in your answers. If the student is empathetic and asks open-ended questions, open up about your symptoms and concerns. If they are rude or dismissive, shut down and give short answers. You are here to practice history-taking; stay in character as the patient. When asked about vitals or labs, use the get_vitals tool to retrieve the simulated values and report them naturally.`;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { auth } = context as { auth: { userId: string } };
  const log = createEndpointLogger('/api/osce/live-session-config', auth.userId);

  /** Tool for simulated vitals. Gemini Live may expect snake_case (get_vitals); client sends as functionDeclarations. */
  const tools = [
    {
      get_vitals: {
        description: 'Returns simulated vitals and labs for this patient. Call when the student asks about blood pressure, heart rate, labs, or other objective data.',
      },
    },
  ];

  /** get_vitals() return shape: client uses this to respond to tool calls or mock. */
  const getVitalsResult = {
    BP: '160/95',
    HR: 110,
    RR: 18,
    Temp: '98.6°F',
    O2Sat: 96,
    ECG: 'Sinus tachycardia, no ST elevation',
    Troponin: 'Negative',
    CK: 'Mildly elevated',
  };

  log.info('Live session config requested');
  return new Response(
    JSON.stringify({
      data: {
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        tools,
        /** Example response for get_vitals (client calls GET /api/osce/session/:sessionId/vitals and sends toolResponse with this shape). */
        getVitalsExample: getVitalsResult,
        responseModalities: ['AUDIO'],
        speechConfig: { voiceName: 'Aoede' },
        /** Include in first setup message to receive sessionResumptionUpdate; on reconnect pass stored newHandle as sessionResumption.handle so the Patient remembers context after WiFi drop. */
        sessionResumption: {},
        /** Client flow: on toolCall (get_vitals), GET /api/osce/session/:sessionId/vitals with auth, then send toolResponse with functionResponses[{ id, response: { vitals: {...} } }] to Gemini. */
        toolHandlingHint: 'On server toolCall for get_vitals, fetch GET /api/osce/session/:sessionId/vitals and send toolResponse with matching id.',
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}, { source: 'query' });
