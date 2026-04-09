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
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  generateBatchVariants,
  assessPoolHealth,
} from '../../../lib/services/batchVariantService';

interface Env {
  GEMINI_API_KEY?: string;
  CRON_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  // Auth: require cron secret for manual triggers
  const authHeader = request.headers.get('Authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let prisma;
  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Parse optional body params
    let systemFilter: string | undefined;
    let maxGenerations = 50;
    try {
      const body = await request.json() as Record<string, unknown>;
      systemFilter = body.system as string | undefined;
      maxGenerations = (body.maxGenerations as number) || 50;
    } catch {
      // No body — use defaults
    }
    // Run batch generation
    const result = await generateBatchVariants(prisma, apiKey, {
      maxGenerations,
      systemFilter,
    });

    // Also get current health snapshot for the response
    const health = await assessPoolHealth(prisma);

    return new Response(
      JSON.stringify({
        success: true,
        generation: result,
        poolHealth: {
          totalConditions: health.totalConditions,
          healthyConditions: health.healthyConditions,
          thinConditions: health.thinConditions,
          emptyConditions: health.emptyConditions,
          coverageBySystem: health.coverageBySystem,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Batch variant generation failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Batch generation failed',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};