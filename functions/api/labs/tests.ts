/**
 * GET /api/labs/tests — List all lab tests
 * Edge port of routes/labs.ts
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

export const onRequestGet = authenticatedEndpoint(
  undefined,
  async (context) => {
    const log = createEndpointLogger('labs/tests');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const tests = await prisma.labTest.findMany({
        orderBy: { name: 'asc' },
      });
      return ok(tests);
    } catch (error) {
      log.error('Failed to fetch lab tests', error);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to fetch lab tests' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
