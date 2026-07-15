/**
 * FSRS Parameter Optimization API Endpoint
 *
 * GET: Retrieve user's personalized FSRS parameters
 * POST: Trigger L-BFGS optimization based on review history
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (GET 300/min,
 * POST 30/min for heavy optimization), CORS, structured logging.
 *
 * @module functions/api/user/fsrs-params
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  runFullOptimizationFromReviewLog,
  canOptimize,
  validateParameters,
  summarizeOptimization,
  type PersonalizedFSRSParams,
} from '../../../lib/fsrs-optimizer';
import { defaultParameters, isParamsOnCurrentScale } from '../../../lib/fsrs';
import {
  triggerFSRSOptimization,
  shouldUseSidecar,
  type ReviewLogRow,
} from '../../../lib/fsrsOptimizerSidecar';
import { resolveUserByClerkId } from '../_shared/resolveUser';

// ============================================================================
// Types
// ============================================================================

interface FSRSParamsResponse {
  params: {
    w: number[];
    sampleSize: number;
    lastOptimizedAt: string | null;
    improvementOverDefault: number;
    brierScore: number | null;
    defaultBrierScore: number | null;
    systemModifiers?: Record<
      string,
      {
        stabilityMultiplier: number;
        difficultyOffset: number;
        sampleSize: number;
        accuracy: number;
      }
    >;
  };
  isDefault: boolean;
  canOptimize: boolean;
  reviewsNeeded: number;
  message: string;
}

interface OptimizationResult {
  success: boolean;
  params: PersonalizedFSRSParams;
  summary: string;
  previousParams?: {
    w: number[];
    brierScore: number | null;
  };
}

// ============================================================================
// CORS Handler
// ============================================================================

// ============================================================================
// GET: Retrieve User's FSRS Parameters
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await resolveUserByClerkId(prisma, auth.userId);
      if (!user) {
        return { status: 404, error: 'User not found' };
      }
      const userId = user.id;

      // Fetch user's personalized params from dedicated table.
      // Off-scale guard: if stored w[19]/w[20] are from the legacy L-BFGS
      // optimizer (pre-2026-04), treat them as absent so the client sees
      // canonical defaults and can trigger re-optimization.
      const rawPersonalizedParams = await prisma.personalizedFSRSParams.findUnique({
        where: { userId },
      });
      const personalizedParams = isParamsOnCurrentScale(
        rawPersonalizedParams?.w as number[] | undefined
      )
        ? rawPersonalizedParams
        : null;

      // Review count for optimization eligibility: real MAIN + DRILL reviews only.
      const reviewCount = await prisma.reviewLog.count({
        where: {
          userId,
          review_type: 'real',
          sessionType: { in: ['MAIN', 'DRILL'] },
        },
      });

      // Check optimization eligibility
      const optimizationStatus = canOptimize(reviewCount);

      if (personalizedParams) {
        const response: FSRSParamsResponse = {
          params: {
            w: personalizedParams.w as number[],
            sampleSize: personalizedParams.sampleSize ?? 0,
            lastOptimizedAt: personalizedParams.lastOptimizedAt?.toISOString() ?? null,
            improvementOverDefault: personalizedParams.improvementOverDefault ?? 0,
            brierScore: personalizedParams.validationBrierScore ?? null,
            defaultBrierScore: null,
            systemModifiers: personalizedParams.systemModifiers as
              | Record<
                  string,
                  {
                    stabilityMultiplier: number;
                    difficultyOffset: number;
                    sampleSize: number;
                    accuracy: number;
                  }
                >
              | undefined,
          },
          isDefault: false,
          canOptimize: optimizationStatus.canOptimize,
          reviewsNeeded: optimizationStatus.reviewsNeeded,
          message: optimizationStatus.message,
        };

        return { data: response };
      }

      // Return default parameters
      const response: FSRSParamsResponse = {
        params: {
          w: [...defaultParameters.w],
          sampleSize: 0,
          lastOptimizedAt: null,
          improvementOverDefault: 0,
          brierScore: null,
          defaultBrierScore: null,
          systemModifiers: undefined,
        },
        isDefault: true,
        canOptimize: optimizationStatus.canOptimize,
        reviewsNeeded: optimizationStatus.reviewsNeeded,
        message: optimizationStatus.message,
      };

      return { data: response };
    } catch (error) {
      createEndpointLogger('/api/user/fsrs-params').error('FSRS params GET error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: 500,
        error: 'Failed to fetch FSRS parameters. Please try again.',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ============================================================================
// POST: Trigger FSRS Parameter Optimization
// ============================================================================

const OptimizeBodySchema = z.object({
  body: z
    .object({
      forceReoptimize: z.boolean().optional().default(false),
      includeSystemModifiers: z.boolean().optional().default(true),
    })
    .optional()
    .default({}),
});

export const onRequestPost = authenticatedEndpoint(
  OptimizeBodySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const forceReoptimize = validated?.body?.forceReoptimize ?? false;
      const includeSystemModifiers = validated?.body?.includeSystemModifiers ?? true;

      const user = await resolveUserByClerkId(prisma, auth.userId);
      if (!user) {
        return { status: 404, error: 'User not found' };
      }
      const userId = user.id;

      // Real MAIN + DRILL review history only. These are the only flows that
      // update FSRS state and therefore the only rows safe for personalization.
      const reviewRows = await prisma.reviewLog.findMany({
        where: {
          userId,
          review_type: 'real',
          sessionType: { in: ['MAIN', 'DRILL'] },
        },
        orderBy: { reviewedAt: 'asc' },
        select: {
          id: true,
          questionFkId: true,
          reviewedAt: true,
          grade: true,
          effectiveGrade: true,
          state: true,
          responseTimeMs: true,
          stability: true,
          difficulty: true,
          elapsedDays: true,
          wasCorrect: true,
          system: true,
        },
      });

      const rowsForOptimization = includeSystemModifiers
        ? reviewRows
        : reviewRows.map((row) => ({ ...row, system: null }));

      // Check if we have enough data
      const optimizationStatus = canOptimize(reviewRows.length);
      if (!optimizationStatus.canOptimize) {
        return { status: 400, error: optimizationStatus.message };
      }

      // Check if re-optimization is needed (unless forced)
      if (!forceReoptimize) {
        const existingParams = await prisma.personalizedFSRSParams.findUnique({
          where: { userId },
        });

        // Always re-optimize if the existing params are off-scale (legacy
        // pre-2026-04 L-BFGS output). The recency throttle otherwise would
        // trap such users on broken params for up to 24 hours.
        const storedOnScale = isParamsOnCurrentScale(
          existingParams?.w as number[] | undefined
        );

        if (existingParams && storedOnScale) {
          const hoursSinceOptimization = existingParams.lastOptimizedAt
            ? (Date.now() - existingParams.lastOptimizedAt.getTime()) / 3600000
            : Infinity;

          const reviewsSinceOptimization = reviewRows.length - (existingParams.sampleSize ?? 0);

          if (hoursSinceOptimization < 24 && reviewsSinceOptimization < 50) {
            return {
              data: {
                success: false,
                skipped: true,
                reason: 'Recently optimized with insufficient new data',
                hoursSinceOptimization: Math.round(hoursSinceOptimization),
                reviewsSinceOptimization,
                existingParams: {
                  w: existingParams.w,
                  sampleSize: existingParams.sampleSize,
                  improvementOverDefault: existingParams.improvementOverDefault,
                },
              },
            };
          }
        }
      }

      // Get previous params for comparison
      const previousParams = await prisma.personalizedFSRSParams.findUnique({
        where: { userId },
        select: { w: true, validationBrierScore: true },
      });

      const startTime = Date.now();
      let optimizedParams: PersonalizedFSRSParams;

      if (shouldUseSidecar(env) && env.FSRS_OPTIMIZER_URL) {
        // Python Cloud Function sidecar
        console.log(
          `[FSRS-Params] Starting sidecar optimization for user ${userId} with ${reviewRows.length} reviews`
        );
        try {
          const sidecarResult = await triggerFSRSOptimization(
            userId,
            reviewRows as ReviewLogRow[],
            env
          );
          optimizedParams = {
            userId,
            w: sidecarResult.w,
            sampleSize: sidecarResult.sampleSize,
            lastOptimizedAt: sidecarResult.lastOptimizedAt,
            improvementOverDefault: sidecarResult.improvementOverDefault,
            brierScore: sidecarResult.brierScore ?? 0,
            defaultBrierScore: sidecarResult.defaultBrierScore ?? 0,
            iterations: sidecarResult.optimizationIterations ?? 0,
            systemModifiers: undefined,
          };
        } catch (sidecarError) {
          console.warn('[FSRS-Params] Sidecar failed, falling back to in-process:', sidecarError);
          optimizedParams = runFullOptimizationFromReviewLog(userId, rowsForOptimization);
        }
      } else {
        // In-process TypeScript optimizer
        console.log(
          `[FSRS-Params] Starting in-process optimization for user ${userId} with ${reviewRows.length} reviews`
        );
        optimizedParams = runFullOptimizationFromReviewLog(userId, rowsForOptimization);
      }

      const optimizationTime = Date.now() - startTime;
      console.log(`[FSRS-Params] Optimization completed in ${optimizationTime}ms`);

      // Validate optimized parameters
      const validation = validateParameters(optimizedParams.w);
      if (!validation.valid) {
        console.error('[FSRS-Params] Invalid parameters produced:', validation.errors);
        return {
          status: 500,
          error: 'Optimization produced invalid parameters: ' + validation.errors.join(', '),
        };
      }

      // Algorithm version tag derived from parameter shape (21 -> '6', 29 -> '7-alpha').
      // Persisted to PersonalizedFSRSParams.version IF the column exists; otherwise
      // silently dropped by Prisma (pre-migration state). Once the paired DDL at
      // prisma/audit/proposed_migration_personalized_fsrs_params_version.sql is
      // applied, this field becomes a source of truth for admin tooling.
      const algoVersion: '6' | '7-alpha' =
        optimizedParams.w.length === 29 ? '7-alpha' : '6';

      // Upsert personalized params to database.
      // `as any` casts guard against the pre-migration state where the `version`
      // column does not yet exist in Postgres. Remove them after applying the
      // migration and running `prisma generate`.
      await prisma.personalizedFSRSParams.upsert({
        where: { userId },
        create: {
          userId,
          w: optimizedParams.w,
          sampleSize: optimizedParams.sampleSize,
          lastOptimizedAt: optimizedParams.lastOptimizedAt,
          improvementOverDefault: optimizedParams.improvementOverDefault,
          validationBrierScore: optimizedParams.brierScore,
          optimizationIterations: optimizedParams.iterations ?? undefined,
          systemModifiers:
            optimizedParams.systemModifiers != null
              ? (JSON.parse(JSON.stringify(optimizedParams.systemModifiers)) as object)
              : undefined,
          version: algoVersion,
        } as any,
        update: {
          w: optimizedParams.w,
          sampleSize: optimizedParams.sampleSize,
          lastOptimizedAt: optimizedParams.lastOptimizedAt,
          improvementOverDefault: optimizedParams.improvementOverDefault,
          validationBrierScore: optimizedParams.brierScore,
          optimizationIterations: optimizedParams.iterations ?? undefined,
          systemModifiers:
            optimizedParams.systemModifiers != null
              ? (JSON.parse(JSON.stringify(optimizedParams.systemModifiers)) as object)
              : undefined,
          version: algoVersion,
        } as any,
      });

      // Generate summary
      const summary = summarizeOptimization(optimizedParams);

      const result: OptimizationResult = {
        success: true,
        params: optimizedParams,
        summary,
        previousParams: previousParams
          ? {
              w: previousParams.w as number[],
              brierScore: previousParams.validationBrierScore,
            }
          : undefined,
      };

      return {
        data: {
          ...result,
          optimizationTimeMs: optimizationTime,
        },
      };
    } catch (error) {
      createEndpointLogger('/api/user/fsrs-params').error('FSRS params POST (optimization) error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: 500,
        error: 'Optimization failed. Please try again.',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);
