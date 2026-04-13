/**
 * POST /api/cron/compute-item-metrics
 *
 * Batch psychometric item analysis — computes discrimination index,
 * point-biserial correlation, and distractor analysis for questions
 * with sufficient attempts. Flags items for review.
 *
 * Authentication: Bearer token (CRON_SECRET), not user auth.
 *
 * @see lib/services/itemAnalysisService.ts — Pure computation
 */

import { withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';
import {
  batchAnalyzeItems,
  flaggedItemsForReview,
  type ItemAttemptRecord,
  ITEM_ANALYSIS_THRESHOLDS,
} from '../../../lib/services/itemAnalysisService';

export const onRequestOptions = withCors();

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  const authHeader = context.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token || token !== context.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  const startTime = Date.now();

  try {
    // Fetch questions with their attempts
    const questions = await prisma.question.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        correctOptionIndex: true,
        options: true,
        attempts: {
          select: {
            wasCorrect: true,
            selectedOptionIndex: true,
            userId: true,
            timeSpentMs: true,
          },
        },
      },
    });

    // Filter to questions with enough attempts
    const qualifying = questions.filter(
      (q) => q.attempts.length >= ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS
    );

    // Build per-user total scores for the qualifying set
    const userScores = new Map<string, { correct: number; total: number }>();
    for (const q of qualifying) {
      for (const a of q.attempts) {
        const existing = userScores.get(a.userId) ?? { correct: 0, total: 0 };
        existing.total++;
        if (a.wasCorrect) existing.correct++;
        userScores.set(a.userId, existing);
      }
    }

    // Map to ItemAttemptRecord per question
    const attemptsByQuestion = new Map<string, ItemAttemptRecord[]>();
    for (const q of qualifying) {
      const records: ItemAttemptRecord[] = q.attempts.map((a) => {
        const scores = userScores.get(a.userId) ?? { correct: 0, total: 1 };
        return {
          studentId: a.userId,
          isCorrect: a.wasCorrect,
          selectedOption: a.selectedOptionIndex ?? 0,
          totalScore: scores.total > 0 ? scores.correct / scores.total : 0,
          totalItems: scores.total,
          timeSpentMs: a.timeSpentMs ?? undefined,
        };
      });
      attemptsByQuestion.set(q.id, records);
    }

    // Run analysis
    const analyses = batchAnalyzeItems(attemptsByQuestion);
    const flagged = flaggedItemsForReview(analyses);

    const processingTimeMs = Date.now() - startTime;

    return Response.json({
      success: true,
      questionsAnalyzed: qualifying.length,
      questionsWithFlags: flagged.length,
      processingTimeMs,
      flaggedItems: flagged.slice(0, 20).map((f) => ({
        questionId: f.questionId,
        grade: f.grade,
        difficulty: f.difficulty,
        discriminationIndex: f.discriminationIndex,
        pointBiserial: f.pointBiserial,
        flags: f.flags,
      })),
    });
  } catch (error) {
    console.error('Error computing item metrics:', error);
    return Response.json(
      { error: 'Failed to compute item metrics' },
      { status: 500 }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
