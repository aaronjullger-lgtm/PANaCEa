/**
 * Scoring System Detail API
 *
 * GET /api/reference/scoring-systems/:id - Fetch a single scoring system by ID
 *
 * Returns full scoring system with components, interpretation, clinical pearls,
 * board yield facts, test tips, mnemonics, and linked conditions.
 *
 * Security: Authenticated endpoint with secure middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ScoringSystemByIdSchema = z.object({
  query: z.object({}).optional(),
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid(),
  }),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  ScoringSystemByIdSchema,
  async ({ env, auth, request, params }) => {
    const log = createEndpointLogger('/api/reference/scoring-systems/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const id = (params as { id: string }).id;
      log.info('Fetching scoring system', { id });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const result = await prisma.scoringSystem.findUnique({
        where: { id },
        include: {
          ScoringSystemConditionLink: {
            select: {
              conditionId: true,
              Condition: {
                select: {
                  id: true,
                  canonicalName: true,
                  system: true,
                  subcategory: true,
                },
              },
            },
          },
        },
      });

      if (!result) {
        log.warn('Scoring system not found', { id });
        return { status: 404, error: 'Scoring system not found' };
      }

      log.info('Successfully fetched scoring system', { id, name: result.name });
      return { data: { success: true, data: result } };
    } catch (error: any) {
      log.error('Error fetching scoring system', error);
      return { status: 500, error: 'Failed to fetch scoring system' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
