/**
 * POST /api/questions/generate-deep
 * High-fidelity question generation using Deep Context (PANCE blueprint cache).
 * Uses cachedContent (cache_pance_master_v1 or provided name) so the model has
 * 1M+ tokens of depth; distractors are clinically relevant, not random.
 *
 * Sprint 7 (AI Gateway migration): Replaced direct `fetch` to
 * `generativelanguage.googleapis.com` with `gateway.callText()` using
 * task='generation', tier='balanced' (gemini-2.5-flash — same model as before)
 * and the `cachedContent` field. Response-shape handling is unchanged;
 * defensive markdown-fence stripping is added because the gateway's text path
 * doesn't set `responseMimeType: application/json` (structured outputs would
 * require a Zod schema — tracked separately).
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEndpointLogger } from '../_shared/secureLogger';
import { gateway, GatewayError, toGatewayContext } from '../../../lib/ai/aiGateway';
import { runQualityGate } from '@/lib/agents/quality/qualityGate';
import { createClinicalContentValidator } from '@/lib/agents/quality/llmValidator';

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

// Admin-only authoring preview:
// - Deep-context question generation hits Gemini + a 1M-token cache. The
//   endpoint returns non-submittable preview content, never learner-servable
//   questions. Learner routes must use persisted, reviewed session generation.
export const onRequestPost = adminAuthenticatedEndpoint(
  GenerateDeepSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/questions/generate-deep');

    if (!env.GEMINI_API_KEY) {
      return fail(ErrorCode.ENV_MISCONFIGURED, { message: 'AI generation service not configured' });
    }

    const { condition, category, implicitDifficulty, cachedContent, count = 1 } = validated.body;
    const cacheName =
      cachedContent ??
      (typeof (env as { CACHE_PANCE_MASTER_NAME?: string }).CACHE_PANCE_MASTER_NAME === 'string'
        ? (env as { CACHE_PANCE_MASTER_NAME: string }).CACHE_PANCE_MASTER_NAME
        : null);

    if (!cacheName) {
      return fail(ErrorCode.VALIDATION_FAILED, {
        message:
          'No cached content. Provide body.cachedContent or set CACHE_PANCE_MASTER_NAME (run admin knowledge ingest first).',
      });
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
      const normalizedCacheName = cacheName.startsWith('cachedContents/')
        ? cacheName
        : `cachedContents/${cacheName}`;

      let rawText: string;
      try {
        const result = await gateway.callText(toGatewayContext(context), {
          mode: 'text',
          task: 'generation',
          tier: 'balanced', // gemini-2.5-flash — preserves prior endpoint model
          endpoint: '/api/questions/generate-deep',
          userPrompt: prompt,
          temperature: 0.7,
          maxOutputTokens: 4096,
          cachedContent: normalizedCacheName,
        });
        if (result.blocked) {
          logger.warn('Gemini generate-deep blocked by safety filter', {
            reason: result.blockReason ?? 'unknown',
          });
          return fail(ErrorCode.VALIDATION_FAILED, {
            message: 'Generation blocked by safety filter',
          });
        }
        rawText = (result.text ?? '').trim();
      } catch (err) {
        if (err instanceof GatewayError) {
          const status =
            err.code === 'RATE_LIMITED'
              ? 429
              : err.code === 'UNAUTHORIZED' || err.code === 'MISSING_API_KEY'
                ? 500
                : err.code === 'BAD_REQUEST'
                  ? 400
                  : 502;
          logger.warn('Gateway error during generate-deep', {
            code: err.code,
            retryable: err.retryable,
            requestId: err.requestId,
            traceId: err.traceId,
          });
          const errorCode =
            err.code === 'RATE_LIMITED'
              ? ErrorCode.RATE_LIMITED
              : err.code === 'UNAUTHORIZED' || err.code === 'MISSING_API_KEY'
                ? ErrorCode.ENV_MISCONFIGURED
                : err.code === 'BAD_REQUEST'
                  ? ErrorCode.VALIDATION_FAILED
                  : ErrorCode.GEMINI_ERROR;
          return fail(errorCode, {
            message: `Generation failed: ${err.code}`,
            details: err.message.slice(0, 500),
          });
        }
        throw err;
      }

      // Strip markdown code fences if present — the gateway's text path does not
      // force responseMimeType=application/json so the model may wrap JSON in
      // ```json ... ``` fences depending on the prompt.
      let jsonText = rawText;
      if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
      else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
      if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
      jsonText = jsonText.trim();

      let questions: Array<{
        question: string;
        options: string[];
        correctAnswerIndex: number;
        explanation?: string;
        system?: string;
        conditionId?: string;
      }> = [];

      try {
        const parsed = JSON.parse(jsonText) as { questions?: typeof questions };
        if (Array.isArray(parsed.questions)) {
          // Filter out malformed items before serving — a question with missing required
          // fields is worse than no question (undefined behaviour for downstream consumers).
          const REQUIRED_DEEP_FIELDS = ['question', 'options', 'correctAnswerIndex'] as const;
          const valid = parsed.questions.filter((q) => {
            const hasAllRequired = REQUIRED_DEEP_FIELDS.every(
              (f) =>
                f in q && q[f as keyof typeof q] !== null && q[f as keyof typeof q] !== undefined
            );
            const hasEnoughOptions = Array.isArray(q.options) && q.options.length >= 4;
            const hasValidIndex =
              typeof q.correctAnswerIndex === 'number' &&
              q.correctAnswerIndex >= 0 &&
              q.correctAnswerIndex < (q.options?.length ?? 0);
            if (!hasAllRequired || !hasEnoughOptions || !hasValidIndex) {
              logger.warn('generate-deep: filtered malformed question', {
                missingFields: REQUIRED_DEEP_FIELDS.filter(
                  (f) =>
                    !(f in q) ||
                    q[f as keyof typeof q] === null ||
                    q[f as keyof typeof q] === undefined
                ),
                optionCount: Array.isArray(q.options) ? q.options.length : 0,
              });
            }
            return hasAllRequired && hasEnoughOptions && hasValidIndex;
          });
          questions = valid.slice(0, count);
        }
      } catch {
        logger.warn('generate-deep JSON parse failed', { text: rawText.slice(0, 200) });
      }

      // ── Shared quality gate (opt-in via ENABLE_QUALITY_GATE=true) ──
      // Admin-preview filter: quarantined questions are dropped from the
      // response; the validator feedback is logged for the authoring review.
      if (env.ENABLE_QUALITY_GATE === 'true' && questions.length > 0) {
        const gate = createClinicalContentValidator({
          endpoint: '/api/questions/generate-deep#quality-gate',
          task: 'grading',
        });
        const passed: typeof questions = [];
        for (const q of questions) {
          const gateResult = await runQualityGate(
            q,
            { validator: gate, maxRetries: 0 },
            { env, userId: auth?.userId }
          );
          if (gateResult.outcome === 'pass') {
            passed.push(q);
          } else {
            logger.warn('generate-deep: question quarantined by quality gate', {
              question: q.question?.slice(0, 120),
              feedback: gateResult.feedback.slice(0, 3),
            });
          }
        }
        questions = passed;
      }

      logger.info('Deep questions generated', {
        condition,
        count: questions.length,
        userId: auth.userId?.substring(0, 10),
      });

      return ok({
        questions: questions.map((question, index) => ({
          ...question,
          id: `deep-preview-${Date.now()}-${index}`,
          submissionReady: false,
          requiresApproval: true,
          metadata: {
            source: 'generate-deep-preview',
            persistence: 'admin_preview_only',
            adminPreviewOnly: true,
            submissionReady: false,
            requiresApproval: true,
            condition,
            category: category ?? null,
          },
        })),
      });
    } catch (error) {
      logger.error('generate-deep error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to generate deep questions');
    }
  },
  { requestsPerMinute: 25 }
);
