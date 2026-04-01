/**
 * Anatomy Reference Index API
 * GET /api/reference/anatomy
 *
 * Lists and searches anatomy structures, optionally filtered by system
 *
 * Sprint: Security Hardening Sprint 3
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const AnatomyQuerySchema = z.object({
  query: z
    .object({
      system: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// CORS HANDLER
// ============================================================================

export const onRequestOptions = withCors();

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  AnatomyQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/anatomy', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const system = url.searchParams.get('system');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      const where: any = {};
      if (system) where.system = system;
      if (highYield === 'true') where.isHighYield = true;

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ];
      }

      log.info('Listing anatomy structures', { system, highYield: highYield || 'false' });
      const results = await prisma.anatomyStructure.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, system: true, region: true,
          type: true, description: true, function: true,
          innervation: true, bloodSupply: true,
          clinicalSignificance: true, isHighYield: true, panceYield: true,
          origin: true, insertion: true,
          nerveRoots: true, dermatome: true, myotome: true,
          commonPathology: true, surfaceLandmarks: true,
          clinicalPearls: true, testQuestionTips: true,
          commonMistakes: true, mnemonics: true, boardYieldFacts: true,
          Condition: { select: { id: true, name: true } },
        },
      });

      log.info('Anatomy fetch successful', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching anatomy', error);
      return {
        status: 500,
        error: 'Failed to fetch anatomy structures',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
