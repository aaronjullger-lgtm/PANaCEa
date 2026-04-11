/**
 * Tool: clinical_library_search
 *
 * Searches PANaCEa's Condition knowledge base for conditions matching a
 * query string. Returns up to `limit` results ordered by relevance
 * (simple ILIKE match on name + aliases).
 *
 * This is a read-only reference search — it does NOT perform semantic
 * retrieval. For semantic search wire a follow-up tool against the
 * existing embedding pipeline in `lib/services/contentService`.
 */

import { z } from 'zod';
import { defineTool } from '../toolRegistry';
import type { ToolExecutionContext } from '../types';

const InputSchema = z.object({
  query: z
    .string()
    .min(2, 'query must be at least 2 characters')
    .max(120, 'query must be under 120 characters'),
  limit: z.number().int().min(1).max(10).optional(),
  system: z
    .string()
    .optional()
    .describe('Optional organ system filter (e.g., "CARDIOVASCULAR")'),
});

type Input = z.infer<typeof InputSchema>;

interface ConditionHit {
  id: string;
  name: string;
  displayName: string | null;
  system: string;
  subcategory: string | null;
  icd10Code: string | null;
}

/**
 * Minimal structural type for the Prisma Condition delegate methods we
 * touch. Typed here rather than importing `PrismaClient` so this file
 * stays Edge-safe and test mocks can plug straight in.
 */
interface PrismaLike {
  condition: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
      take: number;
      orderBy: { name: 'asc' | 'desc' };
    }) => Promise<ConditionHit[]>;
  };
}

export const clinicalLibrarySearchTool = defineTool<Input, { results: ConditionHit[] }>({
  name: 'clinical_library_search',
  description:
    "Search PANaCEa's clinical condition library by name or alias. Call this when the student asks about a specific medical condition, disease, or syndrome and you need the canonical PANaCEa entry. Returns up to 5 matching conditions with their system, subcategory, and ICD-10 code. Always prefer this over answering from memory when the student names a condition.",
  inputSchema: InputSchema,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Name or keyword fragment to search for (min 2 chars).',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results to return (1–10). Default 5.',
      },
      system: {
        type: 'string',
        description:
          'Optional organ-system filter, e.g. "CARDIOVASCULAR", "PULMONARY", "GASTROINTESTINAL".',
      },
    },
    required: ['query'],
  },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 4000,
  execute: async (input: Input, ctx: ToolExecutionContext) => {
    if (!ctx.prisma) {
      throw new Error('clinical_library_search requires a Prisma client in context');
    }
    const prisma = ctx.prisma as PrismaLike;

    const limit = input.limit ?? 5;
    const where: Record<string, unknown> = {
      OR: [
        { name: { contains: input.query, mode: 'insensitive' } },
        { displayName: { contains: input.query, mode: 'insensitive' } },
        { aliases: { has: input.query } },
      ],
      status: 'published',
    };
    if (input.system) {
      where.system = input.system;
    }

    const results = await prisma.condition.findMany({
      where,
      select: {
        id: true,
        name: true,
        displayName: true,
        system: true,
        subcategory: true,
        icd10Code: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    return { results };
  },
});
