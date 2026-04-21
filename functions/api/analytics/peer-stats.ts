/**
 * Peer Statistics API — Wisdom of the Crowds
 * GET /api/analytics/peer-stats?questionId=xxx
 *
 * Returns answer distribution percentages for a question.
 * Privacy: Only returns stats when ≥10 students have attempted (prevents
 * small-cohort de-anonymization).
 *
 * Uses pre-aggregated QuestionAnswerDistribution cache when available,
 * falls back to real-time computation from QuestionAttempt.
 *
 * @see functions/api/cron/aggregate-distributions.ts — cache populator
 * @see components/session/AnswerFeedback.tsx — UI consumer
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const querySchema = z.object({
  questionId: z.string().min(1),
});

const MIN_ATTEMPTS = 10;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  querySchema,
  async (context) => {
    const { questionId } = context.validated;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Try pre-aggregated cache first
      const cached = await (prisma as any).questionAnswerDistribution.findUnique({
        where: { questionId },
      }).catch(() => null); // Table might not exist yet — graceful fallback

      if (cached && cached.totalAttempts >= MIN_ATTEMPTS) {
        const dist = cached.distribution as Record<string, number>;
        const total = cached.totalAttempts;

        const distribution = Object.entries(dist)
          .map(([letter, count]) => ({
            optionLetter: letter,
            count,
            percent: Math.round((count / total) * 100),
          }))
          .sort((a, b) => b.count - a.count);

        return Response.json({
          data: { distribution, totalAttempts: total },
        });
      }

      // Fallback: real-time computation from QuestionAttempt
      const attempts = await prisma.questionAttempt.findMany({
        where: { questionId, selectedAnswer: { not: null } },
        select: { selectedAnswer: true },
      });

      if (attempts.length < MIN_ATTEMPTS) {
        return Response.json({
          data: { distribution: null, totalAttempts: attempts.length },
        });
      }

      const counts = new Map<string, number>();
      for (const a of attempts) {
        const letter = normalizeToLetter(a.selectedAnswer);
        if (letter) {
          counts.set(letter, (counts.get(letter) || 0) + 1);
        }
      }

      const distribution = Array.from(counts.entries())
        .map(([letter, count]) => ({
          optionLetter: letter,
          count,
          percent: Math.round((count / attempts.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      return Response.json({
        data: { distribution, totalAttempts: attempts.length },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * Normalize selectedAnswer to a single letter (A-E).
 * Handles numeric indices (0-4), plain letters, and "Option X" patterns.
 */
function normalizeToLetter(answer: unknown): string | null {
  if (answer === null || answer === undefined) return null;

  // Numeric index (from old data format)
  if (typeof answer === 'number') {
    if (answer >= 0 && answer <= 4) {
      return String.fromCharCode(65 + answer);
    }
    return null;
  }

  if (typeof answer !== 'string') return null;
  const trimmed = answer.trim().toUpperCase();
  if (/^[A-E]$/.test(trimmed)) return trimmed;

  const idx = parseInt(trimmed, 10);
  if (!isNaN(idx) && idx >= 0 && idx <= 4) {
    return String.fromCharCode(65 + idx);
  }

  const match = trimmed.match(/^(?:OPTION|CHOICE)\s+([A-E])$/);
  if (match) return match[1] ?? null;
  return null;
}
