/**
 * POST /api/study‑path/regenerate
 * Dynamic Study Path Optimizer – Regenerate endpoint (Phase 6.2).
 *
 * Accepts new constraints and/or a force‑regenerate flag, invalidates cached plan,
 * and returns a freshly generated study plan.
 *
 * Request body (JSON):
 *   - constraints?: StudyPathConstraints (same as GET endpoint)
 *   - forceRegenerate?: boolean (default false)
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
import { generateStudyPlan } from '@/services/optimizer/pathGenerator';
import { computeConfidence, fetchConfidenceData } from '@/services/optimizer/confidenceScorer';
import {
  getStudyPathCacheKey,
  getFromCache,
  setInCache,
  deleteFromCache,
  isKVAvailable,
  CACHE_CONFIG,
} from '../_shared/cache';
import type { StudyPathConstraints, RecommendationResponse } from '@/types';

// ============================================================================
// Zod Schema for Request Body
// ============================================================================

const StudyPathConstraintsSchema = z.object({
  dailyMinutesLimit: z.number().int().positive().optional(),
  examDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  targetRetention: z.number().min(0.5).max(1).optional(),
  focusAreas: z.array(z.string()).optional(),
  excludeAreas: z.array(z.string()).optional(),
  preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
  maxSessionsPerDay: z.number().int().positive().optional(),
});

const RegeneratePlanRequestSchema = z.object({
  constraints: StudyPathConstraintsSchema.optional(),
  forceRegenerate: z.boolean().default(false),
});

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

export const onRequestPost = authenticatedEndpoint(
  RegeneratePlanRequestSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const corsConfig = getCorsConfig(env);
    const corsHeaders = getCorsHeaders(context.request, corsConfig) ?? {};
    const jsonHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    try {
      const { constraints, forceRegenerate } = validated;

      // 1. Invalidate cache if forceRegenerate is true
      if (forceRegenerate && isKVAvailable(env.CACHE)) {
        const cacheKey = getStudyPathCacheKey(auth.userId, constraints);
        await deleteFromCache(env.CACHE, cacheKey, CACHE_CONFIG.PREFIX.STUDY_PATH);
      }

      // 2. Check cache (unless forceRegenerate)
      let cachedPlan: RecommendationResponse | null = null;
      if (!forceRegenerate && isKVAvailable(env.CACHE)) {
        const cacheKey = getStudyPathCacheKey(auth.userId, constraints);
        cachedPlan = await getFromCache<RecommendationResponse>(
          env.CACHE,
          cacheKey,
          CACHE_CONFIG.PREFIX.STUDY_PATH
        );
        if (cachedPlan) {
          const response: RecommendationResponse = {
            ...cachedPlan,
            cached: true,
            generatedAt: new Date(cachedPlan.generatedAt),
          };
          return new Response(JSON.stringify(response, null, 2), {
            status: 200,
            headers: jsonHeaders,
          });
        }
      }

      // 3. Compute core analysis (Performance Gaps, Scheduled Reviews, Blueprint Balancing)
      const gaps = await analyzePerformanceGaps(prisma, auth.userId, {
        rollingWindowSize: 200,
        includeSubcategories: false,
      });

      const scheduled = await scheduleReviews(
        prisma,
        auth.userId,
        gaps.map((g) => ({
          taxonomyCode: g.taxonomyCode,
          subcategory: g.subcategory,
        })),
        {
          targetRetention: constraints?.targetRetention ?? 0.9,
          tolerance: 0.05,
        }
      );

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
        auth.userId,
        {
          distributionSource: 'recent',
          recentReviewWindow: 100,
          balanceStrength: 0.5,
        }
      );

      // 4. Build Path Generator input
      const pathGeneratorInput = {
        userId: auth.userId,
        constraints: constraints ?? {},
        gaps: gaps.map((g) => ({
          taxonomyCode: g.taxonomyCode,
          subcategory: g.subcategory,
          currentAccuracy: g.currentAccuracy,
          targetAccuracy: g.targetAccuracy,
          gap: g.gap,
          reviewCount: g.reviewCount,
          lastReviewedAt: g.lastReviewedAt,
        })),
        scheduledReviews: scheduled.map((s) => ({
          taxonomyCode: s.taxonomyCode,
          subcategory: s.subcategory,
          recommendedReviewDate: s.recommendedReviewDate,
          urgencyScore: s.urgencyScore,
          confidence: s.confidence,
        })),
        blueprintPriorities: balanced.map((b) => ({
          taxonomyCode: b.taxonomyCode,
          subcategory: b.subcategory,
          priorityScore: b.priorityScore,
          weightDeviation: b.weightDeviation,
        })),
      };

      // 5. Generate study plan
      const pathGeneratorOutput = await generateStudyPlan(pathGeneratorInput);

      // 6. Compute confidence
      const confidenceInput = await fetchConfidenceData(prisma, auth.userId);
      const confidenceOutput = await computeConfidence(prisma, confidenceInput);

      // 7. Assemble final response
      const generatedAt = new Date();
      const validUntil = new Date(generatedAt.getTime() + 3600 * 1000); // 1 hour

      const recommendation: RecommendationResponse = {
        plan: {
          ...pathGeneratorOutput.plan,
          validUntil,
        },
        alternatives: pathGeneratorOutput.alternatives.map((alt) => ({
          ...alt,
          validUntil,
        })),
        rationale: pathGeneratorOutput.rationale,
        confidence: confidenceOutput.confidence,
        canRegenerate: pathGeneratorOutput.canRegenerate,
        cached: false,
        generatedAt,
      };

      // 8. Store in cache (if KV available)
      if (isKVAvailable(env.CACHE)) {
        const cacheKey = getStudyPathCacheKey(auth.userId, constraints);
        await setInCache(
          env.CACHE,
          cacheKey,
          recommendation,
          CACHE_CONFIG.TTL.STUDY_PATH,
          CACHE_CONFIG.PREFIX.STUDY_PATH
        );
      }

      return new Response(JSON.stringify(recommendation, null, 2), {
        status: 200,
        headers: jsonHeaders,
      });
    } catch (error) {
      console.error('Study‑path regenerate endpoint error:', error);
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