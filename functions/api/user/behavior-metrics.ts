/**
 * User Behavior Metrics API
 *
 * Stores implicit behavioral data collected during question interactions.
 * This enables:
 * - Behavioral FSRS rating derivation
 * - Learning pattern analysis
 * - Personalized difficulty adjustment
 * - Time-of-day performance tracking
 *
 * POST /api/user/behavior-metrics
 * GET /api/user/behavior-metrics
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const BehaviorMetricsPostSchema = z.object({
  questionId: z.string().min(1),
  questionType: z.string().optional(),
  timeToFirstClick: z.number().min(0),
  dwellTime: z.number().min(0),
  totalResponseTime: z.number().min(0),
  answerChanges: z.number().int().min(0).optional(),
  optionHovers: z.number().int().min(0).optional(),
  scrollDepth: z.number().min(0).max(100).optional(),
  hesitationEvents: z.number().int().min(0).optional(),
  backtrackCount: z.number().int().min(0).optional(),
  wasCorrect: z.boolean(),
  confidenceLevel: z.number().min(0).max(1).optional(),
  derivedRating: z.number().min(1).max(4).optional(),
  ratingConfidence: z.number().min(0).max(1).optional(),
  trajectoryData: z.any().optional(),
  typingRhythm: z.any().optional(),
});

const BehaviorMetricsGetSchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  questionId: z.string().optional(),
});

export const onRequestOptions = withCors();

/**
 * Store behavior metrics for a question attempt
 */
export const onRequestPost = authenticatedEndpoint(BehaviorMetricsPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/behavior-metrics');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const payload = validated;

    // Resolve clerkId to internal userId
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('User not found for behavior metrics', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }

    const internalUserId = user.id;

    // Get current hour for timeOfDay
    const now = new Date();
    const timeOfDay = now.getHours();

    // Detect device type from user agent
    const userAgent = context.request.headers.get('user-agent') || '';
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    // Convert confidenceLevel from float (0-1) to int (1-5) for database
    const confidenceLevelInt = payload.confidenceLevel === undefined
      ? undefined
      : Math.round(payload.confidenceLevel * 4) + 1;  // 0-1 -> 1-5

    // Store behavior metrics
    const metrics = await prisma.userBehaviorMetrics.create({
      data: {
        userId: internalUserId,
        questionId: payload.questionId,
        questionType: payload.questionType,
        timeToFirstClick: payload.timeToFirstClick,
        dwellTime: payload.dwellTime,
        totalResponseTime: payload.totalResponseTime,
        answerChanges: payload.answerChanges || 0,
        optionHovers: payload.optionHovers || 0,
        scrollDepth: payload.scrollDepth === undefined ? undefined : Math.round(payload.scrollDepth),
        hesitationEvents: payload.hesitationEvents || 0,
        backtrackCount: payload.backtrackCount || 0,
        timeOfDay,
        deviceType,
        wasCorrect: payload.wasCorrect,
        confidenceLevel: confidenceLevelInt,
        derivedRating: payload.derivedRating === undefined ? undefined : Math.round(payload.derivedRating),
        ratingConfidence: payload.ratingConfidence,
        trajectoryData: payload.trajectoryData,
        typingRhythm: payload.typingRhythm,
      },
    });

    logger.info('Stored behavior metrics', {
      userId: auth.userId,
      questionId: payload.questionId,
      metricsId: metrics.id,
    });

    return {
      data: {
        id: metrics.id,
        message: 'Behavior metrics stored successfully',
      },
      status: 201,
    };
  } catch (error) {
    logger.error('Error storing behavior metrics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to store behavior metrics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * Get behavior metrics for a user
 */
export const onRequestGet = authenticatedEndpoint(
  BehaviorMetricsGetSchema,
  async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/behavior-metrics');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Resolve clerkId to internal userId
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    const internalUserId = user.id;

    // Parse query parameters
    const limit = Math.min(Number.parseInt(validated.limit || '100', 10), 500);
    const offset = Number.parseInt(validated.offset || '0', 10);
    const questionId = validated.questionId;

    // Build query
    const where: any = { userId: internalUserId };
    if (questionId) {
      where.questionId = questionId;
    }

    // Fetch metrics
    const metrics = await prisma.userBehaviorMetrics.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get total count
    const total = await prisma.userBehaviorMetrics.count({ where });

    logger.info('Fetched behavior metrics', {
      userId: auth.userId,
      count: metrics.length,
      total,
    });

    return {
      data: {
        metrics,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching behavior metrics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch behavior metrics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
  },
  { source: 'query' }
);
