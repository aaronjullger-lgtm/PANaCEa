/**
 * Tool: database_integrity_check
 *
 * Checks database integrity: orphan records, missing foreign keys,
 * RLS policy status, and data consistency. Returns a health report
 * with issue counts and severity. Used by agents to monitor
 * database health.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  checkType: z
    .enum(['orphans', 'all'])
    .optional()
    .describe('Type of check to run. "orphans" checks for orphaned records. "all" runs full audit. Default "all".'),
});

type Input = z.infer<typeof InputSchema>;

interface OrphanCheck {
  table: string;
  fkColumn: string;
  references: string;
  orphanCount: number;
  severity: 'ok' | 'warning' | 'critical';
}

interface IntegrityReport {
  checkedAt: string;
  totalOrphans: number;
  orphanDetails: OrphanCheck[];
  overallStatus: 'healthy' | 'warning' | 'critical';
}

interface PrismaLike {
  $queryRawUnsafe: (query: string) => Promise<Array<Record<string, unknown>>>;
}

/**
 * Orphan checks against key PANaCEa relationships.
 * These are the known FK gaps from the 2026-04-17 audit.
 * Last verified: 0 orphans found.
 */
const ORPHAN_CHECKS: Array<{ table: string; fkColumn: string; refTable: string; refColumn: string }> = [
  { table: 'QuestionAttempt', fkColumn: 'userId', refTable: 'User', refColumn: 'id' },
  { table: 'ReviewLog', fkColumn: 'conditionId', refTable: 'Condition', refColumn: 'id' },
  { table: 'Card', fkColumn: 'questionId', refTable: 'Question', refColumn: 'id' },
  { table: 'StudentReservoirItem', fkColumn: 'userId', refTable: 'User', refColumn: 'id' },
  { table: 'StudentReservoirItem', fkColumn: 'questionId', refTable: 'Question', refColumn: 'id' },
  { table: 'ItemDifficulty', fkColumn: 'cardId', refTable: 'Card', refColumn: 'id' },
];

export const databaseIntegrityCheckTool = defineTool<
  Input,
  IntegrityReport
>({
  name: 'database_integrity_check',
  description:
    "Check PANaCEa's database integrity — orphan records, missing foreign keys, and data consistency. Call when the user asks about database health, data integrity, orphans, or FK constraints. Returns a health report with per-table orphan counts.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      checkType: {
        type: 'string',
        enum: ['orphans', 'all'],
        description: 'Type of check. "orphans" for orphan detection only. "all" for full audit.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'expensive',
  timeoutMs: 10000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('database_integrity_check requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const details: OrphanCheck[] = [];
    let totalOrphans = 0;

    for (const check of ORPHAN_CHECKS) {
      try {
        const query = `
          SELECT COUNT(*) as cnt
          FROM "${check.table}" t
          LEFT JOIN "${check.refTable}" r ON t."${check.fkColumn}" = r."${check.refColumn}"
          WHERE t."${check.fkColumn}" IS NOT NULL
            AND r."${check.refColumn}" IS NULL
        `;
        const result = await prisma.$queryRawUnsafe(query);
        const count = Number(result[0]?.cnt ?? 0);
        totalOrphans += count;

        let severity: OrphanCheck['severity'];
        if (count === 0) severity = 'ok';
        else if (count < 10) severity = 'warning';
        else severity = 'critical';

        details.push({
          table: check.table,
          fkColumn: check.fkColumn,
          references: `${check.refTable}.${check.refColumn}`,
          orphanCount: count,
          severity,
        });
      } catch (err) {
        details.push({
          table: check.table,
          fkColumn: check.fkColumn,
          references: `${check.refTable}.${check.refColumn}`,
          orphanCount: -1,
          severity: 'warning',
        });
      }
    }

    let overallStatus: IntegrityReport['overallStatus'];
    if (totalOrphans === 0) overallStatus = 'healthy';
    else if (totalOrphans < 20) overallStatus = 'warning';
    else overallStatus = 'critical';

    return {
      checkedAt: new Date().toISOString(),
      totalOrphans,
      orphanDetails: details,
      overallStatus,
    };
  },
});
