/**
 * POST /api/clinical-eye/analyze
 * Analyze medical images (e.g. ECGs) with Gemini code execution for mathematical precision.
 * Returns reasoning/code trace and final assessment; optionally bounding box JSON for "where is X?" prompts.
 */

import { z } from 'zod';
import { aiEndpoint, withCors } from '../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const CLINICAL_EYE_MODEL = 'gemini-2.5-flash';
const DEFAULT_THINKING_BUDGET = 2048;
const MAX_IMAGE_BASE64 = 4 * 1024 * 1024; // ~4MB

const AnalyzeBodySchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required'),
  mimeType: z.string().optional().default('image/png'),
  prompt: z.string().min(1, 'Prompt is required').max(4096),
  thinkingBudget: z.number().int().min(0).max(32768).optional().default(DEFAULT_THINKING_BUDGET),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: {
    get(key: string, type?: 'text'): Promise<string | null>;
    get(key: string, type: 'json'): Promise<unknown>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
}

export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(AnalyzeBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof AnalyzeBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/clinical-eye/analyze', auth.userId);

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
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { imageBase64, mimeType, prompt, thinkingBudget } = validated;

  if (imageBase64.length > MAX_IMAGE_BASE64) {
    return new Response(JSON.stringify({ error: 'Image too large (max ~4MB base64)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  const url = `${GEMINI_BASE}/v1beta/models/${CLINICAL_EYE_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}),
    },
    tools: [{ code_execution: {} }],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const text = await res.text();
      log.warn('Clinical Eye Gemini error', { status: res.status, text: text.slice(0, 300) });
      return new Response(
        JSON.stringify({
          error: res.status === 429 ? 'Rate limit exceeded' : 'Analysis failed',
          details: text.slice(0, 500),
        }),
        {
          status: res.status === 429 ? 429 : 502,
          headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
        }
      );
    }

    type CandidatePart = {
      text?: string;
      thought?: { thoughtChunks?: Array<{ text?: string }> };
      codeExecutionResult?: { outcome?: string; code?: string };
    };
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: CandidatePart[] } }>;
      usageMetadata?: { totalTokenCount?: number };
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    let text = '';
    const reasoning: string[] = [];
    let box2d: number[] | null = null;
    let label: string | null = null;

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.thought?.thoughtChunks) {
        for (const ch of part.thought.thoughtChunks) {
          if (ch.text) reasoning.push(ch.text);
        }
      }
      if (part.codeExecutionResult?.outcome) {
        reasoning.push(`Code outcome: ${part.codeExecutionResult.outcome}`);
        if (part.codeExecutionResult.code) reasoning.push(`Code: ${part.codeExecutionResult.code}`);
      }
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*"box_2d"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { box_2d?: number[]; label?: string };
        if (Array.isArray(parsed.box_2d)) box2d = parsed.box_2d;
        if (typeof parsed.label === 'string') label = parsed.label;
      }
    } catch {
      // ignore parse errors for optional bbox
    }

    return new Response(
      JSON.stringify({
        data: {
          text: text || '(No text in response)',
          reasoning: reasoning.length > 0 ? reasoning : undefined,
          boundingBox: box2d && label ? { box_2d: box2d, label } : undefined,
          usageMetadata: data.usageMetadata,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
      }
    );
  } catch (err) {
    log.error('Clinical Eye analyze error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
