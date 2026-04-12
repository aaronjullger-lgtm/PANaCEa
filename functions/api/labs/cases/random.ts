/**
 * GET /api/labs/cases/random — Random lab cases for drills
 * Edge port of routes/labs.ts (replaces $queryRaw with findMany + shuffle)
 */

import { z } from 'zod';
import { withCors, authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const RandomCasesSchema = z.object({
  count: z.string().optional(),
});

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  RandomCasesSchema,
  async (context) => {
    const log = createEndpointLogger('labs/cases/random');
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const count = Math.min(parseInt(context.validated.count ?? '1', 10), 20);

    try {
      const allCases = await prisma.labCase.findMany();
      const selected = shuffle(allCases).slice(0, count);

      return new Response(JSON.stringify(selected), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      log.error('Failed to fetch random lab cases', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch random lab cases' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);
