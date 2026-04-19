/**
 * GET /api/labs/cases — List all lab cases
 * Edge port of routes/labs.ts
 */

import { z } from 'zod';
import { withCors, authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const EmptySchema = z.object({}).optional();

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const log = createEndpointLogger('labs/cases');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const cases = await prisma.labCase.findMany();

      return new Response(JSON.stringify(cases), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      log.error('Failed to fetch lab cases', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch lab cases' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
