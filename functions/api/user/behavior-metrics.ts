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
 */

import type { EventContext } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface BehaviorMetricsPayload {
  questionId: string;
  questionType?: string;
  timeToFirstClick: number;
  dwellTime: number;
  totalResponseTime: number;
  answerChanges?: number;
  optionHovers?: number;
  scrollDepth?: number;
  hesitationEvents?: number;
  backtrackCount?: number;
  wasCorrect: boolean;
  confidenceLevel?: number;
  derivedRating?: number;
  ratingConfidence?: number;
  trajectoryData?: any;
  typingRhythm?: any;
}

/**
 * Store behavior metrics for a question attempt
 */
export async function onRequestPost(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Parse request body
    let payload: BehaviorMetricsPayload;
    try {
      payload = await context.request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields
    if (!payload.questionId || typeof payload.timeToFirstClick !== 'number' ||
        typeof payload.dwellTime !== 'number' || typeof payload.totalResponseTime !== 'number' ||
        typeof payload.wasCorrect !== 'boolean') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['questionId', 'timeToFirstClick', 'dwellTime', 'totalResponseTime', 'wasCorrect']
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

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

    // Store behavior metrics
    const metrics = await prisma.userBehaviorMetrics.create({
      data: {
        userId,
        questionId: payload.questionId,
        questionType: payload.questionType,
        timeToFirstClick: payload.timeToFirstClick,
        dwellTime: payload.dwellTime,
        totalResponseTime: payload.totalResponseTime,
        answerChanges: payload.answerChanges || 0,
        optionHovers: payload.optionHovers || 0,
        scrollDepth: payload.scrollDepth,
        hesitationEvents: payload.hesitationEvents || 0,
        backtrackCount: payload.backtrackCount || 0,
        timeOfDay,
        deviceType,
        wasCorrect: payload.wasCorrect,
        confidenceLevel: payload.confidenceLevel,
        derivedRating: payload.derivedRating,
        ratingConfidence: payload.ratingConfidence,
        trajectoryData: payload.trajectoryData,
        typingRhythm: payload.typingRhythm,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: metrics.id,
        message: 'Behavior metrics stored successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error storing behavior metrics:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to store behavior metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Get behavior metrics for a user
 * GET /api/user/behavior-metrics?limit=100&offset=0
 */
export async function onRequestGet(context: EventContext<Env, any, Record<string, unknown>>) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult.success || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = authResult.userId;

    // Parse query parameters
    const url = new URL(context.request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const questionId = url.searchParams.get('questionId');

    // Create Prisma client
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Build query
    const where: any = { userId };
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

    return new Response(
      JSON.stringify({
        success: true,
        metrics,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching behavior metrics:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch behavior metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}
