/**
 * Answer Distribution Aggregation
 * POST /api/cron/aggregate-distributions
 *
 * Computes per-question answer distributions from QuestionAttempt records.
 * Designed to be called periodically (daily cron) or manually.
 * Stores results in the QuestionAnswerDistribution table for fast lookup.
 *
 * Privacy: Only surfaces data for questions with ≥10 attempts.
 *
 * @see functions/api/analytics/answer-distribution.ts — consumer endpoint
 * @see components/session/AnswerFeedback.tsx — UI rendering
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const bodySchema = z.object({
  /** Optional: only aggregate for specific question IDs */
  questionIds: z.array(z.string()).optional(),
}).optional().default({});

const MIN_ATTEMPTS = 10;

interface DistributionMap {
  [optionLetter: string]: number;
}

export const onRequestPost = authenticatedEndpoint(
  bodySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Get all question attempts grouped by questionId and selectedAnswer
      // This uses raw query for efficient aggregation
      const whereClause = context.data?.questionIds?.length
        ? `WHERE qa."questionId" IN (${context.data.questionIds.map((id: string) => `'${id}'`).join(',')})`
        : '';

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
        ${context.data?.questionIds?.length ?
          // Filter by specific question IDs if provided
          // (Prisma raw queries need careful SQL construction)
          Prisma.sql`AND "questionId" = ANY(${context.data.questionIds})` :
          Prisma.sql``
        }
        GROUP BY "questionId", "selectedAnswer"
        ORDER BY "questionId"
      `;

      // Aggregate into per-question distributions
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

        const entry = questionDistributions.get(qId)!;
        // Normalize selectedAnswer to option letter (A, B, C, D, E)
        const letter = normalizeToLetter(row.selectedAnswer);
        if (letter) {
          entry.distribution[letter] = (entry.distribution[letter] || 0) + count;
          entry.totalAttempts += count;
        }
      }

      // Upsert distributions for questions with enough attempts
      let upsertedCount = 0;
      let skippedCount = 0;

      for (const [questionId, data] of questionDistributions) {
        if (data.totalAttempts < MIN_ATTEMPTS) {
          skippedCount++;
          continue;
        }

        await prisma.questionAnswerDistribution.upsert({
          where: { questionId },
          create: {
            questionId,
            distribution: data.distribution,
            totalAttempts: data.totalAttempts,
            lastUpdated: new Date(),
          },
          update: {
            distribution: data.distribution,
            totalAttempts: data.totalAttempts,
            lastUpdated: new Date(),
          },
        });
        upsertedCount++;
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

  // Already a letter
  if (/^[A-E]$/.test(trimmed)) return trimmed;

  // Numeric index (0-4) → letter
  const idx = parseInt(trimmed, 10);
  if (!isNaN(idx) && idx >= 0 && idx <= 4) {
    return String.fromCharCode(65 + idx); // 0→A, 1→B, etc.
  }

  // "Option A" / "Choice B" patterns
  const match = trimmed.match(/^(?:OPTION|CHOICE)\s+([A-E])$/);
  if (match) return match[1];

  return null;
}
