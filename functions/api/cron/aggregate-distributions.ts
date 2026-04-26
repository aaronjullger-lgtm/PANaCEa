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
import { validateRequest } from '../_shared/schemas';
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

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const groupedAttempts = await prisma.questionAttempt.groupBy({
      by: ['questionId', 'selectedAnswer'],
      where: {
        selectedAnswer: { not: null },
        ...(validation.data.questionIds?.length
          ? { questionId: { in: validation.data.questionIds } }
          : {}),
      },
      _count: {
        _all: true,
      },
      orderBy: {
        questionId: 'asc',
      },
    });

    const questionDistributions = new Map<
      string,
      { distribution: DistributionMap; totalAttempts: number }
    >();

        const entry = questionDistributions.get(qId)!;
        const letter = normalizeToLetter(row.selectedAnswer);
        if (letter) {
          entry.distribution[letter] = (entry.distribution[letter] || 0) + count;
          entry.totalAttempts += count;
        }
      }

      const entry = questionDistributions.get(qId)!;
      const letter = normalizeToLetter(row.selectedAnswer);
      if (!letter) {
        continue;
      }

      return {
        data: {
          totalQuestionsProcessed: questionDistributions.size,
          upsertedCount,
          skippedBelowThreshold: skippedCount,
          minAttemptsThreshold: MIN_ATTEMPTS,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
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
