/**
 * GET /api/analytics/rating-audit
 *
 * Returns an implicit rating distribution audit for the authenticated user.
 * Analyses Again/Good balance, per-system breakdown, session type comparison,
 * weekly trends, and anomaly detection.
 *
 * Query params:
 *   - windowDays (optional, default 90): lookback window in days
 *
 * Security: Authenticated endpoint — requires valid Clerk JWT.
 *
 * Sprint: Implicit Rating Audit — April 2026
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, type AuthenticatedContext, type ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getRatingDistributionAudit } from '../../../lib/services/ratingDistributionAuditService';

const QuerySchema = z.object({
  windowDays: z.coerce.number().int().min(7).max(365).optional().default(90),
});

type QueryParams = z.infer<typeof QuerySchema>;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<QueryParams>) => {
    const { userId } = context.auth;
    const { windowDays } = context.validated;
    const prisma = createEdgePrismaClient(context.env);

    try {
      const audit = await getRatingDistributionAudit(prisma, userId, windowDays);
      return { data: audit };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
