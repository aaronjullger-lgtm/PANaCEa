/**
 * Answer Distribution Aggregation
 * POST /api/cron/aggregate-distributions
 *
 * Computes per-question answer distributions from QuestionAttempt records.
 * Designed to be called periodically (daily cron) or manually by admins.
 * Stores results in the QuestionAnswerDistribution table for fast lookup.
 *
 * Privacy: Only surfaces data for questions with ≥10 attempts.
 *
 * @see functions/api/analytics/answer-distribution.ts — consumer endpoint
 * @see components/session/AnswerFeedback.tsx — UI rendering
 */

import { Prisma } from '@prisma/client';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const bodySchema = z
  .object({
    /** Optional: only aggregate for specific question IDs */
    questionIds: z.array(z.string()).optional(),
  })
  .optional()
  .default({});

const MIN_ATTEMPTS = 10;

interface DistributionMap {
  [optionLetter: string]: number;
}

export const onRequestPost = adminAuthenticatedEndpoint(
  bodySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const questionIds = context.validated?.questionIds;

    try {
      const rawResults = await prisma.$queryRaw<
        Array<{
          questionId: string;
          selectedAnswer: string;
          count: bigint;
        }>
      >`
        SELECT
          "questionId",
          "selectedAnswer",
          COUNT(*)::bigint as count
        FROM "QuestionAttempt"
        WHERE "selectedAnswer" IS NOT NULL
        ${
          questionIds?.length
            ? Prisma.sql`AND "questionId" = ANY(${questionIds})`
            : Prisma.sql``
        }
        GROUP BY "questionId", "selectedAnswer"
        ORDER BY "questionId"
      `;

      const questionDistributions = new Map<
        string,
        { distribution: DistributionMap; totalAttempts: number }
      >();

      for (const row of rawResults) {
        const qId = row.questionId;
        const count = Number(row.count);
        if (!questionDistributions.has(qId)) {
          questionDistributions.set(qId, { distribution: {}, totalAttempts: 0 });
        }
        const entry = questionDistributions.get(qId);
        const letter = normalizeToLetter(row.selectedAnswer);
        if (!entry || !letter) continue;
        entry.distribution[letter] = (entry.distribution[letter] || 0) + count;
        entry.totalAttempts += count;
      }

      let upsertedCount = 0;
      let skippedCount = 0;
      for (const [questionId, entry] of questionDistributions) {
        if (entry.totalAttempts < MIN_ATTEMPTS) {
          skippedCount += 1;
          continue;
        }

        await (prisma as any).questionAnswerDistribution.upsert({
          where: { questionId },
          create: {
            questionId,
            distribution: entry.distribution,
            totalAttempts: entry.totalAttempts,
          },
          update: {
            distribution: entry.distribution,
            totalAttempts: entry.totalAttempts,
          },
        });
        upsertedCount += 1;
      }

      return Response.json({
        success: true,
        data: {
          totalQuestionsProcessed: questionDistributions.size,
          upsertedCount,
          skippedBelowThreshold: skippedCount,
          minAttemptsThreshold: MIN_ATTEMPTS,
        },
      });
    } catch (error) {
      return Response.json(
        {
          error: 'Answer distribution aggregation failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * Normalize a selectedAnswer value to a single letter (A-E).
 * Handles various formats: "A", "0" (index), "Option A", etc.
 */
function normalizeToLetter(answer: string | null): string | null {
  if (!answer) return null;
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
