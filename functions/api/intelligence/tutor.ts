/**
 * POST /api/intelligence/tutor
 *
 * Reasoning Tutor powered by Gemini 3 + Weak Spot analytics.
 *
 * Features in this first implementation:
 * - Uses Gemini 3 Flash by default for fast multimodal reasoning.
 * - Builds a per-user "weak spot profile" string from WeaknessPattern data.
 * - Optionally creates a short-lived context cache (60 min TTL) for the weak spot profile
 *   using the Gemini API explicit caching endpoint (cachedContents.create).
 * - Returns Thought Signatures (if present) so the client can preserve the reasoning chain.
 *
 * Notes / Future work:
 * - Static PANCE blueprint + textbook caches should be created offline and their
 *   cachedContent names passed in by the client or wired here later.
 * - Guideline checker (google_search tool) and richer multi-turn thought signature
 *   re-use will be layered on in a follow-up iteration.
 */

import { z } from 'zod';
import {
  authenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

// -----------------------------------------------------------------------------
// Request / Response Schemas
// -----------------------------------------------------------------------------

const TutorMessageSchema = z.object({
  /**
   * The latest user message for the tutor.
   */
  message: z.string().min(1, 'Message is required'),

  /**
   * Optional prior turns so the model can answer in context.
   * The client should send only the last N turns to stay within token limits.
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
   * Optional existing session cache name (cachedContents/{id}) for this student.
   * If omitted, the endpoint may create a new short-lived cache from weak-spot analytics.
   */
  sessionCacheName: z.string().optional(),

  /**
   * Optional static cache name for long-lived blueprint/textbook content.
   * Currently unused in the request body (Gemini API supports only one cachedContent
   * reference per generateContent call), but accepted for future routing decisions.
   */
  staticCacheName: z.string().optional(),

  /**
   * Optional explicit weak spot profile summary. If omitted, the endpoint will
   * compute one from WeaknessPattern and related analytics when possible.
   */
  weakSpotProfileOverride: z.string().optional(),

  /**
   * Optional thinking level hint for Gemini 3 models.
   * The underlying API currently accepts "low" | "medium" | "high" style strings;
   * unknown values are ignored by the service.
   */
  thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional().default('high'),

  /**
   * Optional model override, e.g. "gemini-3-flash-preview" | "gemini-2.5-flash".
   */
  modelName: z.string().optional().default('gemini-2.5-flash'),

  /**
   * Optional: always enable Google Search grounding (External Brain / guideline checker).
   * When true, bypasses keyword heuristic and always adds google_search tool.
   */
  enableGoogleSearch: z.boolean().optional().default(false),

  /**
   * Optional: "Deep Search" – combine Search with high reasoning effort for complex questions.
   * Use for multi-part comparisons (e.g. "Compare DOACs vs Warfarin in valvular Afib").
   */
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),

  /**
   * Temperature / output length tunables with safe defaults.
   */
  temperature: z.number().min(0).max(2).optional().default(0.6),
  maxTokens: z.number().int().min(256).max(8192).optional().default(2048),
});

type TutorRequest = z.infer<typeof TutorMessageSchema>;

interface TutorHandlerContext
  extends AuthenticatedContext,
    ValidatedContext<TutorRequest> {}

interface GroundingSource {
  title: string;
  uri: string;
}

interface TutorReplyPayload {
  reply: string;
  model: string;
  /**
   * Thought signatures emitted by Gemini 3, if any.
   * The client can send these back on subsequent turns to preserve reasoning.
   */
  thoughtSignatures?: string[];
  /**
   * Session cache name (cachedContents/{id}) used or created for this request.
   */
  sessionCacheName?: string;
  /**
   * When enableGoogleSearch was used, citations from grounding metadata.
   * Enables UI source chips: [Source: Mayo Clinic], [Source: NIH].
   */
  groundingSources?: GroundingSource[];
}

// -----------------------------------------------------------------------------
// Helper: Build weak-spot profile from analytics
// -----------------------------------------------------------------------------

async function buildWeakSpotProfile(
  prisma: EdgePrismaClient,
  internalUserId: string
): Promise<string | null> {
  // Pull the user's most problematic conditions based on WeaknessPattern.
  const patterns = await prisma.weaknessPattern.findMany({
    where: { userId: internalUserId },
    include: {
      Condition: {
        select: {
          name: true,
          system: true,
        },
      },
    },
    orderBy: [
      { consecutiveWrong: 'desc' },
      { timestamp: 'desc' },
    ],
    take: 25,
  });

  if (!patterns.length) {
    return null;
  }

  // Aggregate by system and condition for a compact summary.
  const systemMap = new Map<
    string,
    {
      conditions: Map<string, number>;
      totalWrong: number;
    }
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

    systemEntry.totalWrong += Math.max(pattern.consecutiveWrong, pattern.wasCorrect ? 0 : 1);
    systemEntry.conditions.set(
      conditionName,
      (systemEntry.conditions.get(conditionName) ?? 0) +
        Math.max(pattern.consecutiveWrong, pattern.wasCorrect ? 0 : 1)
    );
  }

  // Rank systems by total difficulty.
  const rankedSystems = Array.from(systemMap.entries())
    .sort((a, b) => b[1].totalWrong - a[1].totalWrong)
    .slice(0, 4);

  const systemSummaries: string[] = [];
  for (const [system, data] of rankedSystems) {
    const topConditions = Array.from(data.conditions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    systemSummaries.push(
      `${system}: struggling particularly with ${topConditions.join(', ')}`
    );
  }

  return [
    'Student weakness profile (derived from recent question performance):',
    ...systemSummaries.map((s) => `- ${s}`),
  ].join('\n');
}

