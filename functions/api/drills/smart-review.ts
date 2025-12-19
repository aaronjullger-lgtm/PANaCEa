import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/drills/smart-review
 * Fetch SRS items due for review with context
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

      let srsReason: 'OVERDUE' | 'WEAK_SPOT' | 'NEW' = 'NEW';
      if (overdueDays > 2) srsReason = 'OVERDUE';
      else if (item.difficulty > 0.6) srsReason = 'WEAK_SPOT';

      return {
        id: item.id,
        questionId: item.questionId,
        srsReason,
        overdueDays,
        difficulty: item.difficulty,
        interval: item.interval,
        lastReviewed: item.lastReviewed,
      };
    });

    // Fetch question data for each item
    const questionIds = reviewItems.map((i) => i.questionId);
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: { id: { in: questionIds } },
    });

    const questionsMap = new Map(questions.map((q) => [q.id, q]));

    const enrichedItems = reviewItems.map((item) => {
      const question = questionsMap.get(item.questionId);
      const qData: any = question ? ((question as any).questionData || {}) : {};

      return {
        ...item,
        question: {
          id: (question as any)?.id || item.questionId,
          stem: qData.stem || qData.question || qData.vignette || 'Question not found',
          choices: qData.choices || qData.options || [],
          correctAnswer: qData.correctAnswer || qData.answer || null,
          explanation: qData.explanation || '',
          system: (question as any)?.system || 'General',
          difficulty: (question as any)?.difficulty || 'medium',
        },
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        items: enrichedItems,
        total: enrichedItems.length,
        message: enrichedItems.length === 0 ? 'All caught up! No reviews due.' : undefined,
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
  }
};
