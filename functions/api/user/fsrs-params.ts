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
import type { CloudflareEnv } from '../_shared/types';
import {
  runFullOptimization,
  canOptimize,
  validateParameters,
  summarizeOptimization,
  MIN_REVIEWS_FOR_OPTIMIZATION,
  type PersonalizedFSRSParams,
} from '../../../lib/fsrs-optimizer';
import { defaultParameters, type ReviewSnapshot } from '../../../lib/fsrs';

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

export function onRequestOptions(context: { env: CloudflareEnv }): Response {
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

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return createErrorResponse('Unauthorized', 401, 'AUTH_REQUIRED');
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Fetch user's personalized params from dedicated table
    const personalizedParams = await prisma.personalizedFSRSParams.findUnique({
      where: { userId: auth.userId },
    });

    // Get review count for optimization eligibility
    const reviewCount = await prisma.userProgress.count({
      where: { userId: auth.userId },
    });

    // Check optimization eligibility
    const optimizationStatus = canOptimize(reviewCount);

    if (personalizedParams) {
      // Return personalized parameters
      const response: FSRSParamsResponse = {
        params: {
          w: personalizedParams.w as number[],
          sampleSize: personalizedParams.sampleSize,
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

      return createSuccessResponse(response, 200, 60); // Cache for 60 seconds
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

    return createSuccessResponse(response, 200, 60);
  } catch (error) {
    console.error('[FSRS-Params] GET error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch FSRS parameters',
      500,
      'FETCH_ERROR'
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

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return createErrorResponse('Unauthorized', 401, 'AUTH_REQUIRED');
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

    // Fetch all user progress records with review history
    const userProgressRecords = await prisma.userProgress.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        reviewHistory: true,
        medicalContentId: true,
      },
    });

    // Aggregate all review snapshots
    const allSnapshots: ReviewSnapshot[] = [];
    const systemCodes: Record<number, string> = {};
    let snapshotIndex = 0;

    for (const record of userProgressRecords) {
      const history = record.reviewHistory as ReviewSnapshot[];
      if (Array.isArray(history) && history.length > 0) {
        for (const snapshot of history) {
          allSnapshots.push(snapshot);
          // If we have system info, track it for per-system modifiers
          if (includeSystemModifiers && record.medicalContentId) {
            // Extract system code from medicalContentId (format: SYSTEM-CONDITION)
            const systemCode = record.medicalContentId.split('-')[0];
            if (systemCode) {
              systemCodes[snapshotIndex] = systemCode;
            }
          }
          snapshotIndex++;
        }
      }
    }

    // Check if we have enough data
    const optimizationStatus = canOptimize(allSnapshots.length);
    if (!optimizationStatus.canOptimize) {
      return createErrorResponse(optimizationStatus.message, 400, 'INSUFFICIENT_DATA');
    }

    // Check if re-optimization is needed (unless forced)
    if (!forceReoptimize) {
      const existingParams = await prisma.personalizedFSRSParams.findUnique({
        where: { userId: auth.userId },
      });

      if (existingParams) {
        const hoursSinceOptimization = existingParams.lastOptimizedAt
          ? (Date.now() - existingParams.lastOptimizedAt.getTime()) / 3600000
          : Infinity;

        const reviewsSinceOptimization = allSnapshots.length - existingParams.sampleSize;

        // Skip if optimized recently (< 24h) and few new reviews (< 50)
        if (hoursSinceOptimization < 24 && reviewsSinceOptimization < 50) {
          return createSuccessResponse(
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
            200
          );
        }
      }
    }

    // Get previous params for comparison
    const previousParams = await prisma.personalizedFSRSParams.findUnique({
      where: { userId: auth.userId },
      select: { w: true, validationBrierScore: true },
    });

    // Run L-BFGS optimization
    console.log(
      `[FSRS-Params] Starting optimization for user ${auth.userId} with ${allSnapshots.length} snapshots`
    );
    const startTime = Date.now();

    const optimizedParams = await runFullOptimization(
      auth.userId,
      allSnapshots,
      includeSystemModifiers ? systemCodes : undefined
    );

    const optimizationTime = Date.now() - startTime;
    console.log(`[FSRS-Params] Optimization completed in ${optimizationTime}ms`);

    // Validate optimized parameters
    const validation = validateParameters(optimizedParams.w);
    if (!validation.valid) {
      console.error('[FSRS-Params] Invalid parameters produced:', validation.errors);
      return createErrorResponse(
        'Optimization produced invalid parameters: ' + validation.errors.join(', '),
        500,
        'INVALID_PARAMS'
      );
    }

    // Upsert personalized params to database
    await prisma.personalizedFSRSParams.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        w: optimizedParams.w,
        sampleSize: optimizedParams.sampleSize,
        lastOptimizedAt: optimizedParams.lastOptimizedAt,
        improvementOverDefault: optimizedParams.improvementOverDefault,
        validationBrierScore: optimizedParams.brierScore,
        systemModifiers: optimizedParams.systemModifiers ?? undefined,
      },
      update: {
        w: optimizedParams.w,
        sampleSize: optimizedParams.sampleSize,
        lastOptimizedAt: optimizedParams.lastOptimizedAt,
        improvementOverDefault: optimizedParams.improvementOverDefault,
        validationBrierScore: optimizedParams.brierScore,
        systemModifiers: optimizedParams.systemModifiers ?? undefined,
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
      {
        ...result,
        optimizationTimeMs: optimizationTime,
      },
      200
    );
  } catch (error) {
    console.error('[FSRS-Params] POST error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Optimization failed',
      500,
      'OPTIMIZATION_ERROR'
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
