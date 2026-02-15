/**
 * GET /api/user/rolling-360-stats
 *
 * Returns the user's Rolling 360 statistics for dashboard display.
 * Safety: Returns structured empty state for new users instead of 404.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, getSentryTraceId } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { withTimeout, TimeoutError } from '../_shared/timeout';
import { Rolling360Service } from '../../../lib/services/rolling360Service';

const ROLLING_360_TIMEOUT_MS = 8_000; // 8s so we respond before Worker "code had hung" kill

const Rolling360StatsSchema = z.object({
  query: z.object({}).optional(), // No query params expected
});

// Empty state response for new users
const EMPTY_STATE_RESPONSE = {
  scoreConfidence: 'collecting' as const,
  totalInWindow: 0,
  correctInWindow: 0,
  accuracyPercent: null,
  systemStats: {},
  predictedScore: null,
  passLikelihood: null,
  blueprintAdherence: null,
  isValidExamDistribution: false,
  weakestSystems: [],
  strongestSystems: [],
  windowStartTime: null,
  windowEndTime: null,
  message: 'Answer Main Session questions to build your Rolling 360 score.',
  questionsNeeded: 50, // Questions needed for "provisional" confidence
};

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(Rolling360StatsSchema, async (context) => {
  const { env, auth, request } = context;
  const logger = createEndpointLogger('/api/user/rolling-360-stats');
  const sentryTraceId = getSentryTraceId(request);
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const rolling360Service = new Rolling360Service(prisma);
    const stats = await withTimeout(
      rolling360Service.getRolling360Stats(auth.userId, { skipCalibration: true }),
      ROLLING_360_TIMEOUT_MS,
      'Rolling 360 stats request timed out'
    );

    // Safety: Return structured empty state if no data exists
    if (!stats) {
      logger.info('Returning empty state for new user', { userId: auth.userId });
      return { data: EMPTY_STATE_RESPONSE };
    }

    // Calculate questions needed for next confidence level
    let questionsNeeded = 0;
    if (stats.scoreConfidence === 'collecting') {
      questionsNeeded = 50 - stats.totalInWindow;
    } else if (stats.scoreConfidence === 'provisional') {
      questionsNeeded = 180 - stats.totalInWindow;
    }

    logger.info('Fetched Rolling 360 stats', {
      userId: auth.userId,
      totalInWindow: stats.totalInWindow,
      scoreConfidence: stats.scoreConfidence,
    });

    return {
      data: {
        ...stats,
        questionsNeeded: Math.max(0, questionsNeeded),
        message: getConfidenceMessage(stats.scoreConfidence, stats.totalInWindow),
      },
    };
  } catch (error) {
    const isTimeout = error instanceof TimeoutError;
    logger.error(isTimeout ? 'Rolling 360 stats timed out' : 'Error fetching Rolling 360 stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
      sentryTraceId: sentryTraceId ?? undefined,
    });
    return {
      status: isTimeout ? 503 : 500,
      data: {
        error: isTimeout
          ? 'Service temporarily unavailable. Please try again.'
          : 'Failed to fetch statistics',
        ...EMPTY_STATE_RESPONSE,
        ...(sentryTraceId ? { sentryTraceId } : {}),
      },
    };
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
});

function getConfidenceMessage(
  confidence: 'collecting' | 'provisional' | 'confident',
  total: number
): string {
  switch (confidence) {
    case 'collecting':
      return `Building your profile... Answer ${50 - total} more Main Session questions for provisional score.`;
    case 'provisional':
      return `Score is provisional (${total}/360). Answer ${180 - total} more questions for confident prediction.`;
    case 'confident':
      return `Your score is based on ${total} questions matching PANCE distribution.`;
    default:
      return 'Keep studying to build your profile.';
  }
}
