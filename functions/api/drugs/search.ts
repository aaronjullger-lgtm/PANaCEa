/**
 * Drug Search API
 * GET /api/drugs/search?q=metformin
 *
 * Public endpoint for drug reference lookups.
 * Searches: genericName, brandName, drugClass (array), mechanismOfAction, indications (array).
 * Returns a lean result set suitable for suggestion cards — no full pharmacokinetic data.
 * Results ordered by isHighYield DESC, panceYield DESC so PANCE-relevant drugs surface first.
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DrugSearchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const onRequestGet = publicEndpoint(
  DrugSearchSchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/drugs/search');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      const query = validated.q
        ? Array.from(validated.q, (char) => {
            const code = char.charCodeAt(0);
            return code <= 31 || code === 127 ? ' ' : char;
          })
            .join('')
            .replace(/\s+/g, ' ')
            .trim()
        : undefined;
      if (!query) {
        return { data: [] };
      }

      const limit = Math.min(validated.limit ?? 20, 50);
      const like = `%${query}%`;

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Collect ids whose array fields (drugClass, indications) contain the query.
      // Prisma doesn't support ilike-contains on array elements via the ORM, so
      // raw SQL is used — the same pattern as drugs/library.ts for indications.
      const [classMatches, indicationMatches, aliasMatches, interactionMatches] = await Promise.all([
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Drug"
          WHERE EXISTS (
            SELECT 1 FROM unnest("drugClass") AS dc
            WHERE dc ILIKE ${like}
          )
        `,
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Drug"
          WHERE EXISTS (
            SELECT 1 FROM unnest(indications) AS ind
            WHERE ind ILIKE ${like}
          )
        `,
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Drug"
          WHERE EXISTS (
            SELECT 1 FROM unnest(aliases) AS alias
            WHERE alias ILIKE ${like}
          )
        `,
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Drug"
          WHERE EXISTS (
            SELECT 1 FROM unnest(interactions) AS interaction
            WHERE interaction ILIKE ${like}
          )
        `,
      ]);

      const classIds = classMatches.map((r) => r.id);
      const indicationIds = indicationMatches.map((r) => r.id);
      const aliasIds = aliasMatches.map((r) => r.id);
      const interactionIds = interactionMatches.map((r) => r.id);
      const extraIds = [...new Set([...classIds, ...indicationIds, ...aliasIds, ...interactionIds])];

      const drugs = await prisma.drug.findMany({
        where: {
          OR: [
            { genericName: { contains: query, mode: 'insensitive' } },
            { brandName: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { mechanismOfAction: { contains: query, mode: 'insensitive' } },
            { mechanismDetailed: { contains: query, mode: 'insensitive' } },
            ...(extraIds.length > 0 ? [{ id: { in: extraIds } }] : []),
          ],
        },
        select: {
          id: true,
          genericName: true,
          brandName: true,
          displayName: true,
          drugClass: true,
          isHighYield: true,
          isFirstLine: true,
          panceYield: true,
          mechanismOfAction: true,
          indications: true,
          contraindications: true,
          sideEffects: true,
          interactions: true,
          monitoringParams: true,
          blackBoxWarnings: true,
          pregnancyCategory: true,
          pregnancyNotes: true,
          lactationSafety: true,
          lactationNotes: true,
          clinicalPearls: true,
        },
        orderBy: [{ isHighYield: 'desc' }, { panceYield: 'desc' }, { genericName: 'asc' }],
        take: limit,
      });

      logger.info('Drug search completed', {
        query: query.substring(0, 50),
        resultCount: drugs.length,
      });

      return { data: drugs };
    } catch (error) {
      logger.error('Drug search error', {
        error: error instanceof Error ? error.message : String(error),
        query: validated.q?.substring(0, 50),
      });
      throw new Error('Failed to search drugs');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
