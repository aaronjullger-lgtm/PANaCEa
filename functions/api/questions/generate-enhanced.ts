/**
 * POST /api/questions/generate-enhanced
 * Generate high-quality PANCE questions using rich database context.
 * Uses Gemini API with condition data, linked entities, and PANCE task focus.
 *
 * PHASE 4: NEURO-SYMBOLIC INTEGRITY - Milestone 1
 * Now includes Chain of Verification (CoVe) to prevent AI hallucinations.
 *
 * Sprint 7 (AI Gateway migration): Replaced direct `@google/generative-ai`
 * SDK usage with `gateway.callText()`:
 *   - Main generation: task='generation', tier='powerful' (gemini-2.5-pro,
 *     same as before). Temperature = task default (0.75).
 *   - CoVe verification wrapper (`geminiApiCall`): task='grading', tier='balanced'.
 *     Verification is essentially a grading/fact-check task and benefits from
 *     the lower default temperature (0.2) for deterministic answers.
 * Gateway's same_provider fallback replaces the prior silent SDK failure mode.
 *
 * Orchestrator Phase 3: the flow logic now lives in
 * lib/agents/strategies/generateEnhancedStrategy.ts (runGenerateEnhancedFlow).
 * This endpoint delegates to it — one source of truth — and only owns the HTTP
 * envelope. Response shape is unchanged ({status:202, data} | {data}).
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  GenerateEnhancedInputSchema,
  runGenerateEnhancedFlow,
} from '../../../lib/agents/strategies/generateEnhancedStrategy';

const RequestSchema = z.object({ body: GenerateEnhancedInputSchema });

export const onRequestPost = aiEndpoint(RequestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/generate-enhanced');

  try {
    return await runGenerateEnhancedFlow(validated.body, {
      env: {
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        DATABASE_URL: env.DATABASE_URL,
      },
      auth: auth.userId ? { userId: auth.userId } : null,
      waitUntil: context.waitUntil,
      logger,
    });
  } catch (error) {
    logger.error('Error generating enhanced question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to generate enhanced question');
  }
});
