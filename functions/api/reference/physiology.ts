/**
 * Physiology Concepts Reference API
 *
 * GET /api/reference/physiology - Fetch physiology concepts
 * Query params: category (optional)
 *
 * Security: authenticatedEndpoint with Zod validation
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const GetPhysiologySchema = z.object({
  query: z
    .object({
      category: z.string().optional(),
      system: z.string().optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  GetPhysiologySchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/physiology', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      log.info('Fetching physiology concepts', { category: validated?.query?.category });

      if (!env.DATABASE_URL) {
        log.error('Database not configured');
        return { status: 500, error: 'Database not configured' };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const category = validated?.query?.category;
      const system = validated?.query?.system;
      const searchQuery = validated?.query?.query;
      const highYield = validated?.query?.highYield === 'true';

      const where: any = {};
      if (category) where.category = category;
      if (system) where.system = system;
      if (highYield) where.isHighYield = true;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { mechanism: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.physiologyConcept.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, displayName: true,
          system: true, category: true, description: true,
          mechanism: true, clinicalSignificance: true,
          pathophysiology: true, normalValues: true,
          feedbackLoops: true, isHighYield: true, panceYield: true,
          relatedConditions: true, relatedDrugs: true,
          compensatoryMechanisms: true, decompensationSigns: true,
          clinicalPearls: true, testQuestionTips: true,
          commonMistakes: true, mnemonics: true, boardYieldFacts: true,
        },
      });

      log.info('Physiology concepts fetched successfully', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching physiology concepts', error);
      return {
        status: 500,
        error: 'Failed to fetch physiology concepts',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
