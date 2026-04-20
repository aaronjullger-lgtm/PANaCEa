/**
 * POST /api/tutor/chat
 * "Deep Think" Clinical Tutor: Gemini with extended thinking and Thought Signatures.
 *
 * Sprint 8 (AI Gateway migration): Replaced direct fetch to
 * generativelanguage.googleapis.com with gateway.tutor(). All model selection,
 * retries, telemetry, and thought-signature plumbing now flow through the
 * gateway. The endpoint retains only the concerns that belong here:
 *   - Request schema validation
 *   - Rate limiting
 *   - Weak-spot context cache lifecycle (cachedContents is NOT a gateway concern)
 *   - Peeling thought signatures and grounding metadata off the raw response
 *
 * Note: two tutor endpoints exist:
 *   /api/tutor/chat     (this file) — older path, kept for backwards compat
 *   /api/intelligence/tutor  (functions/api/ai/tutor/chat.ts) — richer analytics
 * Both delegate to gateway.tutor(). Prefer the /intelligence path for new clients.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ChatTurnSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().min(1),
  thoughtSignature: z.string().optional(),
});

const TutorChatBodySchema = z.object({
  body: z.object({
    message: z.string().min(1).max(32000),
    history: z.array(ChatTurnSchema).max(50).optional(),
    cachedContent: z.string().min(1).startsWith('cachedContents/').optional(),
    previousThoughtSignatures: z.array(z.string()).max(10).optional(),
    modelName: z.string().optional().default('gemini-2.5-flash'),
    thinkingLevel: z.enum(['low', 'medium', 'high']).optional().default('high'),
    temperature: z.number().min(0).max(2).optional().default(0.6),
    maxTokens: z.number().int().min(256).max(8192).optional().default(2048),
    enableGoogleSearch: z.boolean().optional().default(true),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

// ─── Reasoning budget ───────────────────────────────────────────────────────

function resolveThinkingBudgetTokens(level: 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'low':    return 2048;
    case 'medium': return 8192;
    case 'high':   return 16384;
  }
}

// ─── Response extraction helpers ────────────────────────────────────────────

type GeminiPart = { thought?: boolean; thoughtSignature?: string };
type GeminiGroundingChunk = { web?: { uri?: string; title?: string } };

function extractThoughtSignatures(raw: unknown): string[] {
  const candidates = (raw as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => p.thought && p.thoughtSignature)
    .map((p) => p.thoughtSignature as string)
    .filter((sig) => sig.length > 0);
}

function extractGroundingSources(
  groundingMetadata: unknown
): Array<{ title: string; uri: string }> | undefined {
  const chunks = (groundingMetadata as { groundingChunks?: GeminiGroundingChunk[] })
    ?.groundingChunks;
  if (!chunks?.length) return undefined;

  const sources = chunks
    .map<{ title: string; uri: string } | null>((c) => {
      const uri = c.web?.uri;
      const title = c.web?.title;
      if (uri && title) return { title, uri };
      if (uri) {
        try {
          return { title: new URL(uri).hostname.replace(/^www\./, ''), uri };
        } catch {
          return { title: 'Source', uri };
        }
      }
      return null;
    })
    .filter((s): s is { title: string; uri: string } => s !== null);

  return sources.length > 0 ? sources : undefined;
}

// ─── System instruction ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION =
  'You are a senior clinical tutor for PA students preparing for PANCE. Emphasize "Formulating Most Likely Diagnosis" and "Clinical Intervention" (core Blueprint areas). Use Socratic dialogue and focus on differential diagnosis and clinical reasoning—do not just output answers; simulate clinical judgment. When citing sources from the provided library context (cachedContent), use the exact format {{Page:N}} or {{Pages:N-M}} so the frontend can highlight the text. Be concise but rigorous.';

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(TutorChatBodySchema, async (context) => {
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
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env,
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const body = validated.body;

  try {
    const result = await gateway.tutor(toGatewayContext(context as Parameters<typeof toGatewayContext>[0]), {
      endpoint: '/api/tutor/chat',
      model: body.modelName,
      systemPrompt: SYSTEM_INSTRUCTION,
      userPrompt: body.message,
      history: body.history?.map((h) => ({
        role: h.role,
        text: h.text,
        thoughtSignature: h.thoughtSignature,
      })),
      previousThoughtSignatures: body.previousThoughtSignatures,
      temperature: body.temperature,
      maxOutputTokens: body.maxTokens,
      thinkingBudgetTokens: resolveThinkingBudgetTokens(body.thinkingLevel),
      tools: body.enableGoogleSearch ? [{ googleSearch: {} }] : undefined,
      cachedContent: body.cachedContent,
    });

    if (result.blocked) {
      log.warn('Tutor response blocked', { blockReason: result.blockReason });
      return new Response(
        JSON.stringify({ error: 'Content blocked. Please rephrase your question.' }),
        { status: 422, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
      );
    }

    const thoughtSignatures = extractThoughtSignatures(result.raw);
    const groundingSources = extractGroundingSources(result.groundingMetadata);

    return new Response(
      JSON.stringify({
        data: {
          reply: result.text,
          thoughtSignatures: thoughtSignatures.length > 0 ? thoughtSignatures : undefined,
          model: result.telemetry.modelUsed,
          usageMetadata: result.usage,
          groundingSources,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders } }
    );
  } catch (error) {
    if (error instanceof GatewayError) {
      log.warn('Tutor chat gateway failure', { code: error.code, requestId: error.requestId });
      return new Response(
        JSON.stringify({
          error: error.code === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Tutor request failed',
        }),
        {
          status: error.code === 'RATE_LIMITED' ? 429 : 502,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
        }
      );
    }
    log.warn('Tutor chat unexpected error', {
      msg: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: 'Tutor service unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
    });
  }
});
