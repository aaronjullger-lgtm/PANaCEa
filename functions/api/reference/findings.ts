/**
 * Physical Exam Findings Reference API
 *
 * GET /api/reference/findings - Fetch physical exam findings
 *
 * Security: Sprint 3 - Authenticated endpoint with secure middleware
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
// VALIDATION SCHEMAS
// ============================================================================

const FindingsQuerySchema = z.object({
  query: z
    .object({
      system: z.string().optional(),
      category: z.string().optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  FindingsQuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/findings', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const system = url.searchParams.get('system');
      const category = url.searchParams.get('category');
      const searchQuery = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield') === 'true';

      log.info('Fetching physical exam findings', { system: system || 'all', highYield });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const where: any = {};
      if (system) where.system = system;
      if (category) where.category = category;
      if (highYield) where.isHighYield = true;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { eponymousName: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.physicalExamFinding.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, system: true, category: true,
          findingType: true, description: true,
          clinicalSignificance: true, isHighYield: true, panceYield: true,
          eponymousName: true, howToElicit: true, howToDocument: true,
          sensitivity: true, specificity: true,
          positiveLR: true, negativeLR: true,
          positiveIndicates: true, negativeIndicates: true,
          differentialFor: true, equipmentNeeded: true,
          clinicalPearls: true, testQuestionTips: true,
          commonMistakes: true, mnemonics: true, boardYieldFacts: true,
        },
      });

      log.info('Successfully fetched findings', { count: results.length });

      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching findings', error);
      return {
        status: 500,
        error: 'Failed to fetch findings',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
