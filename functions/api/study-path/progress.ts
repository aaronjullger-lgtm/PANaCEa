/**
 * GET /api/study‑path/progress
 * Dynamic Study Path Optimizer – Progress endpoint (Phase 6.2).
 *
 * Projects future performance if the current recommended plan is followed (simulation).
 * Returns a timeline of projected retention, accuracy, blueprint coverage, and cumulative study time.
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
import { fetchConfidenceData, computeConfidence } from '@/services/optimizer/confidenceScorer';
import {
  getStudyPathCacheKey,
  getFromCache,
  setInCache,
  isKVAvailable,
  CACHE_CONFIG,
} from '../_shared/cache';
import type { StudyPathConstraints, ProgressResponse, StudyPlan } from '@/types';

// ============================================================================
// Zod Schema for Query Parameters (optional constraints)
// ============================================================================

const StudyPathConstraintsSchema = z.object({
  dailyMinutesLimit: z.coerce.number().int().positive().optional(),
  examDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  targetRetention: z.coerce.number().min(0.5).max(1).optional(),
  focusAreas: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
  excludeAreas: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
  preferredDays: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split(',').map((s) => parseInt(s.trim(), 10)) : undefined
    ),
  maxSessionsPerDay: z.coerce.number().int().positive().optional(),
});

// ============================================================================
// Projection Helper
// ============================================================================

interface ProjectionOptions {
  /** Starting retention (0‑1) */
  baselineRetention: number;
  /** Starting blueprint coverage (0‑1) */
  baselineCoverage: number;
  /** Total projected retention increase after plan completion (0‑1) */
  projectedRetentionIncrease: number;
  /** Target coverage after plan completion (0‑1) */
  targetCoverage: number;
  /** Total estimated minutes of the plan */
  totalMinutes: number;
  /** Sessions sorted by date */
  sessions: StudyPlan['sessions'];
}

