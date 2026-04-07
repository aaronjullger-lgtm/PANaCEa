/**
 * API: GET /api/reference/quick-ref?system=X&conditionId=Y
 *
 * Returns lightweight clinical reference data for in-session use.
 * Sprint 4B — April 2026
 *
 * SECURITY: Protected with authenticatedEndpoint (production hardening April 2026).
 * Clinical reference data should only be accessible to authenticated users.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getQuickRef } from '../../../lib/services/clinicalQuickRefService';

const QuickRefQuerySchema = z.object({
  system: z.string().optional(),
  conditionId: z.string().optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  QuickRefQuerySchema,
  async (context) => {
    const { env, validated } = context;
    let prisma;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const { system, conditionId } = validated as z.infer<typeof QuickRefQuerySchema>;

      const data = await getQuickRef(prisma, { system, conditionId });

      return { data };
    } catch (error) {
      return {
        data: { error: 'Quick reference lookup failed' },
        status: 500,
      };
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);