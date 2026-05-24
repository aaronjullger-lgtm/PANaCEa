/**
 * Tool: content_health_audit
 *
 * Audits content health across the question bank. Returns count
 * of questions below health thresholds, flagged items, and
 * content requiring medical review. Supports filtering by
 * system and health score threshold.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  system: z
    .string()
    .optional()
    .describe('Filter to a specific organ system (e.g. "Pulmonary").'),
  healthThreshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Count questions below this health score. Default 0.5.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max results to return. Default 20.'),
});

type Input = z.infer<typeof InputSchema>;

interface HealthAuditResult {
  totalQuestions: number;
  belowThreshold: number;
  belowThresholdPercent: number;
  flaggedCount: number;
  needsReviewCount: number;
  averageHealthScore: number;
  worstOffenders: Array<{
    id: string;
    healthScore: number;
    system: string;
    questionPreview: string;
  }>;
  bySystem: Record<string, { count: number; avgScore: number }>;
}

interface PrismaLike {
  question: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      take: number;
      orderBy: Record<string, 'asc' | 'desc'>;
    }) => Promise<Array<Record<string, unknown>>>;
    aggregate: (args: {
      where: Record<string, unknown>;
      _avg: Record<string, boolean>;
    }) => Promise<{ _avg: { contentHealthScore: number | null } | null }>;
    groupBy: (args: {
      by: string[];
      where: Record<string, unknown>;
      _count: Record<string, boolean>;
      _avg: Record<string, boolean>;
    }) => Promise<Array<Record<string, unknown>>>;
  };
}

export const contentHealthAuditTool = defineTool<
  Input,
  HealthAuditResult
>({
  name: 'content_health_audit',
  description:
    "Audit the health of PANaCEa's question bank. Call when the user asks about content quality, unhealthy questions, flag status, or questions needing review. Returns counts of questions below threshold, flagged items, average health scores, and the worst offenders by health score.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      system: {
        type: 'string',
        description: 'Filter to a specific organ system. Omit for all.',
      },
      healthThreshold: {
        type: 'number',
        description: 'Health score threshold (0-1). Count questions below this. Default 0.5.',
      },
      limit: {
        type: 'integer',
        description: 'Max results. Default 20.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 6000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('content_health_audit requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const threshold = input.healthThreshold ?? 0.5;
    const limit = input.limit ?? 20;

    const baseWhere: Record<string, unknown> = { lifecycleStatus: 'ACTIVE' };
    if (input.system) baseWhere.system = input.system;

    const totalQuestions = await prisma.question.count({ where: baseWhere });

    const belowWhere = {
      ...baseWhere,
      contentHealthScore: { lt: threshold },
    };
    const belowThreshold = await prisma.question.count({ where: belowWhere });

    const flaggedCount = await prisma.question.count({
      where: { ...baseWhere, flagCount: { gt: 0 } },
    });

    const needsReviewCount = await prisma.question.count({
      where: { ...baseWhere, lifecycleStatus: 'needs_review' },
    });

    const avgAgg = await prisma.question.aggregate({
      where: baseWhere,
      _avg: { contentHealthScore: true },
    });
    const averageHealthScore = Math.round(
      ((avgAgg?._avg?.contentHealthScore ?? 0) * 100)
    ) / 100;

    const worstOffenders = await prisma.question.findMany({
      where: { ...baseWhere, contentHealthScore: { not: null } },
      select: {
        id: true,
        contentHealthScore: true,
        system: true,
        question: true,
      },
      take: limit,
      orderBy: { contentHealthScore: 'asc' },
    });

    // Group by system
    let bySystem: Record<string, { count: number; avgScore: number }> = {};
    try {
      const groups = await prisma.question.groupBy({
        by: ['system'],
        where: baseWhere,
        _count: { id: true },
        _avg: { contentHealthScore: true },
      });
      for (const g of groups) {
        const sys = (g.system as string) || 'Unknown';
        bySystem[sys] = {
          count: (g._count as { id: number }).id,
          avgScore: Math.round(((g._avg?.contentHealthScore ?? 0) * 100)) / 100,
        };
      }
    } catch {
      bySystem = {};
    }

    return {
      totalQuestions,
      belowThreshold,
      belowThresholdPercent: totalQuestions > 0
        ? Math.round((belowThreshold / totalQuestions) * 1000) / 10
        : 0,
      flaggedCount,
      needsReviewCount,
      averageHealthScore,
      worstOffenders: worstOffenders.map((q) => ({
        id: String(q.id),
        healthScore: Number(q.contentHealthScore) || 0,
        system: String(q.system || 'Unknown'),
        questionPreview: String(q.question || '').slice(0, 100),
      })),
      bySystem,
    };
  },
});
