/**
 * Tool: fsrs_calibration_status
 *
 * Checks FSRS scheduling health: calibration drift, overdue cascades,
 * difficulty compression, and review backlog. Used by agents to
 * monitor the spaced repetition engine.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe('Check a specific user. Omit to check global/system-wide status.'),
  minReviews: z
    .number()
    .int()
    .min(10)
    .max(1000)
    .optional()
    .describe('Minimum review count for a user to be included. Default 50.'),
});

type Input = z.infer<typeof InputSchema>;

interface CalibrationStatus {
  scope: 'user' | 'global';
  scopeId?: string;
  totalActiveCards: number;
  overdueCount: number;        // cards past nextReviewAt
  overduePercent: number;
  easeHellCount: number;       // difficulty > 0.85 + consecutive lapses >= 3
  easeHellPercent: number;
  averageDifficulty: number;
  averageStability: number;
  reviewBacklog7d: number;     // due within 7 days
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

interface PrismaLike {
  userProgress: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    aggregate: (args: {
      where: Record<string, unknown>;
      _avg: Record<string, boolean>;
    }) => Promise<{ _avg: Record<string, number | null> | null }>;
  };
}

export const fsrsCalibrationStatusTool = defineTool<
  Input,
  CalibrationStatus
>({
  name: 'fsrs_calibration_status',
  description:
    "Check the health of PANaCEa's FSRS spaced repetition engine. Call when the user asks about scheduling health, calibration drift, overdue cards, ease hell, or review backlog. Returns overdue percentages, difficulty distributions, and status flags.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'Check a specific user. Omit for system-wide status.',
      },
      minReviews: {
        type: 'integer',
        description: 'Minimum review count for user-level checks. Default 50.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 6000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('fsrs_calibration_status requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;

    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const baseWhere: Record<string, unknown> = {};
    if (input.userId) {
      baseWhere.userId = input.userId;
    }

    const totalActiveCards = await prisma.userProgress.count({
      where: { ...baseWhere, stability: { gt: 0 } },
    });

    const overdueCount = await prisma.userProgress.count({
      where: {
        ...baseWhere,
        stability: { gt: 0 },
        nextReviewAt: { lt: now },
      },
    });

    const easeHellCount = await prisma.userProgress.count({
      where: {
        ...baseWhere,
        difficulty: { gt: 0.85 },
        consecutiveLapses: { gte: 3 },
      },
    });

    const reviewBacklog7d = await prisma.userProgress.count({
      where: {
        ...baseWhere,
        stability: { gt: 0 },
        nextReviewAt: { lte: sevenDays },
      },
    });

    const agg = await prisma.userProgress.aggregate({
      where: { ...baseWhere, stability: { gt: 0 } },
      _avg: { difficulty: true, stability: true },
    });

    const avgDifficulty = Math.round(((agg?._avg?.difficulty ?? 0) * 100)) / 100;
    const avgStability = Math.round(((agg?._avg?.stability ?? 0) * 100)) / 100;

    const overduePercent = totalActiveCards > 0
      ? Math.round((overdueCount / totalActiveCards) * 1000) / 10
      : 0;
    const easeHellPercent = totalActiveCards > 0
      ? Math.round((easeHellCount / totalActiveCards) * 1000) / 10
      : 0;

    const issues: string[] = [];
    if (overduePercent > 20) issues.push(`overdue_cascade: ${overduePercent}% past due`);
    else if (overduePercent > 10) issues.push(`overdue_elevated: ${overduePercent}% past due`);
    if (easeHellPercent > 8) issues.push(`ease_hell: ${easeHellPercent}% in ease hell`);
    if (avgDifficulty < 0.1 && totalActiveCards > 100) issues.push('difficulty_compression: avg < 0.1');
    if (avgStability < 1 && totalActiveCards > 100) issues.push('low_stability: avg < 1 day');

    let status: CalibrationStatus['status'];
    if (overduePercent > 20 || easeHellPercent > 8) status = 'critical';
    else if (issues.length > 0) status = 'warning';
    else status = 'healthy';

    return {
      scope: input.userId ? 'user' : 'global',
      scopeId: input.userId,
      totalActiveCards,
      overdueCount,
      overduePercent,
      easeHellCount,
      easeHellPercent,
      averageDifficulty: avgDifficulty,
      averageStability: avgStability,
      reviewBacklog7d,
      status,
      issues,
    };
  },
});
