/**
 * Retention Stats API Endpoint
 * GET /api/stats/retention
 * 
 * Returns retention analytics for dashboard visualizations:
 * - Decay curve data (30-day projection)
 * - Stability distribution (buckets)
 * - Due count and review stats
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken, type Env } from '../_shared/auth';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/stats/retention
 */
export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

  try {
    const userId = await verifyAuthToken(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const now = new Date();

    // Get all SRS items for this user
    const srsItems = await prisma.sRSItem.findMany({
      where: { userId },
      select: {
        id: true,
        interval: true,
        dueDate: true,
        lastReviewed: true,
        easiness: true,
        repetition: true,
        fsrsStability: true,
      },
    });

    // Calculate due count
    const dueCount = srsItems.filter((item) => item.dueDate <= now).length;

    // Generate decay curve data (0-30 days)
    const decayCurveData = Array.from({ length: 31 }, (_, day) => {
      // Simplified retention probability based on FSRS average
      const avgStability = srsItems.reduce((sum, item) => sum + (item.fsrsStability || 5), 0) / (srsItems.length || 1);
      const retentionProb = Math.exp(-day / avgStability) * 100;
      return {
        day,
        retentionProb: Math.max(0, Math.min(100, retentionProb)),
      };
    });

    // Stability distribution buckets
    const stabilityBuckets = [
      { bucket: '<1d', count: 0, color: '#ef4444' },
      { bucket: '1-3d', count: 0, color: '#f97316' },
      { bucket: '3-7d', count: 0, color: '#eab308' },
      { bucket: '7-21d', count: 0, color: '#3b82f6' },
      { bucket: '21d+', count: 0, color: '#10b981' },
    ];

    srsItems.forEach((item) => {
      const interval = item.interval;
      if (interval < 1) stabilityBuckets[0].count++;
      else if (interval < 3) stabilityBuckets[1].count++;
      else if (interval < 7) stabilityBuckets[2].count++;
      else if (interval < 21) stabilityBuckets[3].count++;
      else stabilityBuckets[4].count++;
    });

    // Get recent tuning info (mock for now)
    const lastTuned = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
    const tuningReason = 'Pharmacology';
    const adjustment: 'tighten' | 'loosen' = 'tighten';

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          dueCount,
          totalCards: srsItems.length,
          decayCurveData,
          stabilityBuckets,
          lastTuned: lastTuned.toISOString(),
          tuningReason,
          adjustment,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Retention stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch retention stats', details: error?.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
