/**
 * GET /api/labs/tests — List all lab tests
 * Edge port of routes/labs.ts
 */

import { withCors, authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  undefined,
  async (context) => {
    const log = createEndpointLogger('labs/tests');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const tests = await prisma.labTest.findMany({
        orderBy: { name: 'asc' },
      });

      return new Response(JSON.stringify(tests), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      log.error('Failed to fetch lab tests', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch lab tests' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
