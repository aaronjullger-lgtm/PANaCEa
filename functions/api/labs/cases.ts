/**
 * GET /api/labs/cases — List all lab cases
 * Edge port of routes/labs.ts
 */

import { withCors, authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  undefined,
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
      await prisma.$disconnect();
    }
  },
);
