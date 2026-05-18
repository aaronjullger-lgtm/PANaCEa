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
import { aiEndpoint } from '../_shared/middleware';
import { ErrorCode } from '../_shared/error-catalog';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { createEndpointLogger } from '../_shared/secureLogger';
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
import { stageGeneratedQuestionPreview } from '../_shared/generated-question-preview';

const BodySchema = z.object({
  conditionName: z.string().min(1).max(200),
  system: z.string().min(1).max(100),
  count: z.number().int().min(1).max(5).optional().default(1),
  questionType: z.enum(['mcq', 'vignette', 'recall']).optional().default('vignette'),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): RAG + self-refine
// loop hits Gemini 2-3× per request (retrieve → generate → critique → rewrite).
// 25 rpm 'ai' bucket matches the real cost profile.
export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };
  const logger = createEndpointLogger('/api/questions/generate-rag', context.auth.userId);

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
      logger.error('RAG question generation failed', {
        conditionName,
        system,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        status: 502,
        code: ErrorCode.GEMINI_ERROR,
        error: 'Question generation failed. No learner-facing question was created.',
      };
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
          if (!critique) {
            refinementMetrics = buildRefinementMetrics(false, 'Critique parsing failed', null);
            refinedQuestions.push(q);
            continue;
          }

          if (critique.overallScore < 0.8) {
            // Rewrite via LangChain
            const rewritePromptText = buildRewritePrompt(gen, critique);
            const rewriteResult = await rewriteQuestion(aiEnv, rewritePromptText);

            try {
              const cleaned = rewriteResult.output.replace(/```json|```/g, '').trim();
              const rewritten = JSON.parse(cleaned);
              refinedQuestions.push({ ...rewritten, _refined: true });
              refinementMetrics = buildRefinementMetrics(true, null, critique);
              continue;
            } catch {
              /* fall through to original */
            }
          }
        } catch (e) {
          logger.warn('RAG self-refine failed; using original generated question', {
            conditionName,
            system,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      refinedQuestions.push(q);
    }

    // Use refined questions
    questions = refinedQuestions;

    // 5. Attach RAG metadata and persist to staging for human review. These are
    // preview-only until the staging approval path promotes them to the live pool.
    const sourceChunkIds = [...new Set(ragContext.chunks.map((c) => c.sourceId))];
    const previewQuestions: Record<string, unknown>[] = [];
    const stagingFailures: string[] = [];

    for (const q of questions) {
      const record =
        q && typeof q === 'object' && !Array.isArray(q) ? (q as Record<string, unknown>) : {};
      const metadata = {
        source: 'rag_question_generate_endpoint',
        conditionName,
        taxonomyCode: system,
        system,
        groundingSources: sourceChunkIds,
        retrievalQuality: quality.grade,
        retrievalMessage: quality.message,
        isGrounded: ragContext.isGrounded,
        cragAction: refined.cragAction,
        chunksUsed: ragContext.chunks.length,
      };

      try {
        const preview = await stageGeneratedQuestionPreview(prisma, {
          question: record,
          system,
          difficulty: record.difficulty ?? 'medium',
          metadata,
        });
        previewQuestions.push(preview);
      } catch (stagingError) {
        const message =
          stagingError instanceof Error ? stagingError.message : 'Unknown staging error';
        stagingFailures.push(message);
        logger.warn('RAG generated question was not staged for review', {
          conditionName,
          system,
          error: message,
        });
        continue;
      }
    }

    if (questions.length > 0 && previewQuestions.length === 0) {
      logger.error('RAG generation produced questions but none could be staged', {
        conditionName,
        system,
        generatedCount: questions.length,
        stagingFailureCount: stagingFailures.length,
      });
      return {
        status: 502,
        code: ErrorCode.DB_ERROR,
        error: 'Generated questions could not be staged for review.',
        details: {
          generatedCount: questions.length,
          stagedCount: 0,
          stagingFailures: stagingFailures.slice(0, 3),
        },
      };
    }

    return {
      data: {
        questions: previewQuestions,
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
          stagingFailureCount: stagingFailures.length,
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
    logger.error('RAG question generation endpoint failed', {
      conditionName,
      system,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 500,
      code: ErrorCode.INTERNAL_ERROR,
      error: 'RAG question generation failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
