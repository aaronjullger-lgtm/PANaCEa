/**
 * Tool: user_progress_summary
 *
 * Returns a compact FSRS progress summary for the authenticated student.
 * The agent can call this to personalize its answer ("you've struggled
 * with this system before", "your accuracy here is 78%, focus on…").
 *
 * Read-only. Uses the UserProgress aggregate rows already maintained by
 * the drillReviewService pipeline.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  system: z
    .string()
    .optional()
    .describe('Optional organ system filter, e.g. "CARDIOVASCULAR".'),
});

type Input = z.infer<typeof InputSchema>;

interface ProgressRow {
  system: string | null;
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
  lastReviewAt: Date | null;
}

interface PrismaLike {
  userProgress: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      orderBy: { lastReviewAt: 'asc' | 'desc' };
      take: number;
    }) => Promise<ProgressRow[]>;
  };
}

export const userProgressSummaryTool = defineTool<
  Input,
  {
    systems: Array<{
      system: string;
      attempts: number;
      correct: number;
      accuracy: number;
      lastReviewAt: string | null;
    }>;
    totalAttempts: number;
    overallAccuracy: number;
  }
>({
  name: 'user_progress_summary',
  description:
    "Return the student's aggregate FSRS progress by organ system (attempts, accuracy, last review). Call this when the student asks 'how am I doing', 'where am I weak', 'what should I review', or whenever personalizing advice would materially improve the answer. Do NOT call for purely factual clinical questions.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      system: {
        type: 'string',
        description: 'Optional organ system filter (e.g., "CARDIOVASCULAR").',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 4000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('user_progress_summary requires a Prisma client in context');
    }
    const prisma = ctx.prisma as PrismaLike;

    const where: Record<string, unknown> = { userId: ctx.userId };
    if (input.system) {
      where.system = input.system;
    }

    const rows = await prisma.userProgress.findMany({
      where,
      select: {
        system: true,
        totalAttempts: true,
        correctCount: true,
        accuracy: true,
        lastReviewAt: true,
      },
      orderBy: { lastReviewAt: 'desc' },
      take: 500,
    });

    // Aggregate per system.
    const bySystem = new Map<
      string,
      { attempts: number; correct: number; lastReviewAt: Date | null }
    >();

    let totalAttempts = 0;
    let totalCorrect = 0;

    for (const r of rows) {
      const sys = r.system ?? 'UNCATEGORIZED';
      const entry =
        bySystem.get(sys) ?? { attempts: 0, correct: 0, lastReviewAt: null };
      entry.attempts += r.totalAttempts;
      entry.correct += r.correctCount;
      if (r.lastReviewAt && (!entry.lastReviewAt || r.lastReviewAt > entry.lastReviewAt)) {
        entry.lastReviewAt = r.lastReviewAt;
      }
      bySystem.set(sys, entry);
      totalAttempts += r.totalAttempts;
      totalCorrect += r.correctCount;
    }

    const systems = [...bySystem.entries()]
      .map(([system, v]) => ({
        system,
        attempts: v.attempts,
        correct: v.correct,
        accuracy: v.attempts > 0 ? v.correct / v.attempts : 0,
        lastReviewAt: v.lastReviewAt ? v.lastReviewAt.toISOString() : null,
      }))
      .sort((a, b) => b.attempts - a.attempts);

    return {
      systems,
      totalAttempts,
      overallAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
    };
  },
});