function computeProgressProjections({
  baselineRetention,
  baselineCoverage,
  projectedRetentionIncrease,
  targetCoverage,
  totalMinutes,
  sessions,
}: ProjectionOptions): ProgressResponse['projections'] {
  const projections: ProgressResponse['projections'] = [];
  let cumulativeMinutes = 0;
  let cumulativeRetentionIncrease = 0;
  let cumulativeCoverageIncrease = 0;

  // Sort sessions by date ascending
  const sortedSessions = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());

  // For each session, compute cumulative values and project
  for (const session of sortedSessions) {
    const sessionMinutes = session.topics.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    cumulativeMinutes += sessionMinutes;

    // Proportion of total minutes contributed by this session
    const proportion = totalMinutes > 0 ? sessionMinutes / totalMinutes : 0;

    // Increment retention and coverage linearly with proportion
    cumulativeRetentionIncrease += projectedRetentionIncrease * proportion;
    cumulativeCoverageIncrease += (targetCoverage - baselineCoverage) * proportion;

    const projectedRetention = Math.min(1, baselineRetention + cumulativeRetentionIncrease);
    const projectedAccuracy = projectedRetention; // Assume accuracy equals retention for simplicity
    const projectedCoverage = Math.min(1, baselineCoverage + cumulativeCoverageIncrease);

    projections.push({
      date: session.date,
      projectedRetention,
      projectedAccuracy,
      projectedCoverage,
      cumulativeStudyMinutes: cumulativeMinutes,
    });
  }

  return projections;
}

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
  StudyPathConstraintsSchema,
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
      // 1. Parse constraints (validated already validated by authenticatedEndpoint)
      const constraints: StudyPathConstraints = {
        ...(validated.dailyMinutesLimit !== undefined && {
          dailyMinutesLimit: validated.dailyMinutesLimit,
        }),
        ...(validated.examDate !== undefined && { examDate: validated.examDate }),
        ...(validated.targetRetention !== undefined && {
          targetRetention: validated.targetRetention,
        }),
        ...(validated.focusAreas !== undefined && { focusAreas: validated.focusAreas }),
        ...(validated.excludeAreas !== undefined && {
          excludeAreas: validated.excludeAreas,
        }),
        ...(validated.preferredDays !== undefined && {
          preferredDays: validated.preferredDays,
        }),
        ...(validated.maxSessionsPerDay !== undefined && {
          maxSessionsPerDay: validated.maxSessionsPerDay,
        }),
      };

      // 2. Check cache for a plan (same key as recommendation endpoint)
      let plan: StudyPlan | null = null;
      if (isKVAvailable(env.CACHE)) {
        const cacheKey = getStudyPathCacheKey(auth.userId, constraints);
        const cached = await getFromCache<any>(
          env.CACHE,
          cacheKey,
          CACHE_CONFIG.PREFIX.STUDY_PATH
        );
        if (cached?.plan) {
          plan = cached.plan;
        }
      }

      // 3. If no cached plan, generate one (same pipeline as recommendation endpoint)
      if (!plan) {
        // Compute core analysis
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
            targetRetention: constraints.targetRetention ?? 0.9,
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

        // Build Path Generator input
        const pathGeneratorInput = {
          userId: auth.userId,
          constraints,
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

        // Generate study plan
        const pathGeneratorOutput = await generateStudyPlan(pathGeneratorInput);
        plan = pathGeneratorOutput.plan;

        // Cache the whole recommendation (optional)
        if (isKVAvailable(env.CACHE)) {
          const cacheKey = getStudyPathCacheKey(auth.userId, constraints);
          const confidenceInput = await fetchConfidenceData(prisma, auth.userId);
          const confidenceOutput = await computeConfidence(prisma, confidenceInput);
          const recommendation = {
            plan,
            alternatives: pathGeneratorOutput.alternatives,
            rationale: pathGeneratorOutput.rationale,
            confidence: confidenceOutput.confidence,
            canRegenerate: pathGeneratorOutput.canRegenerate,
            generatedAt: new Date(),
          };
          await setInCache(
            env.CACHE,
            cacheKey,
            recommendation,
            CACHE_CONFIG.TTL.STUDY_PATH,
            CACHE_CONFIG.PREFIX.STUDY_PATH
          );
        }
      }

      // 4. Compute baseline metrics (average current accuracy across all gaps)
      const gaps = await analyzePerformanceGaps(prisma, auth.userId, {
        rollingWindowSize: 200,
        includeSubcategories: false,
      });
      let totalWeightedAccuracy = 0;
      let totalReviews = 0;
      for (const gap of gaps) {
        totalWeightedAccuracy += gap.currentAccuracy * gap.reviewCount;
        totalReviews += gap.reviewCount;
      }
      const baselineRetention = totalReviews > 0 ? totalWeightedAccuracy / totalReviews : 0.75;
      // Baseline coverage: assume 0 for simplicity (coverage starts at zero)
      const baselineCoverage = 0;

      // 5. Extract plan metadata
      const totalMinutes = plan.totalEstimatedMinutes;
      const projectedRetentionIncrease = plan.metadata.projectedRetentionIncrease;
      // Compute average blueprint coverage across systems as target coverage
      const blueprintCoverageValues = Object.values(plan.metadata.blueprintCoverage);
      const targetCoverage = blueprintCoverageValues.length > 0
        ? blueprintCoverageValues.reduce((a, b) => a + b, 0) / blueprintCoverageValues.length
        : 0;

      // 6. Generate projections
      const projections = computeProgressProjections({
        baselineRetention,
        baselineCoverage,
        projectedRetentionIncrease,
        targetCoverage,
        totalMinutes,
        sessions: plan.sessions,
      });

      // 7. Calculate overall metrics
      const totalStudyDays = new Set(projections.map(p => p.date.toISOString().split('T')[0])).size;
      const averageDailyMinutes = totalStudyDays > 0
        ? totalMinutes / totalStudyDays
        : 0;

      const response: ProgressResponse = {
        projections,
        currentPlanId: plan.id,
        metrics: {
          totalStudyDays,
          averageDailyMinutes,
          estimatedRetentionIncrease: projectedRetentionIncrease,
        },
      };

      return new Response(JSON.stringify(response, null, 2), {
        status: 200,
        headers: jsonHeaders,
      });
    } catch (error) {
      console.error('Study‑path progress endpoint error:', error);
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
  },
  { source: 'query' }
);