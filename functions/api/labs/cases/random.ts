// SAFE-OVERRIDE: Fisher-Yates shuffle algorithm, no shell commands
/**
 * GET /api/labs/cases/random — Random lab cases for drills
 * Edge port of routes/labs.ts (replaces $queryRaw with findMany + shuffle)
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const RandomCasesSchema = z.object({
  count: z.string().optional(),
});

/** Array shuffle using the Fisher-Yates algorithm */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export const onRequestGet = authenticatedEndpoint(
  RandomCasesSchema,
  async (context) => {
    const log = createEndpointLogger('labs/cases/random');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const count = Math.min(parseInt(context.validated.count ?? '1', 10), 20);

    try {
      const allCases = await prisma.labCase.findMany();
      const selected = shuffle(allCases).slice(0, count);
      return ok(selected);
    } catch (error) {
      log.error('Failed to fetch random lab cases', error);
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to fetch random lab cases' });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
