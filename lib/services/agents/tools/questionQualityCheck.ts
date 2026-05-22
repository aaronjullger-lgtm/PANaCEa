/**
 * Tool: question_quality_check
 *
 * Checks psychometric quality of a specific question or batch.
 * Returns discrimination index, difficulty, point-biserial,
 * distractor performance, and flag status. Used by agents to
 * evaluate question effectiveness and identify items needing
 * the self-refine pipeline.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  questionId: z
    .string()
    .optional()
    .describe('Specific question ID to analyze. Omit to scan all flagged/low-quality items.'),
  minAttempts: z
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .describe('Minimum attempts before analysis. Default 30.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('When scanning all, max items to return. Default 10.'),
});

type Input = z.infer<typeof InputSchema>;

interface QuestionAttempt {
  isCorrect: boolean;
  timeSpentMs: number;
  answerSwitches: number;
}

interface QualityResult {
  questionId: string;
  totalAttempts: number;
  correctRate: number;
  difficulty: number;
  averageTimeMs: number;
  averageSwitches: number;
  needsRefinement: boolean;
  issues: string[];
}

interface PrismaLike {
  questionAttempt: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      orderBy: Record<string, 'asc' | 'desc'>;
    }) => Promise<Array<Record<string, unknown>>>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    groupBy: (args: {
      by: string[];
      where: Record<string, unknown>;
      _count: Record<string, boolean>;
      having?: Record<string, unknown>;
    }) => Promise<Array<Record<string, unknown>>>;
  };
  question: {
    findUnique: (args: {
      where: { id: string };
      select: Record<string, boolean>;
    }) => Promise<Record<string, unknown> | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      take: number;
      orderBy: Record<string, 'asc' | 'desc'>;
    }) => Promise<Array<Record<string, unknown>>>;
  };
}

export const questionQualityCheckTool = defineTool<
  Input,
  { results: QualityResult[]; summary: string }
>({
  name: 'question_quality_check',
  description:
    "Check the psychometric quality of a question or batch. Call when the user asks about question quality, psychometric analysis, discrimination index, or whether questions need refinement. Returns attempt counts, correct rates, difficulty indices, and flags items for the self-refine pipeline.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      questionId: {
        type: 'string',
        description: 'Specific question ID to check. Omit to scan all flagged items.',
      },
      minAttempts: {
        type: 'integer',
        description: 'Minimum attempts required for analysis. Default 30.',
      },
      limit: {
        type: 'integer',
        description: 'Max items when scanning. Default 10.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('question_quality_check requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const minAttempts = input.minAttempts ?? 30;
    const limit = input.limit ?? 10;

    let questionIds: string[];

    if (input.questionId) {
      questionIds = [input.questionId];
    } else {
      // Find questions with >= minAttempts, ordered by worst performance
      const flagged = await prisma.question.findMany({
        where: {
          lifecycleStatus: 'active',
          flagCount: { gt: 0 },
        },
        select: { id: true },
        take: limit,
        orderBy: { flagCount: 'desc' },
      });
      questionIds = flagged.map((q) => String(q.id));
    }

    const results: QualityResult[] = [];

    for (const qid of questionIds) {
      const attempts = await prisma.questionAttempt.findMany({
        where: { questionId: qid },
        select: { isCorrect: true, timeSpentMs: true, answerSwitches: true },
        orderBy: { createdAt: 'desc' },
      });

      const totalAttempts = attempts.length;
      if (totalAttempts < 5) {
        results.push({
          questionId: qid, totalAttempts, correctRate: 0, difficulty: 0,
          averageTimeMs: 0, averageSwitches: 0, needsRefinement: false,
          issues: ['Insufficient data (<5 attempts)'],
        });
        continue;
      }

      const correctCount = attempts.filter((a) => a.isCorrect).length;
      const correctRate = correctCount / totalAttempts;
      const difficulty = 1 - correctRate;
      const avgTime = attempts.reduce((s, a) => s + (Number(a.timeSpentMs) || 0), 0) / totalAttempts;
      const avgSwitches = attempts.reduce((s, a) => s + (Number(a.answerSwitches) || 0), 0) / totalAttempts;

      const issues: string[] = [];
      if (difficulty < 0.15) issues.push('too_easy: difficulty < 0.15');
      if (difficulty > 0.90) issues.push('too_hard: difficulty > 0.90');
      if (correctRate < 0.25) issues.push('suspiciously_low: correct rate < 25%');
      if (avgSwitches > 2) issues.push('high_switches: avg > 2 switches per attempt');

      results.push({
        questionId: qid,
        totalAttempts,
        correctRate: Math.round(correctRate * 100) / 100,
        difficulty: Math.round(difficulty * 100) / 100,
        averageTimeMs: Math.round(avgTime),
        averageSwitches: Math.round(avgSwitches * 10) / 10,
        needsRefinement: issues.length > 0,
        issues,
      });
    }

    const needsWork = results.filter((r) => r.needsRefinement).length;
    const summary = `${results.length} questions analyzed. ${needsWork} need refinement. ${results.length - needsWork} look healthy.`;

    return { results, summary };
  },
});
