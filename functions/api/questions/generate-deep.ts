/**
 * POST /api/questions/generate-deep
 * High-fidelity question generation using Deep Context (PANCE blueprint cache).
 * Uses cachedContent (cache_pance_master_v1 or provided name) so the model has
 * 1M+ tokens of depth; distractors are clinically relevant, not random.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const GENERATE_MODEL = 'gemini-1.5-pro';

const GenerateDeepSchema = z.object({
  body: z.object({
    /** Condition or topic (e.g. "Heart Failure", "COPD"). */
    condition: z.string().min(1),
    /** PANCE category / system (e.g. "Cardiology") for cross-reference in cache. */
    category: z.string().optional(),
    /** Implicit difficulty 0–1 from behavioral analysis; influences vignette difficulty. */
    implicitDifficulty: z.number().min(0).max(1).optional(),
    /** Cached content name (e.g. cachedContents/xxx). If omitted, uses env CACHE_PANCE_MASTER_NAME. */
    cachedContent: z.string().min(1).optional(),
    /** Number of questions to generate; default 1. */
    count: z.number().int().min(1).max(5).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GenerateDeepSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate-deep');

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { condition, category, implicitDifficulty, cachedContent, count = 1 } = validated.body;
  const cacheName =
    cachedContent ??
    (typeof (env as { CACHE_PANCE_MASTER_NAME?: string }).CACHE_PANCE_MASTER_NAME === 'string'
      ? (env as { CACHE_PANCE_MASTER_NAME: string }).CACHE_PANCE_MASTER_NAME
      : null);

  if (!cacheName) {
    return new Response(
      JSON.stringify({
        error:
          'No cached content. Provide body.cachedContent or set CACHE_PANCE_MASTER_NAME (run admin knowledge ingest first).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const difficultyHint =
    implicitDifficulty != null
      ? implicitDifficulty < 0.4
        ? 'straightforward recall; minimal distractors'
        : implicitDifficulty < 0.7
          ? 'moderate complexity; one strong distractor'
          : 'challenging; multiple plausible distractors'
      : 'match to PANCE blueprint difficulty';

  const categoryRef = category
    ? ` Cross-reference the "${category}" section of the cached blueprint.`
    : '';

  const prompt = `Generate ${count} high-quality PANCE-style multiple-choice question(s) for the condition: ${condition}.${categoryRef}
Use the cached PANCE blueprint and textbook content as the sole source for accuracy. Ensure the vignette, answer choices, and explanation are clinically accurate and aligned with the cached material.
Difficulty: ${difficultyHint}.
Output valid JSON only, no markdown:
{
  "questions": [
    {
      "question": "stem text",
      "options": ["A text", "B text", "C text", "D text"],
      "correctAnswerIndex": 0,
      "explanation": "brief rationale",
      "system": "e.g. Cardiovascular",
      "conditionId": "optional-id"
    }
  ]
}`;

  try {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
      cachedContent: cacheName.startsWith('cachedContents/')
        ? cacheName
        : `cachedContents/${cacheName}`,
    };

    const res = await fetch(
      `${GEMINI_BASE}/v1beta/models/${GENERATE_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      logger.warn('Gemini generate-deep failed', { status: res.status, text: text.slice(0, 300) });
      return new Response(
        JSON.stringify({ error: `Generation failed: ${res.status}`, details: text.slice(0, 500) }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('')
        ?.trim() ?? '';

    let questions: Array<{
      question: string;
      options: string[];
      correctAnswerIndex: number;
      explanation?: string;
      system?: string;
      conditionId?: string;
    }> = [];

    try {
      const parsed = JSON.parse(text) as { questions?: typeof questions };
      if (Array.isArray(parsed.questions)) {
        questions = parsed.questions.slice(0, count);
      }
    } catch {
      logger.warn('generate-deep JSON parse failed', { text: text.slice(0, 200) });
    }

    logger.info('Deep questions generated', {
      condition,
      count: questions.length,
      userId: auth.userId?.substring(0, 10),
    });

    return new Response(JSON.stringify({ data: { questions } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('generate-deep error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to generate deep questions');
  }
});
