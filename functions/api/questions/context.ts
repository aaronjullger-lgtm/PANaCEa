import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../_shared/auth';
import { errorHandler } from '../_shared/error-handler';
import { prisma } from '../_shared/prisma-edge';

/**
 * GET /api/questions/:questionId/context
 * Get rich context information for a question
 *
 * Returns:
 * - Condition metadata
 * - User's performance on this condition
 * - Available high-quality questions for this condition
 * - Related conditions and systems
 * - Study resources
 *
 * Used by QuizView to show contextual learning panel
 */
export async function onRequestGet(
  request: Request,
  context: { params: { questionId: string } }
): Promise<Response> {
  try {
    const user = await requireAuth(request);
    const questionId = context.params.questionId;

    // Get the question and its condition
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        system: true,
        conditionId: true,
        Condition: {
          select: {
            id: true,
            name: true,
            displayName: true,
            system: true,
            content: true,
            relatedSystems: true,
          },
        },
      },
    });

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conditionId = question.conditionId;
    const system = question.system;

    // Get user's performance on this condition
    let conditionPerformance = null;
    if (conditionId) {
      const reviewLogs = await prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          conditionId: conditionId,
        },
        select: {
          wasCorrect: true,
          grade: true,
          reviewedAt: true,
        },
      });

      if (reviewLogs.length > 0) {
        const correctCount = reviewLogs.filter((r) => r.wasCorrect).length;
        const avgGrade =
          reviewLogs.reduce((sum, r) => sum + (r.grade || 0), 0) /
          reviewLogs.length;
        const lastReviewedAt = new Date(
          Math.max(...reviewLogs.map((r) => r.reviewedAt.getTime()))
        );

        conditionPerformance = {
          totalAttempts: reviewLogs.length,
          correctCount,
          accuracy: (correctCount / reviewLogs.length).toFixed(2),
          averageGrade: avgGrade.toFixed(2),
          lastReviewedAt,
        };
      }
    }

    // Get available questions for this condition
    const availableQuestions = await prisma.question.count({
      where: {
        conditionId: conditionId,
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        contentHealthScore: { gte: 0.6 }, // Only high-quality questions
      },
    });

    // Get related conditions in the same system
    const relatedConditions = await prisma.condition.findMany({
      where: {
        system: system,
        id: { not: conditionId || undefined },
        status: 'published',
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        _count: {
          select: {
            Question: {
              where: {
                lifecycleStatus: 'ACTIVE',
                qaStatus: 'APPROVED',
              },
            },
          },
        },
      },
      take: 5,
    });

    // Get recent performance on related conditions
    const relatedPerformance = conditionId
      ? await prisma.reviewLog.findMany({
          where: {
            userId: user.id,
            conditionId: { in: relatedConditions.map((c) => c.id) },
          },
          distinct: ['conditionId'],
          select: {
            conditionId: true,
            wasCorrect: true,
            grade: true,
          },
          orderBy: { reviewedAt: 'desc' },
          take: 5,
        })
      : [];

    // Build response
    const contextData = {
      questionId,
      condition: question.Condition
        ? {
            id: question.Condition.id,
            name: question.Condition.name,
            displayName:
              question.Condition.displayName || question.Condition.name,
            system: question.Condition.system,
            hasContent: !!question.Condition.content,
            relatedSystems: question.Condition.relatedSystems,
          }
        : null,
      system,
      performance: {
        onCondition: conditionPerformance,
        onRelatedConditions: relatedPerformance.length,
      },
      availableQuestions: {
        forCondition: availableQuestions,
        forSystem: await prisma.question.count({
          where: {
            system: system,
            lifecycleStatus: 'ACTIVE',
            qaStatus: 'APPROVED',
            contentHealthScore: { gte: 0.6 },
          },
        }),
      },
      relatedConditions: relatedConditions.map((c) => ({
        id: c.id,
        name: c.name,
        displayName: c.displayName || c.name,
        questionCount: c._count.Question,
      })),
      actions: {
        // Suggest actions based on performance
        suggestedActions: buildSuggestedActions(
          conditionPerformance,
          availableQuestions
        ),
      },
    };

    return new Response(JSON.stringify(contextData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}

/**
 * Build suggested learning actions based on performance
 */
function buildSuggestedActions(
  performance: unknown,
  availableCount: number
): Array<{ action: string; label: string; priority: 'high' | 'medium' | 'low' }> {
  const actions: Array<{ action: string; label: string; priority: 'high' | 'medium' | 'low' }> = [];

  const perf = performance as { accuracy?: string } | null;

  if (!perf) {
    actions.push({
      action: 'study-condition',
      label: 'Study this condition more',
      priority: 'high',
    });
  } else if (perf.accuracy && parseFloat(perf.accuracy) < 0.7) {
    actions.push({
      action: 'target-condition',
      label: 'Target focused practice',
      priority: 'high',
    });
  }

  if (availableCount > 10) {
    actions.push({
      action: 'drill-condition',
      label: 'Start condition drill',
      priority: 'medium',
    });
  }

  actions.push({
    action: 'related-conditions',
    label: 'View related conditions',
    priority: 'low',
  });

  return actions;
}
