/**
 * GET /api/user/progress-map
 *
 * Returns a mapping of condition IDs to FSRS stability and last review date
 * for the authenticated user. Used by frontend to compute retrievability.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const ProgressMapSchema = z.object({
  // Optional list of condition IDs to filter; if not provided, returns all user progress
  conditionIds: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ProgressMapSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/progress-map');

  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL not configured');
    return {
      data: { error: 'Service unavailable', message: 'Database is not configured.' },
      status: 503,
    };
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return {
        data: { error: 'User not found - must be synced from Clerk webhook first' },
        status: 404,
      };
    }

    // Build where clause
    const where: any = { userId };
    const conditionIdsParam = validated?.conditionIds;
    if (conditionIdsParam) {
      // Support comma-separated list of condition IDs
      const ids = conditionIdsParam.split(',').map((id) => id.trim());
      where.conditionId = { in: ids };
    }

    const progressRecords = await prisma.userProgress.findMany({
      where,
      select: {
        conditionId: true,
        fsrsStability: true,
        lastReviewAt: true,
        fsrsCard: true,
        fsrsParams: true,
      },
    });

    // Fetch personalized FSRS parameters for this user (if they exist)
    const personalizedParams = await prisma.personalizedFSRSParams.findUnique({
      where: { userId },
      select: { w: true },
    });

    // Build map
    const progressMap: Record<string, {
      stability: number | null;
      lastReviewAt: string | null;
      fsrsCard: any | null;
      fsrsParams: any | null;
    }> = {};

    for (const record of progressRecords) {
      // Prefer fsrsCard.stability (authoritative JSON written by drillReviewService)
      // over scalar fsrsStability (which may be stale for rows written before dual-write).
      const cardStability = (record.fsrsCard as { stability?: number } | null)?.stability;
      const stability = cardStability ?? record.fsrsStability;
      progressMap[record.conditionId] = {
        stability,
        lastReviewAt: record.lastReviewAt ? record.lastReviewAt.toISOString() : null,
        fsrsCard: record.fsrsCard,
        fsrsParams: record.fsrsParams,
      };
    }

    logger.info('Progress map fetched', { count: progressRecords.length });

    return {
      data: {
        progressMap,
        personalizedParams: personalizedParams?.w || null,
      },
      headers: { 'Cache-Control': 'private, max-age=60' },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching progress map', { error: errMsg });
    return {
      data: {
        error: 'Failed to fetch progress data',
        message: errMsg || 'Please try again later.',
        progressMap: {},
        personalizedParams: null,
      },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});