// -----------------------------------------------------------------------------
// Helper: Create a short-lived context cache for weak-spot profile
// -----------------------------------------------------------------------------

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
        {
          role: 'user',
          parts: [
            {
              text: weakSpotProfile,
            },
          ],
        },
      ],
      displayName: 'session-weak-spot-profile',
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      // If caching fails, fall back gracefully without breaking the tutor.
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
// Helper: Call Gemini 3 generateContent with optional cachedContent + thinking
// -----------------------------------------------------------------------------

async function callGeminiTutor(
  env: { GEMINI_API_KEY: string },
  modelName: string,
  input: TutorRequest,
  sessionCacheName?: string
): Promise<TutorReplyPayload> {
  const { message, history, temperature, maxTokens, thinkingLevel, enableGoogleSearch, reasoningEffort } = input;

  const contents: Array<{ role?: string; parts: Array<Record<string, unknown>> }> = [];

  if (history && history.length > 0) {
    for (const turn of history) {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.text }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const generationConfig: Record<string, unknown> = {
    temperature,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: maxTokens,
  };

  // Hint to Gemini 3 about the desired reasoning depth.
  if (thinkingLevel) {
    (generationConfig as Record<string, unknown>).thinkingLevel = thinkingLevel;
  }
  // "Deep Search": high reasoning budget when combining Search with complex questions.
  if (reasoningEffort === 'high') {
    (generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 24576 };
  } else if (reasoningEffort === 'medium') {
    (generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 8192 };
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  // Enable guideline-aware grounding with Google Search (External Brain).
  // Use explicit enableGoogleSearch or keyword heuristic.
  const lowerMessage = message.toLowerCase();
  const shouldEnableSearch =
    enableGoogleSearch === true ||
    lowerMessage.includes('guideline') ||
    lowerMessage.includes('cdc') ||
    lowerMessage.includes('who recommendation') ||
    lowerMessage.includes('first-line') ||
    lowerMessage.includes('first line') ||
    lowerMessage.includes('treatment for') ||
    lowerMessage.includes('management of') ||
    lowerMessage.includes('dose for') ||
    lowerMessage.includes('dosing for') ||
    lowerMessage.includes('antibiotic') ||
    lowerMessage.includes('therapy for') ||
    lowerMessage.includes('latest recommendation') ||
    lowerMessage.includes('up to date') ||
    lowerMessage.includes('202') || // heuristic for year-based guideline queries
    lowerMessage.includes('vaccination schedule');

  if (shouldEnableSearch) {
    body.tools = [{ googleSearch: {} }];
  }

  if (sessionCacheName) {
    body.cachedContent = sessionCacheName;
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Tutor] Gemini error', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          thought?: boolean;
          thoughtSignature?: string;
        }>;
      };
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const replyText = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();

  const thoughtSignatures = parts
    .filter((p) => p.thought && p.thoughtSignature)
    .map((p) => p.thoughtSignature ?? '')
    .filter((sig) => sig.length > 0);

  if (!replyText) {
    throw new Error('Gemini returned no usable text content');
  }

  const payload: TutorReplyPayload = {
    reply: replyText,
    model: modelName,
  };

  if (thoughtSignatures.length > 0) {
    payload.thoughtSignatures = thoughtSignatures;
  }

  if (sessionCacheName) {
    payload.sessionCacheName = sessionCacheName;
  }

  // Strict citation return when Search was used (groundingMetadata).
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (chunks && Array.isArray(chunks) && chunks.length > 0) {
    payload.groundingSources = chunks
      .map((c) => {
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
  }

  return payload;
}

// -----------------------------------------------------------------------------
// Main Handler
// -----------------------------------------------------------------------------

export const onRequestPost = authenticatedEndpoint(
  TutorMessageSchema,
  async (context: TutorHandlerContext) => {
    const { env, auth, validated } = context;
    const log = createEndpointLogger('/api/intelligence/tutor', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const internalUserId = await resolveUserId(prisma, auth.userId);
      if (!internalUserId) {
        return {
          status: 404,
          error: 'User not found in analytics database',
        };
      }

      const { modelName } = validated;

      // 1) Build or accept weak-spot profile text.
      let weakSpotProfile = validated.weakSpotProfileOverride ?? null;
      if (!weakSpotProfile) {
        weakSpotProfile = await buildWeakSpotProfile(prisma, internalUserId);
      }

      // 2) Ensure we have a session cache for this profile when available.
      let sessionCacheName = validated.sessionCacheName;

      if (!sessionCacheName && weakSpotProfile) {
        sessionCacheName = (await createWeakSpotCache(env, modelName, weakSpotProfile)) ?? undefined;
        if (sessionCacheName) {
          log.info('Created weak-spot context cache', { cacheName: sessionCacheName });
        }
      }

      // 3) Call Gemini 3 Tutor with optional cache + thinking configuration.
      const payload = await callGeminiTutor(env, modelName, validated, sessionCacheName ?? undefined);

      // 4) Return structured payload for the frontend Reasoning Tutor UI.
      return {
        data: payload,
      };
    } catch (error: any) {
      log.error('Reasoning Tutor error', { error: error?.message ?? String(error) });
      return {
        status: 500,
        error: 'Failed to generate tutor response',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

