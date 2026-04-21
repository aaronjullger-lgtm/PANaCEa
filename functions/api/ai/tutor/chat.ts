/**
 * POST /api/intelligence/tutor
 *
 * Reasoning Tutor powered by Gemini 3 + Weak Spot analytics.
 *
 * Sprint 5b migration notes (AI Gateway):
 *   - Core generateContent call now routes through `gateway.tutor()`. Multi-turn
 *     history, Google Search grounding tools, cachedContent references, and
 *     raw thinking-budget token counts flow through the gateway's extended
 *     `GatewayTextRequest` fields.
 *   - Thought-signature extraction and grounding-source normalization stay
 *     endpoint-local — they read from `gateway.tutor(...).raw`, which is the
 *     gateway's explicit escape hatch for Gemini-specific response internals
 *     that don't yet have a first-class place in `GatewayTextResponse`.
 *   - Context-cache creation (cachedContents/{id}) still uses a direct fetch
 *     to `generativelanguage.googleapis.com/v1beta/cachedContents` — the
 *     gateway wraps generateContent, not the cached-content lifecycle. The
 *     cache is created server-side with `context.env.GEMINI_API_KEY` (no
 *     browser-side key material).
 *   - Rate limiting moved from the ad-hoc `aiEndpoint` auth wrapper (unchanged)
 *     to the gateway's built-in telemetry + fallback. RATE_LIMITED → 429.
 *
 * Features preserved:
 *   - Weak-spot profile string built from WeaknessPattern analytics.
 *   - Short-lived (60-min TTL) context cache for the profile.
 *   - Google Search grounding toggled by explicit flag or keyword heuristic.
 *   - Reasoning-effort knob that overrides the thinkingLevel hint.
 *   - Thought signatures returned so the client can preserve reasoning across turns.
 */

import { z } from 'zod';
import {
  aiEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,, withCors} from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { resolveUserId } from '../../_shared/user-resolver';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

// -----------------------------------------------------------------------------
// Request / Response Schemas
// -----------------------------------------------------------------------------

const TutorMessageSchema = z.object({
  /** The latest user message for the tutor. */
  message: z.string().min(1, 'Message is required'),

  /**
   * Optional prior turns. The client should send only the last N turns to stay
   * within token limits. Roles are normalized to Gemini's `user` | `model`.
   */
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']).default('user'),
        text: z.string().min(1),
      })
    )
    .optional(),

  /**
   * Optional existing session cache name (cachedContents/{id}). If omitted, the
   * endpoint may create a new short-lived cache from weak-spot analytics.
   */
  sessionCacheName: z.string().optional(),

  /**
   * Accepted for future routing decisions (Gemini API supports only one
   * cachedContent reference per generateContent call today).
   */
  staticCacheName: z.string().optional(),

  /** Optional explicit override to skip the analytics-derived weak-spot summary. */
  weakSpotProfileOverride: z.string().optional(),

  /**
   * Gemini 3 thinking-level hint. `high` maps to a larger raw token budget
   * than the gateway's default enum — callers who want fine-grained control
   * should set `reasoningEffort` instead.
   */
  thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional().default('high'),

  /** Optional model override, e.g. "gemini-3-flash-preview" | "gemini-2.5-flash". */
  modelName: z.string().optional().default('gemini-2.5-flash'),

  /** Force Google Search grounding (External Brain / guideline checker). */
  enableGoogleSearch: z.boolean().optional().default(false),

  /**
   * "Deep Search" — combine grounded search with a high reasoning budget for
   * multi-part comparison questions.
   */
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),

  /** Temperature / output length tunables with safe defaults. */
  temperature: z.number().min(0).max(2).optional().default(0.6),
  maxTokens: z.number().int().min(256).max(8192).optional().default(2048),
});

type TutorRequest = z.infer<typeof TutorMessageSchema>;

interface TutorHandlerContext extends AuthenticatedContext, ValidatedContext<TutorRequest> {}

interface GroundingSource {
  title: string;
  uri: string;
}

interface TutorReplyPayload {
  reply: string;
  model: string;
  /** Thought signatures emitted by Gemini 3 (client re-sends on next turn). */
  thoughtSignatures?: string[];
  /** Session cache name used or created for this request. */
  sessionCacheName?: string;
  /** Citations from grounding metadata when Google Search was used. */
  groundingSources?: GroundingSource[];
}

// -----------------------------------------------------------------------------
// Helper: Build weak-spot profile from analytics
// -----------------------------------------------------------------------------

