/**
 * live-engine orchestrator strategy.
 *
 * Wraps the GET /api/osce/live-engine flow (hyper-real OSCE: Gemini Live API
 * voice + text config with dynamic persona and ephemeral token minting) as a
 * registered orchestrator agent with typed input/output state and standard
 * logging. The endpoint delegates to `runLiveEngineFlow` — one source of truth.
 *
 * @module lib/agents/strategies/liveEngineStrategy
 */

import { z } from 'zod';
import type { AgentDefinition } from '../shared/types';
import { registerAgent } from '../shared/runtime';
import type { FlowLogger } from './shared';
import { loggerFrom } from './shared';

const GEMINI_WS_PATH = 'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const LIVE_MODEL = 'gemini-2.0-flash-exp';
const TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_NEW_SESSION_TTL_MS = 60 * 1000;

// ─── Typed input/output state ──────────────────────────────────────────────

export const LiveEngineInputSchema = z.object({
  caseId: z.string().optional(),
  sessionId: z.string().optional(),
  patientName: z.string().optional(),
  painLevel: z.number().min(0).max(10).optional(),
  mood: z.string().optional(),
  /** AV state voice modulation fields — injected into speechConfig and system prompt */
  voiceId: z.string().optional(),
  voiceRate: z.number().min(0.5).max(2.0).optional(),
  voicePitch: z.number().min(-12).max(12).optional(),
  toneDescriptors: z.string().optional(), // comma-separated
  vocalStrain: z.enum(['true', 'false']).optional(),
  clinicalContext: z.string().optional(),
});
export type LiveEngineInput = z.infer<typeof LiveEngineInputSchema>;

export interface LiveEngineSetup {
  model: string;
  systemInstruction: { parts: [{ text: string }] };
  generationConfig: {
    responseModalities: string[];
    speechConfig: Record<string, unknown>;
    temperature: number;
  };
  tools: { functionDeclarations: unknown[] }[];
  realtimeInputConfig: { activityHandling: string };
}

export interface LiveEngineFlowOutput {
  wsUrl: string | null;
  setup: LiveEngineSetup;
  sessionId: string | null;
  tokenUsed: boolean;
}

export const LiveEngineFlowOutputSchema = z.object({
  wsUrl: z.string().nullable(),
  setup: z.unknown(),
  sessionId: z.string().nullable(),
  tokenUsed: z.boolean(),
});
export type LiveEngineFlowOutputState = z.infer<typeof LiveEngineFlowOutputSchema>;

export interface LiveEngineFlowDeps {
  env: { GEMINI_API_KEY?: string };
  logger: FlowLogger;
}

// ─── Pure persona builders (ported from functions/api/osce/live-engine.ts) ─

