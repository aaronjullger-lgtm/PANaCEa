import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/drills/smart-review
 * Fetch SRS items due for review with context
 */
export const onRequestGet = async (context) => {

  const { request, env } = context;

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

  try {
    const now = new Date();

    // Fetch SRS items due today
    const srsItems = await prisma.sRSItem.findMany({
      where: {
        userId,
        dueDate: { lte: now },
      },
      orderBy: [
        { dueDate: 'asc' }, // Most overdue first
        { difficulty: 'desc' }, // Hard cards prioritized
      ],
      take: 20, // Daily review cap
    });

    // Map to frontend-friendly format with reason badges
    const reviewItems = srsItems.map((item) => {
      const overdueDays = Math.floor(
        (now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine reason badge
      let reason = 'due';
      if (overdueDays > 7) reason = 'overdue';
      else if (item.difficulty > 0.5) reason = 'hard';
      else if (item.repetition < 2) reason = 'new';

      return {
        id: item.id,
        questionId: item.questionId,
        dueDate: item.dueDate,
        overdueDays,
        difficulty: item.difficulty,
        stability: item.fsrsStability,
        reason,
      };
    });

    // Aggregate stats
    const totalDue = reviewItems.length;
    const hardCount = reviewItems.filter((i) => i.reason === 'hard').length;
    const overdueCount = reviewItems.filter((i) => i.reason === 'overdue').length;
    const newCount = reviewItems.filter((i) => i.reason === 'new').length;

    return new Response(
      JSON.stringify({
        items: reviewItems,
        stats: {
          totalDue,
          hardCount,
          overdueCount,
          newCount,
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
    console.error('smart-review GET error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch review items', details: error?.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
