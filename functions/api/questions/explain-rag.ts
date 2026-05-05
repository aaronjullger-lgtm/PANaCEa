/**
 * POST /api/questions/explain-rag
 *
 * Generates a RAG-grounded explanation for why an answer is wrong,
 * what the correct answer is, and the underlying clinical reasoning.
 *
 * Uses retrieved clinical reference content to ground explanations,
 * with KV caching to avoid redundant gateway calls for the same
 * question + answer combo.
 *
 * Pipeline:
 *   1. Check KV cache for existing explanation
 *   2. If miss: retrieve clinical context via RAG
 *   3. Build explanation prompt with correct/wrong answer context
 *   4. Generate via the shared AI gateway with clinical grounding rules
 *   5. Cache result in KV (24h TTL)
 *   6. Return structured explanation with source citations
 *
 * @see lib/services/ragContextService.ts — RAG retrieval layer
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';
import { ErrorCode } from '../_shared/error-catalog';
import type { CloudflareEnv } from '../_shared/types';
import {
  retrieveForExplanation,
  formatContextForPrompt,
  assessRetrievalQuality,
} from '../../../lib/services/ragContextService';
import {
  gateway,
  GatewayError,
  toGatewayContext,
  type GatewayContext,
} from '../../../lib/ai/aiGateway';

const CACHE_TTL_SECONDS = 86400; // 24 hours

const BodySchema = z.object({
  questionId: z.string().min(1).max(100),
  questionText: z.string().min(1).max(5000),
  selectedAnswer: z.string().min(1).max(1000),
  correctAnswer: z.string().min(1).max(1000),
  system: z.string().min(1).max(100),
  allOptions: z.array(z.string()).min(2).max(6).optional(),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string; CACHE?: KVNamespace };

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const ExplanationSchema = z.object({
  whyCorrect: z.string().min(20).max(1500),
  whyWrong: z.string().min(20).max(1500),
  whenWrongWouldBeRight: z.string().min(10).max(1000).nullable(),
  clinicalPearl: z.string().min(10).max(500),
  keyDistinction: z.string().min(5).max(500),
  relatedConcepts: z.array(z.string().min(1).max(120)).min(1).max(6),
});

type Explanation = z.infer<typeof ExplanationSchema>;

function unavailable(reason: string, status = 503) {
  return {
    status,
    error: 'AI explanation is temporarily unavailable.',
    code: ErrorCode.SERVICE_UNAVAILABLE,
    details: {
      reason,
      fallback: false,
      message:
        'No generated clinical explanation was returned because the system could not produce a grounded, validated response.',
    },
  };
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): RAG explanation
// pipeline invokes Gemini + vector retrieval; 25 rpm 'ai' bucket is correct.
export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, [
      'GEMINI_API_KEY',
      'DATABASE_URL',
    ]);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const apiKey = env.GEMINI_API_KEY!;
  const { questionId, questionText, selectedAnswer, correctAnswer, system, allOptions } = validated;
  const logger = createEndpointLogger('/api/questions/explain-rag', context.auth.userId);
  const gwCtx: GatewayContext = toGatewayContext(context);

  try {
    // 1. Check KV cache
    const cacheKey = `explain-rag:${questionId}:${selectedAnswer}`;
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cachedExplanation = ExplanationSchema.safeParse(parsed?.explanation);
          if (parsed?.fallback === true || !cachedExplanation.success) {
            logger.warn('Ignoring stale fallback explanation cache entry', { questionId });
          } else {
            return {
              data: {
                ...parsed,
                explanation: cachedExplanation.data,
                cached: true,
                fallback: false,
              },
            };
          }
        } catch {
          // Corrupted cache — fall through to generate
        }
      }
    }

    // 2. Retrieve clinical context via RAG
    const ragContext = await retrieveForExplanation(
      questionText,
      selectedAnswer,
      correctAnswer,
      system,
      prisma,
      apiKey
    );
    const quality = assessRetrievalQuality(ragContext);
    if (ragContext.chunks.length === 0 || quality.grade === 'none') {
      logger.warn('Explanation unavailable because RAG returned no clinical context', {
        questionId,
        system,
      });
      return unavailable('No relevant clinical reference context was available.');
    }
    const formattedContext = formatContextForPrompt(ragContext, 2500);

    // 3. Build explanation prompt
    const systemInstruction = `You are a clinical educator generating evidence-based explanations for PA students after they answer a question incorrectly. Your explanations must teach the underlying concept, not just state the right answer.

CRITICAL RULES:
- Ground ALL clinical claims in the provided reference context.
- NEVER hallucinate clinical details not present in the context.
- Explain WHY the student's answer is incorrect for THIS specific patient.
- Explain WHY the correct answer fits THIS patient's presentation.
- Include a concise "clinical pearl" that helps prevent this mistake in the future.
- If the wrong answer would be correct in a different scenario, mention that scenario.
- Use clear, direct language appropriate for a PA-S2 student.
- If the provided reference context is insufficient, do not invent facts. Return conservative distinctions only from the context.`;

    const optionContext = allOptions
      ? `\nAll answer choices: ${allOptions.join(', ')}`
      : '';

    const prompt = `${formattedContext}

QUESTION: ${questionText}
${optionContext}
STUDENT SELECTED: ${selectedAnswer}
CORRECT ANSWER: ${correctAnswer}
ORGAN SYSTEM: ${system}

Generate a structured explanation in JSON format:
{
  "whyCorrect": "Why ${correctAnswer} is the best answer for this patient (2-3 sentences, cite clinical evidence)",
  "whyWrong": "Why ${selectedAnswer} is incorrect in this scenario (2-3 sentences, be specific to patient presentation)",
  "whenWrongWouldBeRight": "A brief clinical scenario where ${selectedAnswer} WOULD be the correct answer (1-2 sentences, or null if not applicable)",
  "clinicalPearl": "A memorable teaching point that helps distinguish these concepts (1 sentence)",
  "keyDistinction": "The single most important clinical feature that differentiates the correct from incorrect answer",
  "relatedConcepts": ["concept1", "concept2"]
}

Return ONLY valid JSON. No markdown fences.`;

    // 4. Generate and validate through the AI Gateway. The structured path
    // performs deterministic JSON parsing, Zod validation, telemetry, and one
    // schema-repair pass before failing closed.
    let explanation: Explanation;
    try {
      const result = await gateway.callStructured(gwCtx, {
        mode: 'structured',
        task: 'tutoring',
        tier: 'balanced',
        endpoint: '/api/questions/explain-rag',
        systemPrompt: systemInstruction,
        userPrompt: prompt,
        temperature: 0.4,
        maxOutputTokens: 2048,
        schema: ExplanationSchema,
        schemaDescription:
          'Wrong-answer clinical teaching explanation with whyCorrect, whyWrong, optional whenWrongWouldBeRight, clinicalPearl, keyDistinction, and relatedConcepts.',
      });
      explanation = result.data;
    } catch (err) {
      if (err instanceof GatewayError) {
        logger.warn('Explanation gateway failure', {
          code: err.code,
          retryable: err.retryable,
          requestId: err.requestId,
          traceId: err.traceId,
        });
        if (err.code === 'RATE_LIMITED') {
          return {
            status: 429,
            error: 'AI explanation rate limit exceeded.',
            code: ErrorCode.RATE_LIMITED,
          };
        }
        return unavailable(`Gateway failure: ${err.code}`, 502);
      }
      throw err;
    }

    // 6. Build response with RAG metadata
    const sourceChunkIds = [...new Set(ragContext.chunks.map((c) => c.sourceId))];
    const result = {
      explanation,
      ragMetadata: {
        sourceChunkIds,
        retrievalQuality: quality.grade,
        retrievalMessage: quality.message,
        isGrounded: ragContext.isGrounded,
        chunksUsed: ragContext.chunks.length,
        avgSimilarity:
          ragContext.retrievalScores.length > 0
            ? ragContext.retrievalScores.reduce((a, b) => a + b, 0) /
              ragContext.retrievalScores.length
            : 0,
      },
      cached: false,
      fallback: false,
    };

    // 7. Cache in KV (fire and forget)
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL_SECONDS,
        });
      } catch (cacheErr) {
        logger.warn('KV cache write failed', {
          questionId,
          message: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
        });
      }
    }

    return { data: result };
  } catch (error) {
    logger.error('Explanation generation failed', error, { questionId });
    return unavailable('Unexpected explanation generation failure.');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
