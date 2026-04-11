/**
 * POST /api/intelligence/socratic-remediation
 *
 * Socratic Remediation: Returns a guiding question (NOT the answer) based on the
 * student's wrong answer. Used for "Tutor Me" in Review Mode when reviewing incorrect answers.
 * Forces the student to generate the logic and fix the knowledge gap.
 *
 * Migrated to unified ai-service.ts (Phase 5).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../../_shared/rateLimiter';
import { buildSystemPrompt } from '../../_shared/socraticZpd';
import { callGemini, GeminiModel } from '../../_shared/ai-service';

const BodySchema = z.object({
  body: z.object({
    vignette: z.string().min(1),
    question: z.string().min(1),
    correctAnswer: z.string().min(1),
    userWrongAnswer: z.string().min(1),
    options: z.array(z.string()).optional(),
    history: z.array(z.object({ role: z.enum(['user', 'tutor']), text: z.string() })).optional(),
    /** Tier 3: FSRS learner state for ZPD calibration */
    fsrsState: z.object({
      retrievability: z.number().min(0).max(1),
      difficulty: z.number().min(1).max(10),
      stability: z.number().min(0),
      reviewCount: z.number().int().min(0),
      lapseCount: z.number().int().min(0),
    }).optional(),
    /** Tier 3: Current turn number for progressive hint escalation */
    turnNumber: z.number().int().min(0).optional(),
  }),
});

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { vignette, question, correctAnswer, userWrongAnswer, options, history, fsrsState, turnNumber } = validated.body;

  // Build ZPD-calibrated system prompt (Tier 3) or fall back to simple prompt
  const systemPrompt = buildSystemPrompt(fsrsState, turnNumber ?? (history?.length ?? 0), question.slice(0, 100));

  const historyBlock =
    history && history.length > 0
      ? `\nPrior conversation:\n${history.map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n')}\n\n`
      : '';

  const userPrompt = `Vignette:
${vignette.slice(0, 3000)}

Question: ${question}
Correct answer: "${correctAnswer}"
Student's wrong answer: "${userWrongAnswer}"
${options?.length ? `All options: ${options.join(' | ')}` : ''}
${historyBlock}Generate ONE short guiding question. Do not give the answer.`;

  const FALLBACK_QUESTION = 'What detail in the vignette suggests your answer might not fit this patient?';

  try {
    const result = await callGemini(
      { env, auth },
      {
        model: GeminiModel.FLASH_2_5,
        systemInstruction: systemPrompt,
        prompt: userPrompt,
        generationConfig: {
          temperature: 0.5,
          // Hint level 4 (full explanation) needs more tokens than levels 1-3
          maxOutputTokens: (turnNumber ?? 0) >= 3 ? 512 : 256,
        },
        endpoint: '/api/intelligence/socratic-remediation',
      }
    );

    if (result.blocked) {
      return { data: { guidingQuestion: FALLBACK_QUESTION } };
    }

    return {
      data: {
        guidingQuestion: result.text.trim() || FALLBACK_QUESTION,
      },
    };
  } catch (err: unknown) {
    // Graceful degradation: return a generic Socratic question rather than failing
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      return { status: 429, error: 'Rate limit exceeded' };
    }
    return { data: { guidingQuestion: FALLBACK_QUESTION } };
  }
});
