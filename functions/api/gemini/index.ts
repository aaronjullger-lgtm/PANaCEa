/**
 * API Endpoint: /api/gemini
 * POST: Non-streaming Gemini AI proxy endpoint
 *
 * This endpoint handles synchronous (non-streaming) requests to the Gemini API.
 * For streaming responses, use /api/gemini/stream instead.
 *
 * Migrated to use the unified ai-service.ts layer (Phase 5).
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { callGemini, GeminiModel, thinkingBudget, supportsThinking } from '../_shared/ai-service';

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: unknown;
}

const GeminiRequestSchema = z.object({
  modelName: z.string().optional().default('gemini-2.0-flash'),
  prompt: z.string().min(1, 'Prompt is required'),
  temperature: z.number().min(0).max(2).optional().default(0.8),
  maxTokens: z.number().int().min(1).max(8192).optional().default(2048),
  systemInstruction: z.string().optional(),
  /** Optional: use Gemini context cache (e.g. cachedContents/xxx) for "Chat with your Library" */
  cachedContent: z.string().min(1).startsWith('cachedContents/').optional(),
  /** Optional: Gemini thinking level for reasoning control */
  thinkingLevel: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).optional(),
});

// Handle CORS preflight
export const onRequestOptions = withCors();

/**
 * POST /api/gemini
 * Synchronous Gemini API proxy (requires authentication)
 */
export const onRequestPost = aiEndpoint(GeminiRequestSchema, async (context) => {
  const { request, env, validated } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof GeminiRequestSchema>;
  };

  // Rate limit AI requests (user ID if available, else IP)
  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const {
    modelName,
    prompt,
    temperature,
    maxTokens,
    systemInstruction,
    cachedContent,
    thinkingLevel,
  } = validated;

  try {
    // Build generation config
    const generationConfig: Record<string, unknown> = {
      temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    };

    // Map thinking level to thinkingConfig budget when supported
    if (thinkingLevel && supportsThinking(modelName)) {
      const levelMap: Record<string, 'minimal' | 'low' | 'medium' | 'high'> = {
        MINIMAL: 'minimal',
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
      };
      const mapped = levelMap[thinkingLevel];
      if (mapped) {
        generationConfig.thinkingConfig = { thinkingBudget: thinkingBudget(mapped) };
      }
    }

    const result = await callGemini({ env }, {
      model: modelName,
      prompt,
      systemInstruction,
      cachedContent,
      generationConfig,
      endpoint: '/api/gemini',
    });

    // Check for blocked content
    if (result.blocked) {
      return {
        status: 400,
        error: `Content blocked: ${result.blockReason}`,
      };
    }

    if (!result.text) {
      return {
        status: 500,
        error: 'No response generated. Please try again.',
      };
    }

    return new Response(
      JSON.stringify({
        data: {
          text: result.text,
          model: modelName,
          finishReason: result.raw.candidates?.[0]?.finishReason,
          usage: result.usage
            ? {
                promptTokenCount: result.usage.promptTokenCount ?? 0,
                candidatesTokenCount: result.usage.candidatesTokenCount ?? 0,
                totalTokenCount: result.usage.totalTokenCount ?? 0,
              }
            : undefined,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders,
        },
      }
    );
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;

    // Map GeminiError to appropriate response
    if (status === 429) {
      return {
        status: 429,
        error: 'Rate limit exceeded. Please try again later.',
      };
    }

    if (status === 403) {
      return {
        status: 500,
        error: 'API authentication failed. Please contact support.',
      };
    }

    console.error('[Gemini] Unexpected error:', err);
    return {
      status: (status && status >= 500) ? 503 : 500,
      error: 'Failed to process request. Please try again.',
    };
  }
});
