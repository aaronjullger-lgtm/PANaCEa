/**
 * Single Guideline API Endpoint
 * GET /api/guidelines/[id] - Get a specific guideline by ID
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const GuidelineByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Guideline ID is required'),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  GuidelineByIdSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/guidelines/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { id } = validated.params;

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const guideline = await prisma.guideline.findUnique({
        where: { id },
        include: {
          Condition: {
            select: {
              id: true,
              name: true,
              system: true,
              panceYield: true,
            },
          },
        },
      });

      if (!guideline) {
        log.warn('Guideline not found', { id });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Guideline not found',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      log.info('Fetched guideline', { id, name: guideline.name });

      return new Response(
        JSON.stringify({
          success: true,
          data: guideline,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      log.error('Error fetching guideline', { error: error.message });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch guideline',
          details: error.message,
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
