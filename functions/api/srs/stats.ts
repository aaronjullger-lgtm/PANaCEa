import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/srs/stats
 * Fetch SRS statistics for dashboard widget
 */
export const onRequestGet = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

  try {
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const userId = authResult;

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

    // Count due items
    const dueCount = await prisma.sRSItem.count({
      where: { userId, dueDate: { lte: now } },
    });

    // Total cards in system
    const totalCards = await prisma.sRSItem.count({
      where: { userId },
    });

    // Mature cards (interval > 21 days)
    const matureCards = await prisma.sRSItem.count({
      where: { userId, interval: { gt: 21 } },
    });

    // Calculate retention rate from recent ranked attempts
    const recentAttempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        isRankedAttempt: true,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      select: { wasCorrect: true },
    });

    const retentionRate =
      recentAttempts.length > 0
        ? Math.round((recentAttempts.filter((a) => a.wasCorrect).length / recentAttempts.length) * 100)
        : 90; // Default if no data

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          dueCount,
          totalCards,
          retentionRate,
          matureCards,
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
    console.error('SRS stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch SRS stats', details: error?.message }),
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
