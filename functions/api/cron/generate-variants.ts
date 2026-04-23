/**
 * Batch Variant Generation Cron Endpoint
 *
 * Proactively generates question variants for conditions with thin coverage.
 * Runs daily to ensure every condition has >= 3 questions (base + variants)
 * for meaningful spaced repetition with variant rotation.
 *
 * Called by: Cloudflare Scheduled Handler at 4 AM UTC
 * Also callable manually: POST /api/cron/generate-variants
 *
 * Sprint 1D — April 2026
 *
 * Migrated to canonical `cronEndpoint` wrapper (Sprint 9 follow-up):
 *   - Replaces hand-rolled `Authorization: Bearer ${CRON_SECRET}` check with
 *     timing-safe `cronEndpoint` verification (constant-time comparison,
 *     structured logging, unified response envelope).
 *   - Body params validated via Zod schema so the handler receives a typed,
 *     sanitized payload instead of casting `unknown` fields.
 */

import { z } from 'zod';
import { cronEndpoint, ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  generateBatchVariants,
  assessPoolHealth,
} from '../../../lib/services/batchVariantService';

/**
 * Body schema for the cron trigger. All fields optional so the default
 * scheduled run (no body) just falls through to service defaults.
 * - `system`: optional organ-system filter (e.g. "Cardiovascular") to scope
 *   variant generation during targeted catch-up runs.
 * - `maxGenerations`: hard ceiling on API spend for this invocation; clamped
 *   to a realistic range so a typo can't burn the whole Gemini budget.
 */
const GenerateVariantsBodySchema = z.object({
  system: z.string().min(1).max(64).optional(),
  maxGenerations: z.number().int().min(1).max(500).optional(),
});

export const onRequestPost = cronEndpoint({
  schema: GenerateVariantsBodySchema,
  handler: async (context) => {
    const env = context.env as Record<string, string | undefined>;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return fail(ErrorCode.ENV_MISCONFIGURED, {
        message: 'GEMINI_API_KEY not configured',
        request: context.request,
      });
    }

    const { system: systemFilter, maxGenerations = 50 } = context.validated;

    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL as string);

      // Run batch generation
      const result = await generateBatchVariants(prisma, apiKey, {
        maxGenerations,
        systemFilter,
      });

      // Also get current health snapshot for the response
      const health = await assessPoolHealth(prisma);

      return ok(
        {
          generation: result,
          poolHealth: {
            totalConditions: health.totalConditions,
            healthyConditions: health.healthyConditions,
            thinConditions: health.thinConditions,
            emptyConditions: health.emptyConditions,
            coverageBySystem: health.coverageBySystem,
          },
        },
        { request: context.request }
      );
    } catch (error) {
      console.error('[generate-variants] Batch variant generation failed:', error);
      return fail(ErrorCode.INTERNAL_ERROR, {
        message: error instanceof Error ? error.message : 'Batch generation failed',
        request: context.request,
      });
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  },
});
