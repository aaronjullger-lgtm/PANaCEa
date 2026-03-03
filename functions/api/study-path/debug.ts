/**
 * GET /api/study‑path/debug
 * Debug endpoint for the Dynamic Study Path Optimizer (Phase 6.1).
 *
 * Returns raw performance gap analysis, retention‑aware scheduling,
 * and blueprint‑balanced priorities for the authenticated user.
 *
 * Authentication required (Clerk).
 */

import { z } from 'zod';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { getCorsConfig, getCorsHeaders } from '../_shared/cors';
import { analyzePerformanceGaps } from '@/services/optimizer/performanceGapAnalyzer';
import { scheduleReviews } from '@/services/optimizer/retentionAwareScheduler';
import { balanceBlueprintPriorities } from '@/services/optimizer/blueprintBalancedSelector';

// ============================================================================
// Request Handler
// ============================================================================

export const onRequestOptions = async (context: any) => {
  const corsConfig = context?.env ? getCorsConfig(context.env) : undefined;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request, corsConfig) ?? {},
  });
};

export const onRequestGet = authenticatedEndpoint(
  z.object({}), // No query/body parameters required
  async ({ userId, env, request }) => {
    const corsConfig = getCorsConfig(env);
    const corsHeaders = getCorsHeaders(request, corsConfig) ?? {};
    const jsonHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      // 1. Performance Gap Analysis
      const gaps = await analyzePerformanceGaps(prisma, userId, {
        rollingWindowSize: 200,
        includeSubcategories: false,
      });

      // 2. Retention‑Aware Scheduling
      const scheduled = await scheduleReviews(
        prisma,
        userId,
        gaps.map((g) => ({
          taxonomyCode: g.taxonomyCode,
          subcategory: g.subcategory,
        })),
        {
          targetRetention: 0.90,
          tolerance: 0.05,
        }
      );

      // 3. Blueprint‑Balanced Priority
      const balanced = await balanceBlueprintPriorities(
        gaps.map((g) => ({
          taxonomyCode: g.taxonomyCode,
          subcategory: g.subcategory,
          gap: g.gap,
        })),
        scheduled.map((s) => ({
          taxonomyCode: s.taxonomyCode,
          subcategory: s.subcategory,
        })),
        prisma,
        userId,
        {
          distributionSource: 'recent',
          recentReviewWindow: 100,
          balanceStrength: 0.5,
        }
      );

      // 4. Compile debug output
      const debugOutput = {
        meta: {
          userId,
          timestamp: new Date().toISOString(),
          phase: '6.1',
          description: 'Dynamic Study Path Optimizer – Core Analysis Engine',
        },
        performanceGaps: gaps,
        scheduledReviews: scheduled,
        blueprintBalanced: balanced,
      };

      return new Response(JSON.stringify(debugOutput, null, 2), {
        status: 200,
        headers: jsonHeaders,
      });
    } catch (error) {
      console.error('Study‑path debug endpoint error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: jsonHeaders,
        }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);