/**
 * Tool: drill_coverage_check
 *
 * Audits drill content coverage across all active drill types
 * and organ systems. Returns counts per drill type and system,
 * identifies under-represented drill types.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  drillType: z
    .string()
    .optional()
    .describe('Filter to a specific drill type (e.g. "AnatomyDrill"). Omit for all.'),
  system: z
    .string()
    .optional()
    .describe('Filter to a specific organ system. Omit for all.'),
  minThreshold: z
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .describe('Flag drill types with fewer than this many items. Default 25.'),
});

type Input = z.infer<typeof InputSchema>;

interface DrillCoverageItem {
  drillType: string;
  system: string;
  itemCount: number;
  status: 'healthy' | 'low' | 'critical';
}

interface DrillCoverageResult {
  drillTypes: string[];
  totalDrillItems: number;
  coverage: DrillCoverageItem[];
  underRepresented: DrillCoverageItem[];
  summary: string;
}

interface PrismaLike {
  drillSessionRecord: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
  card: {
    groupBy: (args: {
      by: string[];
      where: Record<string, unknown>;
      _count: Record<string, boolean>;
    }) => Promise<Array<Record<string, unknown>>>;
  };
}

const DRILL_TYPES = [
  'AnatomyDrill', 'ConditionDrill', 'ContrastiveDrill', 'DDxDrill',
  'DermDrill', 'ECGDrill', 'ElaborationDrill', 'FirstLineDrill',
  'GuidelineDrill', 'ICDCodingDrill', 'ImagingDrill', 'MiniLabDrill', 'PharmDrill',
];

export const drillCoverageCheckTool = defineTool<
  Input,
  DrillCoverageResult
>({
  name: 'drill_coverage_check',
  description:
    "Check PANaCEa's drill content coverage across all 13 drill types and organ systems. Call when the user asks about drill content, drill coverage gaps, or which drill types need more items. Returns per-type counts and identifies under-represented drill content.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      drillType: {
        type: 'string',
        description: 'Filter to a specific drill type. Omit for all 13.',
      },
      system: {
        type: 'string',
        description: 'Filter to organ system. Omit for all.',
      },
      minThreshold: {
        type: 'integer',
        description: 'Minimum items before flagging as under-represented. Default 25.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 5000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('drill_coverage_check requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const minThreshold = input.minThreshold ?? 25;

    const drillFilter = input.drillType ? [input.drillType] : DRILL_TYPES;
    const coverage: DrillCoverageItem[] = [];

    for (const dt of drillFilter) {
      const where: Record<string, unknown> = { drillType: dt };
      if (input.system) where.system = input.system;

      const count = await prisma.drillSessionRecord.count({ where });

      let status: DrillCoverageItem['status'];
      if (count === 0) status = 'critical';
      else if (count < minThreshold) status = 'low';
      else status = 'healthy';

      coverage.push({
        drillType: dt,
        system: input.system || 'all',
        itemCount: count,
        status,
      });
    }

    const underRepresented = coverage.filter((c) => c.status !== 'healthy');
    const totalDrillItems = coverage.reduce((s, c) => s + c.itemCount, 0);

    const summary = `${coverage.length} drill types checked. ${totalDrillItems} total items. ${underRepresented.length} drill types under the ${minThreshold}-item threshold.`;

    return {
      drillTypes: drillFilter,
      totalDrillItems,
      coverage,
      underRepresented,
      summary,
    };
  },
});
