/**
 * POST /api/questions/generate-rag
 *
 * Generates PANCE-style questions grounded in clinical reference content
 * via retrieval-augmented generation (RAG).
 *
 * Pipeline:
 *   1. Retrieve relevant clinical content from MedicalContent via pgvector
 *   2. Build grounded prompt with retrieved context
 *   3. Generate questions via LangChain router (multi-provider fallback)
 *   4. Self-refine loop (critique → rewrite) via LangChain
 *   5. Return questions with source citations and retrieval quality metrics
 *
 * @see lib/services/ragContextService.ts — RAG retrieval layer
 * @see lib/langchain/chains/questionGeneration.ts — LangChain generation chain
 * Sprint: LangChain Integration — Sprint 3 (migrated from direct Gemini fetch)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import {
  retrieveForQuestionGeneration,
  formatContextForPrompt,
  assessRetrievalQuality,
  refineRetrievedContext,
} from '../../../lib/services/ragContextService';
import {
  shouldRefine,
  buildCritiquePrompt,
  parseCritiqueResponse,
  buildRewritePrompt,
  buildRefinementMetrics,
  type GeneratedQuestion,
} from '../../../lib/services/selfRefineService';
import {
  generateQuestions,
  critiqueQuestion,
  rewriteQuestion,
} from '../../../lib/langchain/chains/questionGeneration';
import { fromCloudflareEnv } from '../../../lib/langchain/envAdapter';
import { configureLangSmithEnv } from '../../../lib/langchain/tracing';

const BodySchema = z.object({
  conditionName: z.string().min(1).max(200),
  system: z.string().min(1).max(100),
  count: z.number().int().min(1).max(5).optional().default(1),
  questionType: z.enum(['mcq', 'vignette', 'recall']).optional().default('vignette'),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
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
  const aiEnv = fromCloudflareEnv(env as unknown as Record<string, unknown>);
  configureLangSmithEnv(aiEnv);

  const { conditionName, system, count, questionType } = validated;

  try {
    // 1. Retrieve clinical context via RAG
    const rawContext = await retrieveForQuestionGeneration(conditionName, system, prisma, apiKey);

    // 2. Refine: Rerank → CRAG guardrail
    const refined = refineRetrievedContext(
      rawContext,
      `${conditionName} ${system} clinical presentation diagnosis treatment pathophysiology`,
      system,
      conditionName,
      'generation'
    );

    // If CRAG says INCORRECT, bail early — not enough grounding
    if (refined.cragAction === 'INCORRECT') {
      const quality = assessRetrievalQuality(rawContext);
      return {
        data: {
          questions: [],
          ragMetadata: {
            sourceChunkIds: [],
            retrievalQuality: quality.grade,
            retrievalMessage: `CRAG rejected: ${quality.message}`,
            isGrounded: false,
            chunksUsed: 0,
            avgSimilarity: 0,
            cragAction: 'INCORRECT',
            pipelineMetrics: refined.pipelineMetrics,
          },
        },
      };
    }

    const ragContext = refined.context;
    const quality = assessRetrievalQuality(ragContext);

    // Prepend caution prefix if AMBIGUOUS
    const cautionBlock = refined.cautionPrefix ? `${refined.cautionPrefix}\n\n` : '';
    const formattedContext = cautionBlock + formatContextForPrompt(ragContext, 3000);

    // 3. Generate questions via LangChain router (multi-provider fallback)
    let genResult;
    try {
      genResult = await generateQuestions(aiEnv, {
        conditionName,
        system,
        count,
        questionType,
        formattedContext,
      });
    } catch (err) {
      console.error('[generate-rag] LangChain generation failed:', err);
      return { status: 502, error: 'Question generation failed' };
    }

    let questions = genResult.questions;

    // 4. Self-refine loop (draft → critique → rewrite) for qualifying questions
    let refinementMetrics = null;
    const refinedQuestions: unknown[] = [];
    for (const q of questions) {
      const gen = q as GeneratedQuestion;
      if (shouldRefine(gen)) {
        try {
          // Critique via LangChain
          const critiquePromptText = buildCritiquePrompt(gen);
          const critiqueResult = await critiqueQuestion(aiEnv, critiquePromptText);
          const critique = parseCritiqueResponse(critiqueResult.output);

          if (critique.overallScore < 0.8) {
            // Rewrite via LangChain
            const rewritePromptText = buildRewritePrompt(gen, critique);
            const rewriteResult = await rewriteQuestion(aiEnv, rewritePromptText);

            try {
              const cleaned = rewriteResult.output.replace(/```json|```/g, '').trim();
              const rewritten = JSON.parse(cleaned);
              refinedQuestions.push({ ...rewritten, _refined: true });
              refinementMetrics = buildRefinementMetrics(gen, critique);
              continue;
            } catch { /* fall through to original */ }
          }
        } catch (e) {
          console.warn('[generate-rag] Self-refine failed, using original:', e);
        }
      }
      refinedQuestions.push(q);
    }

    // Use refined questions
    questions = refinedQuestions;

    // 5. Attach RAG metadata
    const sourceChunkIds = [...new Set(ragContext.chunks.map((c) => c.sourceId))];

    return {
      data: {
        questions,
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
          cragAction: refined.cragAction,
          pipelineMetrics: refined.pipelineMetrics,
          refinementMetrics,
          langchainMetadata: {
            model: genResult.model,
            provider: genResult.provider,
            latencyMs: genResult.latencyMs,
            usage: genResult.usage,
          },
        },
      },
    };
  } catch (error) {
    console.error('[generate-rag]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'RAG question generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
