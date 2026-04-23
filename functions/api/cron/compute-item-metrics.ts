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

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  batchAnalyzeItems,
  flaggedItemsForReview,
  type ItemAttemptRecord,
  ITEM_ANALYSIS_THRESHOLDS,
} from '../../../lib/services/itemAnalysisService';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const startTime = Date.now();

    try {
      const questions = await prisma.question.findMany({
        where: { status: 'ACTIVE' },
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

      const qualifying = questions.filter(
        (q) => q.attempts.length >= ITEM_ANALYSIS_THRESHOLDS.MIN_ATTEMPTS
      );

      const userScores = new Map<string, { correct: number; total: number }>();
      for (const q of qualifying) {
        for (const a of q.attempts) {
          const existing = userScores.get(a.userId) ?? { correct: 0, total: 0 };
          existing.total++;
          if (a.wasCorrect) existing.correct++;
          userScores.set(a.userId, existing);
        }
      }

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

      const analyses = batchAnalyzeItems(attemptsByQuestion);
      const flagged = flaggedItemsForReview(analyses);
      const processingTimeMs = Date.now() - startTime;

      return ok({
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
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
