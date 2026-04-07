/**
 * GET /api/questions/answer-distribution?questionId=xxx
 *
 * Returns peer selection stats: % of students who chose each option (A–D).
 * Used for "Wisdom of the Crowds" — e.g. "42% of students also chose B" when user got it wrong.
 * @see docs/AUDIT_WISDOM_OF_THE_CROWDS.md
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuerySchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
});

export const onRequestOptions = withCors();

/**
 * GET: Answer distribution for a question (count and percent per option A–D)
 */
export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/questions/answer-distribution');
    const { questionId } = validated;

    if (!env.DATABASE_URL) {
      throw new Error('Database not configured');
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const attempts = await prisma.questionAttempt.findMany({
        where: {
          questionId,
          selectedAnswer: { not: null },
        },
        select: { selectedAnswer: true },
      });

      const letters = ['A', 'B', 'C', 'D', 'E'] as const;
      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      for (const a of attempts) {
        const letter = a.selectedAnswer?.toUpperCase();
        if (letter && counts[letter] !== undefined) counts[letter]++;
      }
      const total = attempts.length;

      const distribution = letters.map((optionLetter) => ({
        optionLetter,
        count: counts[optionLetter] ?? 0,
        percent: total > 0 ? Math.round(((counts[optionLetter] ?? 0) / total) * 100) : 0,
      }));

      return {
        data: {
          questionId,
          totalAttempts: total,
          distribution,
        },
      };
    } catch (error: unknown) {
      logger.error('Answer distribution error', {
        error: error instanceof Error ? error.message : String(error),
        questionId,
      });
      throw new Error('Failed to get answer distribution');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
