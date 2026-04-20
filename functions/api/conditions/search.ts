/**
 * GET /api/conditions/search?q={query}&system={system}&subcategory={subcategory}
 *
 * PUBLIC endpoint - Searches conditions by name, aliases, synonyms with fuzzy matching
 * Returns ranked results based on relevance score
 * Condition metadata is public curriculum content
 */

import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const SearchSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    system: z.string().optional(),
    subcategory: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(30),
  }),
});

/**
 * Calculate relevance score for a search result
 * Higher score = better match
 */
function calculateRelevanceScore(query: string, conditionName: string, aliases: string[]): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedName = conditionName.toLowerCase();

  // Exact match = highest score
  if (normalizedName === normalizedQuery) {
    return 3.0;
  }

  // Starts with query = high score
  if (normalizedName.startsWith(normalizedQuery)) {
    return 2.5;
  }

  // Contains query = good score
  if (normalizedName.includes(normalizedQuery)) {
    const lengthRatio = normalizedQuery.length / normalizedName.length;
    return 2.0 + lengthRatio;
  }

  // Check aliases
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase();
    if (normalizedAlias === normalizedQuery) return 2.8;
    if (normalizedAlias.startsWith(normalizedQuery)) return 2.3;
    if (normalizedAlias.includes(normalizedQuery)) {
      const lengthRatio = normalizedQuery.length / normalizedAlias.length;
      return 1.8 + lengthRatio;
    }
  }

  // Fuzzy match based on word overlap
  const queryWords = normalizedQuery.split(/\s+/);
  const nameWords = normalizedName.split(/\s+/);
  const matchedWords = queryWords.filter((qw) =>
    nameWords.some((nw) => nw.includes(qw) || qw.includes(nw))
  );

  if (matchedWords.length > 0) {
    return matchedWords.length / queryWords.length;
  }

  return 0;
}

export const onRequestGet = publicEndpoint(SearchSchema, async ({ env, validated }) => {
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { q: query, system, subcategory, limit } = validated.query;

    // Build where clause for filtering
    const where: any = {
      status: 'published',
    };

    if (system) {
      where.system = system;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    // Search conditions with case-insensitive matching
    const conditions = await prisma.condition.findMany({
      where: {
        ...where,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { subcategory: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        status: true,
      },
      take: limit,
    });

    type ConditionResult = {
      id: string;
      name: string;
      system: string;
      subcategory: string | null;
      status: string | null;
    };
    // Get full content for matched conditions to extract aliases/synonyms
    const conditionIds = conditions.map((c: ConditionResult) => c.id);
    const medicalContent = await prisma.medicalContent.findMany({
      where: {
        conditionId: { in: conditionIds },
      },
      select: {
        conditionId: true,
        synonyms: true,
      },
    });

    // Create a map of conditionId -> synonyms for quick lookup (synonyms is JsonValue in schema)
    const synonymsMap = new Map(
      medicalContent.map((mc) => [
        mc.conditionId,
        Array.isArray(mc.synonyms) ? (mc.synonyms as string[]) : [],
      ])
    );

    // Score and rank results
    const results = conditions
      .map((condition: ConditionResult) => {
        const aliases = (synonymsMap.get(condition.id) || []) as string[];
        const score = calculateRelevanceScore(query, condition.name, aliases);

        return {
          id: condition.id,
          condition: condition.name,
          system: condition.system,
          subcategory: condition.subcategory,
          aliases,
          score,
        };
      })
      .filter(
        (result: {
          id: string;
          condition: string;
          system: string;
          subcategory: string | null;
          aliases: string[];
          score: number;
        }) => result.score > 0.1
      ) // Filter out very low matches
      .sort((a: { score: number; condition: string }, b: { score: number; condition: string }) => {
        // Sort by score desc, then alphabetically
        if (Math.abs(b.score - a.score) < 0.01) {
          return a.condition.localeCompare(b.condition);
        }
        return b.score - a.score;
      })
      .slice(0, limit);

    // Semantic fallback via MedicalContent full-text search (tsvector) when the
    // Condition-table keyword pass yields few results. Catches synonym gaps like
    // "heart attack" → "Myocardial Infarction" because search_vector indexes
    // the synonyms JSON array alongside condition name and clinical text.
    // Pure SQL — no Gemini call needed, so safe on a public endpoint.
    const FALLBACK_THRESHOLD = 3;
    if (results.length < FALLBACK_THRESHOLD) {
      try {
        type FTSRow = { id: string; condition: string; conditionId: string; system: string; subcategory: string | null; synonyms: unknown };
        const ftsRows = await prisma.$queryRawUnsafe<FTSRow[]>(
          `SELECT id, condition, "conditionId", system, subcategory, synonyms
           FROM "MedicalContent"
           WHERE status = 'published'
             AND search_vector @@ websearch_to_tsquery('english', $1)
             ${system ? `AND system = $2` : ''}
           ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC
           LIMIT $${system ? 3 : 2}`,
          ...(system ? [query, system, limit] : [query, limit])
        );

        const existingIds = new Set(results.map((r) => r.id));
        for (const row of ftsRows) {
          if (existingIds.has(row.id)) continue;
          const aliases = Array.isArray(row.synonyms) ? (row.synonyms as string[]) : [];
          results.push({
            id: row.id,
            condition: row.condition,
            system: row.system,
            subcategory: row.subcategory,
            aliases,
            score: 0.9, // FTS hit without string score — treated as high-relevance
          });
          existingIds.add(row.id);
        }
      } catch {
        // FTS fallback is best-effort — never block the primary response
      }
    }

    return { data: results.slice(0, limit) };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
