/**
 * Tool: condition_verify
 *
 * Cross-references a condition in PANaCEa's database against quality
 * standards. Checks for AI refusal language, stale content, missing
 * required fields, and overall completeness. Used by agents performing
 * medical verification on specific conditions.
 *
 * Read-only. Category: read.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  conditionId: z
    .string()
    .optional()
    .describe('Condition ID to verify. Omit to scan for stale/low-quality conditions.'),
  conditionName: z
    .string()
    .optional()
    .describe('Search by condition name (ILIKE match).'),
  maxAgeDays: z
    .number()
    .int()
    .min(30)
    .max(730)
    .optional()
    .describe('Flag conditions not updated within this many days. Default 365.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('Max results when scanning. Default 10.'),
});

type Input = z.infer<typeof InputSchema>;

interface ConditionVerification {
  id: string;
  name: string;
  system: string;
  lastUpdated: string;
  ageDays: number | null;
  issues: string[];
  score: number;
}

interface PrismaLike {
  condition: {
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

export const conditionVerifyTool = defineTool<
  Input,
  { results: ConditionVerification[]; summary: string }
>({
  name: 'condition_verify',
  description:
    "Verify the clinical accuracy and completeness of a medical condition in PANaCEa's database. Call when the user asks to verify, check, or audit medical content accuracy. Checks for stale content, missing required fields, and AI-generated refusal language. Returns a list of issues and a quality score.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      conditionId: {
        type: 'string',
        description: 'Specific condition ID to verify.',
      },
      conditionName: {
        type: 'string',
        description: 'Condition name to search for (partial match).',
      },
      maxAgeDays: {
        type: 'integer',
        description: 'Flag if not updated within this many days. Default 365.',
      },
      limit: {
        type: 'integer',
        description: 'Max results when scanning. Default 10.',
      },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 6000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('condition_verify requires a Prisma client');
    }
    const prisma = ctx.prisma as PrismaLike;
    const limit = input.limit ?? 10;
    const maxAgeDays = input.maxAgeDays ?? 365;
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

    let conditions: Array<Record<string, unknown>>;

    if (input.conditionId) {
      const c = await prisma.condition.findUnique({
        where: { id: input.conditionId },
        select: { id: true, name: true, displayName: true, system: true,
          updatedAt: true, overview: true, symptoms: true, riskFactors: true,
          diagnosis: true, treatment: true, clinicalPearls: true, complications: true,
          status: true },
      });
      conditions = c ? [c] : [];
    } else if (input.conditionName) {
      conditions = await prisma.condition.findMany({
        where: { name: { contains: input.conditionName, mode: 'insensitive' } },
        select: { id: true, name: true, system: true,
          updatedAt: true, overview: true, symptoms: true, riskFactors: true,
          diagnosis: true, treatment: true, clinicalPearls: true, complications: true,
          status: true },
        take: limit,
        orderBy: { updatedAt: 'asc' },
      });
    } else {
      conditions = await prisma.condition.findMany({
        where: {
          OR: [
            { updatedAt: { lt: cutoff } },
            { overview: null },
          ],
        },
        select: { id: true, name: true, system: true,
          updatedAt: true, overview: true, symptoms: true, riskFactors: true,
          diagnosis: true, treatment: true, clinicalPearls: true, complications: true,
          status: true },
        take: limit,
        orderBy: { updatedAt: 'asc' },
      });
    }

    // AI refusal patterns to detect
    const refusalPatterns = [
      /i am an ai/i, /as a language model/i, /i cannot provide medical advice/i,
      /i'm not a doctor/i, /consult a medical professional/i, /disclaimer:/i,
      /this is not medical advice/i,
    ];

    const results: ConditionVerification[] = [];

    for (const c of conditions) {
      const issues: string[] = [];
      let ageDays: number | null = null;
      const updatedAt = c.updatedAt ? new Date(String(c.updatedAt)) : null;
      if (updatedAt) {
        ageDays = Math.round((now.getTime() - updatedAt.getTime()) / (24 * 60 * 60 * 1000));
        if (ageDays > maxAgeDays) {
          issues.push(`stale: not updated in ${ageDays} days`);
        }
      }

      // Check required fields
      const overview = String(c.overview || '');
      if (!overview || overview.length < 100) issues.push('missing_overview: <100 chars');
      const symptoms = Array.isArray(c.symptoms) ? c.symptoms.length : 0;
      if (symptoms < 3) issues.push(`missing_symptoms: only ${symptoms} (need 3+)`);
      const pearls = Array.isArray(c.clinicalPearls) ? c.clinicalPearls.length : 0;
      if (pearls < 2) issues.push(`missing_pearls: only ${pearls} (need 2+)`);
      const diagnosis = String(c.diagnosis || '');
      if (!diagnosis || diagnosis.length < 50) issues.push('missing_diagnosis: <50 chars');

      // Check for AI refusal language
      const allText = [overview, diagnosis, String(c.treatment || '')].join(' ');
      if (refusalPatterns.some((p) => p.test(allText))) {
        issues.push('ai_refusal_detected');
      }

      // Score: start at 100, subtract per issue
      let score = 100;
      score -= issues.filter((i) => i.startsWith('stale')).length * 15;
      score -= issues.filter((i) => i.startsWith('missing_')).length * 25;
      score -= issues.filter((i) => i.startsWith('ai_refusal')).length * 50;
      score = Math.max(0, score);

      results.push({
        id: String(c.id),
        name: (c.name as string) || 'Unknown',
        system: (c.system as string) || 'Unknown',
        lastUpdated: updatedAt?.toISOString() || 'unknown',
        ageDays,
        issues,
        score,
      });
    }

    const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
    const summary = `${results.length} conditions checked. ${totalIssues} issues found across ${results.filter(r => r.issues.length > 0).length} conditions.`;

    return { results, summary };
  },
});
