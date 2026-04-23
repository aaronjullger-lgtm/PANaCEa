/**
 * Guidelines API Endpoint
 * GET /api/guidelines - List all guidelines with optional filtering
 *
 * Query params:
 * - type: Filter by type (screening, prevention, treatment)
 * - organization: Filter by organization (USPSTF, AHA, IDSA, etc.)
 * - conditionId: Filter by associated condition
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const GuidelinesListSchema = z.object({
  query: z.object({
    type: z.string().optional(),
    organization: z.string().optional(),
    conditionId: z.string().optional(),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  GuidelinesListSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/guidelines', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const { type, organization, conditionId } = validated.query;

      // Build where clause
      const where: any = {};
      if (type) where.type = type;
      if (organization) where.organization = organization;
      if (conditionId) where.conditionId = conditionId;

      // Query guidelines
      const guidelines = await prisma.guideline.findMany({
        where,
        orderBy: [{ panceYield: 'desc' }, { name: 'asc' }],
        include: {
          Condition: {
            select: {
              id: true,
              name: true,
              system: true,
            },
          },
        },
      });

      log.info('Fetched guidelines', {
        count: guidelines.length,
        filters: { type, organization, conditionId },
      });

      return new Response(
        JSON.stringify({
          success: true,
          count: guidelines.length,
          data: guidelines,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      log.error('Error fetching guidelines', { error: error.message });
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
