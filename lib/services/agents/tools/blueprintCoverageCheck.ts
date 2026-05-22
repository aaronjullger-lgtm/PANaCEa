/**
 * Tool: blueprint_coverage_check
 *
 * Checks NCCPA 2025 blueprint coverage for a given organ system
 * (or all systems). Returns actual vs target question counts,
 * coverage ratio, and deficit. Used by agents to answer "how well
 * covered is system X?" or "where are the biggest content gaps?".
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const NCCPA_2025_BLUEPRINT: Record<string, number> = {
  Cardiovascular: 0.11, Pulmonary: 0.09, Gastrointestinal: 0.09,
  Musculoskeletal: 0.09, HEENT: 0.08, Reproductive: 0.08,
  Neurological: 0.07, Psychiatry: 0.07, Endocrine: 0.06,
  Dermatology: 0.05, Genitourinary: 0.05, Hematology: 0.04,
  'Infectious Disease': 0.04, Nephrology: 0.04, 'Emergency Medicine': 0.02,
  General: 0.02,
};

const InputSchema = z.object({
  system: z
    .string()
    .optional()
    .describe('Organ system to check, e.g. "Cardiovascular". Omit for all systems.'),
  minHealthScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Only count questions with health score >= this value. Default 0.'),
});

type Input = z.infer<typeof InputSchema>;

interface SystemCoverage {
  system: string;
  blueprintWeight: number;
  targetQuestions: number;
  actualQuestions: number;
  coverageRatio: number;
  deficit: number;
  status: 'critical' | 'under' | 'on_target' | 'over';
}

interface PrismaLike {
  question: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

export const blueprintCoverageCheckTool = defineTool<
  Input,
  { systems: SystemCoverage[]; totalPoolSize: number; timestamp: string }
>({
  name: 'blueprint_coverage_check',
  description:
    "Check PANaCEa's question bank coverage against NCCPA 2025 blueprint weights. Call when the user asks about content coverage, blueprint gaps, or which systems need more questions. Returns each system's target vs actual question count with coverage ratio and deficit.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      system: {
        type: 'string',
        description: 'Organ system to check (e.g. "Cardiovascular"). Omit to check all.',
      },
      minHealthScore: {
        type: 'number',
        description: 'Minimum content health score to count a question. Default 0 (all).',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 5000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('blueprint_coverage_check requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const minScore = input.minHealthScore ?? 0;
    const systems = input.system
      ? [input.system]
      : Object.keys(NCCPA_2025_BLUEPRINT);

    // Get total pool size for target calculation
    const totalPoolSize = await prisma.question.count({
      where: { lifecycleStatus: 'active' },
    });

    const results: SystemCoverage[] = [];
    for (const sys of systems) {
      const weight = NCCPA_2025_BLUEPRINT[sys];
      if (weight === undefined) continue;

      const where: Record<string, unknown> = {
        system: sys,
        lifecycleStatus: 'active',
      };
      if (minScore > 0) {
        where.contentHealthScore = { gte: minScore };
      }

      const actual = await prisma.question.count({ where });
      const target = Math.round(totalPoolSize * weight);
      const ratio = target > 0 ? actual / target : 1;
      const deficit = target - actual;

      let status: SystemCoverage['status'];
      if (ratio < 0.5) status = 'critical';
      else if (ratio < 0.8) status = 'under';
      else if (ratio <= 1.2) status = 'on_target';
      else status = 'over';

      results.push({ system: sys, blueprintWeight: weight, targetQuestions: target,
        actualQuestions: actual, coverageRatio: Math.round(ratio * 100) / 100,
        deficit, status });
    }

    results.sort((a, b) => a.coverageRatio - b.coverageRatio);

    return { systems: results, totalPoolSize, timestamp: new Date().toISOString() };
  },
});
