/**
 * Tool: fsrs_due_count
 *
 * Returns the number of UserProgress rows whose `nextReviewAt` is at or
 * before now + `withinHours`. Used by the agent to answer questions like
 * "how much do I have due today?" or "what does my review queue look
 * like for the next 24 hours?".
 *
 * Read-only.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  withinHours: z
    .number()
    .int()
    .min(1)
    .max(168, 'withinHours must be <= 168 (one week)')
    .optional()
    .describe('Window in hours ahead of now. Defaults to 24.'),
});

type Input = z.infer<typeof InputSchema>;

interface PrismaLike {
  userProgress: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

export const fsrsDueCountTool = defineTool<
  Input,
  { dueCount: number; windowHours: number; asOf: string }
>({
  name: 'fsrs_due_count',
  description:
    "Count the student's questions that are due for FSRS review within the next N hours (default 24). Call this when the student asks 'how much is due', 'what's on my review queue', 'how much should I study', or any variation of that. Returns the count, not the actual items — call a different tool if the student wants the list.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      withinHours: {
        type: 'integer',
        description:
          'Lookahead window in hours (1–168). Defaults to 24 (one day).',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 3000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('fsrs_due_count requires a Prisma client in context');
    }
    const prisma = ctx.prisma as PrismaLike;

    const windowHours = input.withinHours ?? 24;
    const asOf = new Date();
    const cutoff = new Date(asOf.getTime() + windowHours * 60 * 60 * 1000);

    const dueCount = await prisma.userProgress.count({
      where: {
        userId: ctx.userId,
        nextReviewAt: {
          lte: cutoff,
        },
      },
    });

    return {
      dueCount,
      windowHours,
      asOf: asOf.toISOString(),
    };
  },
});
