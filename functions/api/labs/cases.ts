/**
 * GET /api/labs/cases — List all lab cases
 * Edge port of routes/labs.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const EmptySchema = z.object({}).optional();

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const log = createEndpointLogger('labs/cases');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const cases = await prisma.labCase.findMany();
      return ok(cases);
    } catch (error) {
      log.error('Failed to fetch lab cases', error);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to fetch lab cases' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