/** Tools: vitals and lab reveal for simulated encounter. */
export const LIVE_ENGINE_TOOLS: { functionDeclarations: unknown[] }[] = [
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

/**
 * Dynamic persona: pain and mood shift based on student empathy,
 * with voice modulation directives from the AV state machine.
 */
export function buildSystemInstruction(params: {
  patientName?: string;
  painLevel?: number;
  mood?: string;
  toneDescriptors?: string[];
  vocalStrain?: boolean;
  clinicalContext?: string;
  voiceRate?: number;
}): string {
  const name = params.patientName ?? 'Marcus';
  const pain = params.painLevel ?? 8;
  const mood = params.mood ?? 'Anxious';

  // Voice modulation directives from AV engine
  let voiceDirective = '';
  if (params.toneDescriptors?.length) {
    voiceDirective += ` Speak in a ${params.toneDescriptors.join(', ')} tone.`;
  }
  if (params.vocalStrain) {
    voiceDirective += ' Your voice is strained — pause occasionally to catch your breath or wince in pain.';
  }
  if (params.voiceRate != null && params.voiceRate < 0.8) {
    voiceDirective += ' Speak slowly and deliberately.';
  } else if (params.voiceRate != null && params.voiceRate > 1.3) {
    voiceDirective += ' Speak rapidly, as if rushed or panicked.';
  }
  if (params.clinicalContext) {
    voiceDirective += ` Clinical state: ${params.clinicalContext}.`;
  }

  return `You are ${name}, a patient in an OSCE encounter. Current Pain: ${pain}/10. Mood: ${mood}.${voiceDirective}

BEHAVIOR RULES:
1. STAY IN CHARACTER as the patient at all times. Speak in first person ("I feel..."). Do not volunteer information unless specifically asked.
2. EMPATHY RESPONSE: If the student validates your pain and shows empathy, lower Pain to 5/10 and Mood to 'Cooperative'. If they ignore your concerns or are dismissive, raise Mood to 'Hostile' and keep Pain high.
3. LAY LANGUAGE: Answer all questions in your own words using everyday language. Never use medical terminology unless the student has already asked clarifying questions about your symptoms (location, character, severity, timing, etc.). For example:
   - Say "it hurts in my chest" NOT "substernal chest pain"
   - Say "it feels like pressure" NOT "crushing sensation"
   - Say "it comes and goes" NOT "intermittent"
   You should sound like a real person, not a medical textbook.
4. PHYSICAL EXAMS: If the student says they want to examine you, return ONLY the findings for the SPECIFIC body system they named.
   - "Listen to the heart" → only cardiac findings
   - "Examine the abdomen" → only abdominal findings
   - If they say only "I do a physical exam" or "full exam" without specifying which body part, respond: "Sure, what part would you like to check? My heart, lungs, belly...?"
   Do NOT reveal findings from other body systems.
5. VITALS AND LABS: When asked about vitals or labs, use get_current_vitals() or reveal_lab_result(test_name) and report the results naturally in lay terms (e.g. "I think it's high, doc... 180 over 110.").
6. Keep answers brief and patient-like. Do NOT reveal the diagnosis or hint at the "correct" answer.`;
}

/** Build the Gemini Live API `setup` payload from a persona instruction and AV voice config. */
export function buildLiveEngineSetup(opts: {
  systemInstruction: string;
  speechConfig: Record<string, unknown>;
}): LiveEngineSetup {
  return {
    model: `models/${LIVE_MODEL}`,
    systemInstruction: {
      parts: [{ text: opts.systemInstruction }],
    },
    generationConfig: {
      responseModalities: ['AUDIO', 'TEXT'],
      speechConfig: opts.speechConfig,
      temperature: 0.8,
    },
    tools: LIVE_ENGINE_TOOLS,
    realtimeInputConfig: {
      activityHandling: 'START_OF_ACTIVITY_INTERRUPTS', // Barge-in enabled
    },
  };
}

// ─── Flow (single source of truth for the endpoint and the agent) ──────────

/**
 * Run the live-engine flow: build the dynamic persona system instruction and
 * Live API setup, mint an ephemeral token, and return the WebSocket URL.
 * Returns `tokenUsed: false` (and `wsUrl: null`) when token minting fails —
 * callers decide how to surface that (the endpoint returns 503).
 */
export async function runLiveEngineFlow(
  input: LiveEngineInput,
  deps: LiveEngineFlowDeps,
): Promise<LiveEngineFlowOutput> {
  const toneDescriptors = input.toneDescriptors
    ? input.toneDescriptors.split(',').map((t: string) => t.trim()).filter(Boolean)
    : undefined;

  const systemInstruction = buildSystemInstruction({
    patientName: input.patientName,
    painLevel: input.painLevel,
    mood: input.mood,
    toneDescriptors,
    vocalStrain: input.vocalStrain === 'true',
    clinicalContext: input.clinicalContext,
    voiceRate: input.voiceRate,
  });

  // Build speechConfig from AV state voice modulation or default to Aoede
  const speechConfigObj: Record<string, unknown> = {
    voiceName: input.voiceId || 'Aoede',
  };
  if (input.voiceRate != null && input.voiceRate !== 1.0) {
    speechConfigObj.speechRate = input.voiceRate;
  }
  if (input.voicePitch != null && input.voicePitch !== 0) {
    speechConfigObj.pitchShift = input.voicePitch;
  }

  const setup = buildLiveEngineSetup({ systemInstruction, speechConfig: speechConfigObj });

  let token: string | null = null;
  const now = new Date();
  const expireTime = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();
  const newSessionExpireTime = new Date(now.getTime() + TOKEN_NEW_SESSION_TTL_MS).toISOString();

  try {
    const createTokenUrl = `https://generativelanguage.googleapis.com/v1beta/authTokens:createToken?key=${deps.env.GEMINI_API_KEY}`;
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
    deps.logger.warn('Ephemeral token creation failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const wsUrl = token
    ? `wss://generativelanguage.googleapis.com/ws/${GEMINI_WS_PATH}?access_token=${encodeURIComponent(token)}`
    : null;

  return {
    wsUrl,
    setup,
    sessionId: input.sessionId ?? null,
    tokenUsed: !!token,
  };
}

// ─── Orchestrator agent registration ───────────────────────────────────────

export const liveEngineAgent: AgentDefinition<LiveEngineInput, LiveEngineFlowOutput> = {
  name: 'live-engine',
  description:
    'Build Gemini Live API (voice + text) setup config with dynamic OSCE persona and mint an ephemeral session token.',
  tier: 'encounter',
  inputSchema: LiveEngineInputSchema,
  outputSchema: LiveEngineFlowOutputSchema,
  async invoke(input, ctx) {
    const start = Date.now();
    const parsed = LiveEngineInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'schema_invalid',
        output: null,
        error: {
          status: 'schema_invalid',
          message: `Invalid live-engine input: ${parsed.error.message}`,
          cause: 'input_schema',
        },
        agent: 'live-engine',
        durationMs: 0,
      };
    }

    const logger = loggerFrom(ctx.log);
    try {
      const output = await runLiveEngineFlow(parsed.data, { env: ctx.env, logger });
      return {
        status: 'ok',
        output,
        error: null,
        agent: 'live-engine',
        durationMs: Date.now() - start,
        telemetry: { model: LIVE_MODEL, tokenMinted: output.tokenUsed },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log?.('error', '[live-engine] flow failed', { error: message, userId: ctx.userId });
      return {
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message, cause: 'live_engine_flow' },
        agent: 'live-engine',
        durationMs: Date.now() - start,
      };
    }
  },
};

/**
 * Register the live-engine strategy in the runtime registry.
 * Idempotent for the same definition; throws on conflicting registrations.
 */
export function registerLiveEngineStrategy(): void {
  registerAgent(liveEngineAgent);
}
