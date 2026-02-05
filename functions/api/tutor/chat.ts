/**
 * POST /api/tutor/chat
 * "Deep Think" Clinical Tutor: Gemini 3 with thinking_level=high and Thought Signatures.
 *
 * Student benefit: Moves beyond multiple-choice memorization to testing *why* a diagnosis
 * is correct; forces students to construct a differential like a clinician. PANCE Blueprint:
 * "Formulating Most Likely Diagnosis" (18%), "Clinical Intervention" (16%).
 *
 * Cursor Implementation Plan (Phase 1):
 * 1. Enable Thinking: Use gemini-3-flash-preview (fallback: gemini-2.5-flash), thinking_level="high".
 * 2. Preserve Thought Signatures: Extract thoughtSignature from previous model turn; include in
 *    next request parts (history or previousThoughtSignatures) or the model loses reasoning (lobotomy).
 * 3. Strict Citations: System instruction instructs model to cite cached Smart Library as {{Page:N}}.
 * 4. Tool: tools: [{ googleSearch: {} }] for CDC/guideline verification when textbook is outdated.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const ChatTurnSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().min(1),
  /** From previous model turn; include in next request parts to preserve reasoning. */
  thoughtSignature: z.string().optional(),
});

const TutorChatBodySchema = z.object({
  body: z.object({
    message: z.string().min(1).max(32000),
    history: z.array(ChatTurnSchema).max(50).optional(),
    /** e.g. cachedContents/xxx from Smart Library or weak-spot cache */
    cachedContent: z.string().min(1).startsWith('cachedContents/').optional(),
    /** Previous model turn's thought signature(s); send back in this request. */
    previousThoughtSignatures: z.array(z.string()).max(10).optional(),
    /** Use gemini-3-flash-preview for Deep Think; fallback to gemini-2.5-flash if 3 not available. */
    modelName: z.string().optional().default('gemini-3-flash-preview'),
    thinkingLevel: z.enum(['low', 'medium', 'high']).optional().default('high'),
    temperature: z.number().min(0).max(2).optional().default(0.6),
    maxTokens: z.number().int().min(256).max(8192).optional().default(2048),
    /** If true, enable google_search for CDC/guideline verification */
    enableGoogleSearch: z.boolean().optional().default(true),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

const SYSTEM_INSTRUCTION =
  'You are a senior clinical tutor for PA students preparing for PANCE. Emphasize "Formulating Most Likely Diagnosis" and "Clinical Intervention" (core Blueprint areas). Use Socratic dialogue and focus on differential diagnosis and clinical reasoning—do not just output answers; simulate clinical judgment. When citing sources from the provided library context (cachedContent), use the exact format {{Page:N}} or {{Pages:N-M}} so the frontend can highlight the text. Be concise but rigorous.';

type TutorBody = z.infer<typeof TutorChatBodySchema>['body'];

function buildTutorContents(body: TutorBody): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
  if (body.history?.length) {
    for (const turn of body.history) {
      const parts: Array<Record<string, unknown>> = [{ text: turn.text }];
      if (turn.role === 'model' && turn.thoughtSignature) parts.push({ thoughtSignature: turn.thoughtSignature });
      contents.push({ role: turn.role, parts });
    }
  }
  const userParts: Array<Record<string, unknown>> = [{ text: body.message }];
  if (body.previousThoughtSignatures?.length) {
    for (const sig of body.previousThoughtSignatures) userParts.push({ thoughtSignature: sig });
  }
  contents.push({ role: 'user', parts: userParts });
  return contents;
}

function buildTutorRequestBody(body: TutorBody, contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>): Record<string, unknown> {
  const requestBody: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: body.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: body.maxTokens,
    },
    /** Required for Deep Think: model generates hidden reasoning before replying. */
    thinkingConfig: { thinkingLevel: body.thinkingLevel.toUpperCase() },
  };
  if (body.cachedContent) requestBody.cachedContent = body.cachedContent;
  if (body.enableGoogleSearch) requestBody.tools = [{ googleSearch: {} }];
  return requestBody;
}

type Part = { text?: string; thoughtSignature?: string };

interface TutorCandidate {
  content?: { parts?: Part[] };
}
interface TutorSuccessData {
  candidates?: TutorCandidate[];
  usageMetadata?: { totalTokenCount?: number };
}
function parseTutorSuccessResponse(
  data: TutorSuccessData
): { reply: string; thoughtSignatures: string[]; usageMetadata?: { totalTokenCount?: number } } {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  let reply = '';
  const thoughtSignatures: string[] = [];
  for (const p of parts) {
    if (p.text) reply += p.text;
    if (p.thoughtSignature) thoughtSignatures.push(p.thoughtSignature);
  }
  return {
    reply: reply.trim() || '(No reply generated.)',
    thoughtSignatures,
    usageMetadata: data.usageMetadata,
  };
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(TutorChatBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof TutorChatBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/tutor/chat', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(env, identifier, 'gemini');
  if (rateLimitResponse) return rateLimitResponse;

  const body = validated.body;
  const contents = buildTutorContents(body);
  const requestBody = buildTutorRequestBody(body, contents);
  const url = `${GEMINI_BASE}/v1beta/models/${body.modelName}:generateContent?key=${env.GEMINI_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    log.warn('Tutor chat fetch error', { msg: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ error: 'Tutor service unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    });
  }

  if (res.ok) {
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Part[] } }>; usageMetadata?: { totalTokenCount?: number } };
    const parsed = parseTutorSuccessResponse(data);
    return new Response(
      JSON.stringify({
        data: {
          reply: parsed.reply,
          thoughtSignatures: parsed.thoughtSignatures.length > 0 ? parsed.thoughtSignatures : undefined,
          model: body.modelName,
          usageMetadata: parsed.usageMetadata,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  }

  const text = await res.text();
  log.warn('Tutor chat Gemini error', { status: res.status, text: text.slice(0, 300) });
  return new Response(
    JSON.stringify({
      error: res.status === 429 ? 'Rate limit exceeded' : 'Tutor request failed',
      details: res.status === 429 ? undefined : text.slice(0, 500),
    }),
    { status: res.status === 429 ? 429 : 502, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
  );
});
