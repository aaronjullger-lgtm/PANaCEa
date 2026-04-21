/**
 * POST /api/intelligence/socratic-remediation
 *
 * Socratic Remediation: Returns ONE guiding question (NOT the answer) based on
 * the student's wrong answer. Used for "Tutor Me" in Review Mode.
 *
 * Sprint 5 migration notes (AI Gateway):
 *   - Primary/fallback cascade (aiGenerateText → callAIMultiProvider) replaced
 *     by a single `gateway.tutor()` call. Same-provider tier-bump fallback is
 *     the default for 'tutoring', so resilience is preserved without the
 *     duplicate control flow here.
 *   - Gateway handles MISSING_API_KEY internally → dropped validateFunctionEnv.
 *   - Rate limiting moved from ad-hoc `withRateLimit` call to the `aiEndpoint`
 *     wrapper (default 25 req/min per user, same bucket as other AI calls).
 *   - Langfuse tracing stays layered on top — gateway telemetry is separate.
 *   - FALLBACK_QUESTION is still surfaced when the gateway throws, so a failed
 *     Socratic turn never blocks a Review Mode session.
 */

import { z } from 'zod';
import { aiEndpoint } from '../../_shared/middleware';
import { buildSystemPrompt } from '../../_shared/socraticZpd';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import { createTrace, type LangfuseEnv } from '@/lib/observability/langfuse';

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

const FALLBACK_QUESTION =
  'What detail in the vignette suggests your answer might not fit this patient?';

export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { validated, auth } = context;
  const { vignette, question, correctAnswer, userWrongAnswer, options, history, fsrsState, turnNumber } =
    validated.body;

  // Build ZPD-calibrated system prompt (Tier 3) or fall back to the simple prompt.
  const systemPrompt = buildSystemPrompt(
    fsrsState,
    turnNumber ?? (history?.length ?? 0),
    question.slice(0, 100),
  );

  const historyBlock =
    history && history.length > 0
      ? `\nPrior conversation:\n${history
          .map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`)
          .join('\n')}\n\n`
      : '';

  const userPrompt = `Vignette:
${vignette.slice(0, 3000)}

Question: ${question}
Correct answer: "${correctAnswer}"
Student's wrong answer: "${userWrongAnswer}"
${options?.length ? `All options: ${options.join(' | ')}` : ''}
${historyBlock}Generate ONE short guiding question. Do not give the answer.`;

  const maxOutputTokens = (turnNumber ?? 0) >= 3 ? 512 : 256;

  try {
    const result = await gateway.tutor(toGatewayContext(context), {
      endpoint: '/api/intelligence/socratic-remediation',
      systemPrompt,
      userPrompt,
      temperature: 0.5,
      maxOutputTokens,
    });

    if (result.blocked) {
      return { data: { guidingQuestion: FALLBACK_QUESTION } };
    }

    // Langfuse tracing (fire-and-forget — never block the tutor response).
    try {
      const trace = createTrace(context.env as unknown as LangfuseEnv, {
        name: 'socratic-remediation',
        userId: auth.userId,
        tags: ['gateway', 'socratic', result.telemetry.modelUsed],
        metadata: {
          model: result.telemetry.modelUsed,
          provider: result.telemetry.provider,
          latencyMs: result.telemetry.latencyMs,
          fallbackUsed: result.telemetry.fallbackUsed,
        },
      });
      if (trace) {
        trace.generation({
          name: 'socratic-generation',
          model: result.telemetry.modelUsed,
          input: userPrompt.slice(0, 500),
          output: result.text.slice(0, 500),
          usage: {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          },
          modelParameters: { temperature: 0.5, maxTokens: maxOutputTokens },
        });
        const ctx = context as { waitUntil?: (p: Promise<unknown>) => void };
        if (ctx.waitUntil && trace.flush) ctx.waitUntil(trace.flush());
      }
    } catch {
      /* observability must never block the tutor */
    }

    return {
      data: {
        guidingQuestion: result.text.trim() || FALLBACK_QUESTION,
      },
    };
  } catch (err) {
    if (err instanceof GatewayError) {
      console.error('[socratic-remediation] gateway failure', {
        code: err.code,
        requestId: err.requestId,
        traceId: err.traceId,
      });
      if (err.code === 'RATE_LIMITED') {
        return { status: 429, error: 'Rate limit exceeded' };
      }
    } else {
      console.error('[socratic-remediation] unexpected failure:', err);
    }
    // Keep review mode flowing: fall back to a generic guiding question rather
    // than surfacing a 5xx. The student still gets a Socratic nudge.
    return { data: { guidingQuestion: FALLBACK_QUESTION } };
  }
});
