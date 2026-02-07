/**
 * FSRS Parameter Optimization API Endpoint
 *
 * GET: Retrieve user's personalized FSRS parameters
 * POST: Trigger L-BFGS optimization based on review history
 *
 * @module functions/api/user/fsrs-params
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import {
  runFullOptimization,
  canOptimize,
  validateParameters,
  summarizeOptimization,
  type PersonalizedFSRSParams,
} from '../../../lib/fsrs-optimizer';
import { defaultParameters, type ReviewSnapshot } from '../../../lib/fsrs';
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

export function onRequestOptions(context: { request: Request; env: CloudflareEnv }): Response {
  return handleCorsOptions(context);
}

// ============================================================================
// GET: Retrieve User's FSRS Parameters
// ============================================================================

export async function onRequestGet(context: {
  request: Request;
  env: CloudflareEnv;
}): Promise<Response> {
  const { request, env } = context;

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return createErrorResponse(request, 'Unauthorized', 401, 'AUTH_REQUIRED', env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      return createErrorResponse(request, 'User not found', 404, 'USER_NOT_FOUND', env);
    }
    const userId = user.id;

    // Fetch user's personalized params from dedicated table
    const personalizedParams = await prisma.personalizedFSRSParams.findUnique({
      where: { userId },
    });

    // Review count for optimization eligibility: Main Session (real) only.
    const reviewCount = await prisma.reviewLog.count({
      where: {
        userId,
        review_type: 'real',
        sessionType: 'MAIN',
      },
    });

    // Check optimization eligibility
    const optimizationStatus = canOptimize(reviewCount);

    if (personalizedParams) {
      // Return personalized parameters
      const response: FSRSParamsResponse = {
        params: {
          w: personalizedParams.w as number[],
          sampleSize: personalizedParams.sampleSize ?? 0,
          lastOptimizedAt: personalizedParams.lastOptimizedAt?.toISOString() ?? null,
          improvementOverDefault: personalizedParams.improvementOverDefault ?? 0,
          brierScore: personalizedParams.validationBrierScore ?? null,
          defaultBrierScore: null, // Not stored separately
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

      return createSuccessResponse(request, response, 200, 60, env); // Cache for 60 seconds
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

    return createSuccessResponse(request, response, 200, 60, env);
  } catch (error) {
    console.error('[FSRS-Params] GET error:', error);
    return createErrorResponse(
      request,
      error instanceof Error ? error.message : 'Failed to fetch FSRS parameters',
      500,
      'FETCH_ERROR',
      env
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

// ============================================================================
// POST: Trigger FSRS Parameter Optimization
// ============================================================================

export async function onRequestPost(context: {
  request: Request;
  env: CloudflareEnv;
}): Promise<Response> {
  const { request, env } = context;

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return createErrorResponse(request, 'Unauthorized', 401, 'AUTH_REQUIRED', env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Parse optional request body for options
    let forceReoptimize = false;
    let includeSystemModifiers = true;

    try {
      const body = (await request.json()) as {
        forceReoptimize?: boolean;
        includeSystemModifiers?: boolean;
      };
      forceReoptimize = body.forceReoptimize ?? false;
      includeSystemModifiers = body.includeSystemModifiers ?? true;
    } catch {
      // No body or invalid JSON - use defaults
    }

    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      return createErrorResponse(request, 'User not found', 404, 'USER_NOT_FOUND', env);
    }
    const userId = user.id;

    // Main Session (real) review history only – canonical source for FSRS optimization.
    const reviewRows = await prisma.reviewLog.findMany({
      where: {
        userId,
        review_type: 'real',
        sessionType: 'MAIN',
      },
      orderBy: { review_date: 'asc' },
      select: {
        id: true,
        questionFkId: true,
        review_date: true,
        rating: true,
        state: true,
        duration: true,
        stability: true,
        difficulty: true,
        system: true,
      },
    });

    // Build snapshots and system codes for in-process optimizer fallback.
    const allSnapshots: ReviewSnapshot[] = reviewRows.map((r) => ({
      date: r.review_date.toISOString(),
      stability: r.stability,
      difficulty: r.difficulty,
      rating: r.rating as ReviewSnapshot['rating'],
      state: r.state as ReviewSnapshot['state'],
    }));
    const systemCodes: Record<number, string> = {};
    reviewRows.forEach((r, i) => {
      if (includeSystemModifiers && r.system) systemCodes[i] = r.system;
    });

    // Check if we have enough data
    const optimizationStatus = canOptimize(allSnapshots.length);
    if (!optimizationStatus.canOptimize) {
      return createErrorResponse(
        request,
        optimizationStatus.message,
        400,
        'INSUFFICIENT_DATA',
        env
      );
    }

    // Check if re-optimization is needed (unless forced)
    if (!forceReoptimize) {
      const existingParams = await prisma.personalizedFSRSParams.findUnique({
        where: { userId },
      });

      if (existingParams) {
        const hoursSinceOptimization = existingParams.lastOptimizedAt
          ? (Date.now() - existingParams.lastOptimizedAt.getTime()) / 3600000
          : Infinity;

        const reviewsSinceOptimization = reviewRows.length - (existingParams.sampleSize ?? 0);

        // Skip if optimized recently (< 24h) and few new reviews (< 50)
        if (hoursSinceOptimization < 24 && reviewsSinceOptimization < 50) {
          return createSuccessResponse(
            request,
            {
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
            200,
            0,
            env
          );
        }
      }
    }

    // Get previous params for comparison
    const previousParams = await prisma.personalizedFSRSParams.findUnique({
      where: { userId: auth.userId },
      select: { w: true, validationBrierScore: true },
    });

    const startTime = Date.now();
    let optimizedParams: PersonalizedFSRSParams;

    if (shouldUseSidecar(env) && env.FSRS_OPTIMIZER_URL) {
      // Python Cloud Function sidecar
      console.log(
        `[FSRS-Params] Starting sidecar optimization for user ${auth.userId} with ${reviewRows.length} reviews`
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
        optimizedParams = await runFullOptimization(
          userId,
          allSnapshots,
          includeSystemModifiers ? systemCodes : undefined
        );
      }
    } else {
      // In-process TypeScript optimizer
      console.log(
        `[FSRS-Params] Starting in-process optimization for user ${auth.userId} with ${allSnapshots.length} snapshots`
      );
      optimizedParams = await runFullOptimization(
        auth.userId,
        allSnapshots,
        includeSystemModifiers ? systemCodes : undefined
      );
    }

    const optimizationTime = Date.now() - startTime;
    console.log(`[FSRS-Params] Optimization completed in ${optimizationTime}ms`);

    // Validate optimized parameters
    const validation = validateParameters(optimizedParams.w);
    if (!validation.valid) {
      console.error('[FSRS-Params] Invalid parameters produced:', validation.errors);
      return createErrorResponse(
        request,
        'Optimization produced invalid parameters: ' + validation.errors.join(', '),
        500,
        'INVALID_PARAMS',
        env
      );
    }

    // Upsert personalized params to database (Prisma: optimizationIterations)
    await prisma.personalizedFSRSParams.upsert({
      where: { userId: auth.userId },
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
      },
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
      },
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

    return createSuccessResponse(
      request,
      {
        ...result,
        optimizationTimeMs: optimizationTime,
      },
      200,
      0,
      env
    );
  } catch (error) {
    console.error('[FSRS-Params] POST error:', error);
    return createErrorResponse(
      request,
      error instanceof Error ? error.message : 'Optimization failed',
      500,
      'OPTIMIZATION_ERROR',
      env
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