async function buildWeakSpotProfile(
  prisma: EdgePrismaClient,
  internalUserId: string
): Promise<string | null> {
  const patterns = await prisma.weaknessPattern.findMany({
    where: { userId: internalUserId },
    include: {
      Condition: {
        select: { name: true, system: true },
      },
    },
    orderBy: [{ consecutiveWrong: 'desc' }, { timestamp: 'desc' }],
    take: 25,
  });

  if (!patterns.length) return null;

  const systemMap = new Map<
    string,
    { conditions: Map<string, number>; totalWrong: number }
  >();

  for (const pattern of patterns) {
    const system = pattern.Condition?.system || 'Unspecified System';
    const conditionName = pattern.Condition?.name || pattern.conditionId;

    const systemEntry =
      systemMap.get(system) ??
      (() => {
        const value = { conditions: new Map<string, number>(), totalWrong: 0 };
        systemMap.set(system, value);
        return value;
      })();

    const weight = Math.max(pattern.consecutiveWrong, pattern.wasCorrect ? 0 : 1);
    systemEntry.totalWrong += weight;
    systemEntry.conditions.set(
      conditionName,
      (systemEntry.conditions.get(conditionName) ?? 0) + weight
    );
  }

  const rankedSystems = Array.from(systemMap.entries())
    .sort((a, b) => b[1].totalWrong - a[1].totalWrong)
    .slice(0, 4);

  const systemSummaries: string[] = [];
  for (const [system, data] of rankedSystems) {
    const topConditions = Array.from(data.conditions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    systemSummaries.push(`${system}: struggling particularly with ${topConditions.join(', ')}`);
  }

  return [
    'Student weakness profile (derived from recent question performance):',
    ...systemSummaries.map((s) => `- ${s}`),
  ].join('\n');
}

// -----------------------------------------------------------------------------
// Helper: Create a short-lived context cache for the weak-spot profile
// -----------------------------------------------------------------------------

/**
 * The cachedContents lifecycle is not part of the gateway — the gateway wraps
 * generateContent, not Gemini's separate cache-management endpoint. Cache
 * creation uses the server-only GEMINI_API_KEY from context.env, so no browser
 * bundle ships key material.
 */
async function createWeakSpotCache(
  env: { GEMINI_API_KEY: string },
  modelName: string,
  weakSpotProfile: string
): Promise<string | null> {
  try {
    const body = {
      model: `models/${modelName}`,
      ttl: '3600s', // 60-minute TTL
      contents: [
        { role: 'user', parts: [{ text: weakSpotProfile }] },
      ],
      displayName: 'session-weak-spot-profile',
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error('[Tutor] Failed to create weak-spot cache', await response.text());
      return null;
    }

    const data = (await response.json()) as { name?: string };
    return data.name ?? null;
  } catch (error) {
    console.error('[Tutor] Error creating weak-spot cache', error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Helper: Grounding / reasoning-effort policy
// -----------------------------------------------------------------------------

function shouldEnableGoogleSearch(message: string, explicit: boolean): boolean {
  if (explicit) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes('guideline') ||
    lower.includes('cdc') ||
    lower.includes('who recommendation') ||
    lower.includes('first-line') ||
    lower.includes('first line') ||
    lower.includes('treatment for') ||
    lower.includes('management of') ||
    lower.includes('dose for') ||
    lower.includes('dosing for') ||
    lower.includes('antibiotic') ||
    lower.includes('therapy for') ||
    lower.includes('latest recommendation') ||
    lower.includes('up to date') ||
    lower.includes('202') || // year-based guideline queries
    lower.includes('vaccination schedule')
  );
}

/** Map this endpoint's knobs to a raw thinking-budget token count for Gemini 3. */
function resolveThinkingBudgetTokens(input: TutorRequest): number | undefined {
  if (input.reasoningEffort === 'high') return 24576;
  if (input.reasoningEffort === 'medium') return 8192;
  if (input.reasoningEffort === 'low') return 2048;
  // Fall back to thinkingLevel hint.
  switch (input.thinkingLevel) {
    case 'minimal':
      return 1024;
    case 'low':
      return 4096;
    case 'medium':
      return 8192;
    case 'high':
      return 16384;
    default:
      return undefined;
  }
}

// -----------------------------------------------------------------------------
// Helper: Extract tutor-specific fields from the gateway's raw response
// -----------------------------------------------------------------------------

type GeminiPart = { thought?: boolean; thoughtSignature?: string };
type GeminiGroundingChunk = {
  web?: { uri?: string; title?: string };
};

function extractThoughtSignatures(raw: unknown): string[] {
  const candidates = (raw as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> })
    ?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => p.thought && p.thoughtSignature)
    .map((p) => p.thoughtSignature as string)
    .filter((sig) => sig.length > 0);
}

function extractGroundingSources(groundingMetadata: unknown): GroundingSource[] | undefined {
  const chunks = (groundingMetadata as { groundingChunks?: GeminiGroundingChunk[] })
    ?.groundingChunks;
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) return undefined;

  const sources = chunks
    .map<GroundingSource | null>((c) => {
      const uri = c.web?.uri;
      const title = c.web?.title;
      if (uri && title) return { title, uri };
      if (uri) {
        try {
          const host = new URL(uri).hostname.replace(/^www\./, '');
          return { title: host, uri };
        } catch {
          return { title: 'Source', uri };
        }
      }
      return null;
    })
    .filter((s): s is GroundingSource => s !== null);

  return sources.length > 0 ? sources : undefined;
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(
  TutorMessageSchema,
  async (context: TutorHandlerContext) => {
    const { env, auth, validated } = context;
    const log = createEndpointLogger('/api/intelligence/tutor', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const internalUserId = await resolveUserId(prisma, auth.userId);
      if (!internalUserId) {
        return { status: 404, error: 'User not found in analytics database' };
      }

      // 1) Build or accept weak-spot profile text.
      let weakSpotProfile = validated.weakSpotProfileOverride ?? null;
      if (!weakSpotProfile) {
        weakSpotProfile = await buildWeakSpotProfile(prisma, internalUserId);
      }

      // 2) Ensure we have a session cache for this profile when available.
      let sessionCacheName = validated.sessionCacheName;
      if (!sessionCacheName && weakSpotProfile) {
        sessionCacheName =
          (await createWeakSpotCache(env, validated.modelName, weakSpotProfile)) ?? undefined;
        if (sessionCacheName) {
          log.info('Created weak-spot context cache', { cacheName: sessionCacheName });
        }
      }

      // 3) Route the Gemini call through the gateway.
      const tools = shouldEnableGoogleSearch(validated.message, validated.enableGoogleSearch === true)
        ? [{ googleSearch: {} }]
        : undefined;

      const result = await gateway.tutor(toGatewayContext(context), {
        endpoint: '/api/intelligence/tutor',
        model: validated.modelName,
        userPrompt: validated.message,
        history: validated.history?.map((h) => ({ role: h.role, text: h.text })),
        temperature: validated.temperature,
        maxOutputTokens: validated.maxTokens,
        thinkingBudgetTokens: resolveThinkingBudgetTokens(validated),
        tools,
        cachedContent: sessionCacheName,
      });

      if (result.blocked) {
        log.warn('Tutor response blocked by safety filter', {
          blockReason: result.blockReason,
        });
        return {
          status: 422,
          error: 'The tutor could not answer that question. Please rephrase.',
        };
      }

      if (!result.text) {
        throw new Error('Gateway returned empty tutor reply');
      }

      // 4) Peel tutor-specific fields off the raw response.
      const payload: TutorReplyPayload = {
        reply: result.text,
        model: result.telemetry.modelUsed,
      };

      const thoughtSignatures = extractThoughtSignatures(result.raw);
      if (thoughtSignatures.length > 0) {
        payload.thoughtSignatures = thoughtSignatures;
      }

      if (sessionCacheName) {
        payload.sessionCacheName = sessionCacheName;
      }

      const groundingSources = extractGroundingSources(result.groundingMetadata);
      if (groundingSources) {
        payload.groundingSources = groundingSources;
      }

      return { data: payload };
    } catch (error) {
      if (error instanceof GatewayError) {
        log.error('Reasoning Tutor gateway failure', error, {
          code: error.code,
          requestId: error.requestId,
          traceId: error.traceId,
        });
        if (error.code === 'RATE_LIMITED') {
          return { status: 429, error: 'Tutor is busy right now — please try again shortly.' };
        }
        if (error.code === 'SAFETY_BLOCKED') {
          return {
            status: 422,
            error: 'The tutor could not answer that question. Please rephrase.',
          };
        }
        return { status: 502, error: `Tutor failed: ${error.code}` };
      }
      log.error('Reasoning Tutor unexpected error', error);
      return { status: 500, error: 'Failed to generate tutor response' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
