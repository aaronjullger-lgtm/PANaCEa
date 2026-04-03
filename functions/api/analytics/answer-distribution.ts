/**
 * Answer Distribution API
 * GET /api/analytics/answer-distribution?questionId=xxx
 *
 * Returns peer answer distribution for a given question.
 * Only returns data when ≥10 students have attempted the question
 * (privacy threshold). Falls back to real-time computation if
 * pre-aggregated data isn't available yet.
 *
 * @see functions/api/cron/aggregate-distributions.ts — populates cache
 * @see components/session/AnswerFeedback.tsx — renders the data
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const querySchema = z.object({
  questionId: z.string().min(1),
});

const MIN_ATTEMPTS = 10;

export interface AnswerDistributionEntry {
  optionLetter: string;
  count: number;
  percent: number;
}

export interface AnswerDistributionResponse {
  distribution: AnswerDistributionEntry[] | null;
  totalAttempts: number;
}

export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const { questionId } = context.data;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // First try pre-aggregated data
      const cached = await prisma.questionAnswerDistribution.findUnique({
        where: { questionId },
      });

      if (cached && cached.totalAttempts >= MIN_ATTEMPTS) {
        const dist = cached.distribution as Record<string, number>;
        const total = cached.totalAttempts;

        const distribution: AnswerDistributionEntry[] = Object.entries(dist)
          .map(([letter, count]) => ({
            optionLetter: letter,
            count,
            percent: Math.round((count / total) * 100),
          }))
          .sort((a, b) => a.optionLetter.localeCompare(b.optionLetter));

        return Response.json({
          data: { distribution, totalAttempts: total } satisfies AnswerDistributionResponse,
        });
      }

      // Fallback: compute in real-time from QuestionAttempt
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          questionId,
          selectedAnswer: { not: null },
        },
        select: { selectedAnswer: true },
      });

      if (attempts.length < MIN_ATTEMPTS) {
        return Response.json({
          data: { distribution: null, totalAttempts: attempts.length } satisfies AnswerDistributionResponse,
        });
      }

      // Aggregate
      const counts: Record<string, number> = {};
      for (const attempt of attempts) {
        const letter = normalizeToLetter(attempt.selectedAnswer);
        if (letter) {
          counts[letter] = (counts[letter] || 0) + 1;
        }
      }

      const total = attempts.length;
      const distribution: AnswerDistributionEntry[] = Object.entries(counts)
        .map(([letter, count]) => ({
          optionLetter: letter,
          count,
          percent: Math.round((count / total) * 100),
        }))
        .sort((a, b) => a.optionLetter.localeCompare(b.optionLetter));

      return Response.json({
        data: { distribution, totalAttempts: total } satisfies AnswerDistributionResponse,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

function normalizeToLetter(answer: string | null): string | null {
  if (!answer) return null;
  const trimmed = answer.trim().toUpperCase();
  if (/^[A-E]$/.test(trimmed)) return trimmed;
  const idx = parseInt(trimmed, 10);
  if (!isNaN(idx) && idx >= 0 && idx <= 4) {
    return String.fromCharCode(65 + idx);
  }
  const match = trimmed.match(/^(?:OPTION|CHOICE)\s+([A-E])$/);
  if (match) return match[1];
  return null;
}
