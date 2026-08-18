/**
 * GET /api/learner-agent/recommendation
 *
 * Deterministic next-best-action for the authenticated learner.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import { getNextBestAction } from '../../../lib/services/learner';
import { correlationFromRequest } from '../../../lib/services/learnerAgent/observability';

const QuerySchema = z.object({
  availableMinutes: z.coerce.number().int().min(5).max(240).optional(),
  objective: z.string().max(200).optional(),
});

export const onRequestGet = authenticatedEndpoint(
  QuerySchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const correlationId = correlationFromRequest(context.request);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const action = await getNextBestAction(prisma, {
        userId: user.id,
        availableMinutes: context.validated.availableMinutes,
        statedObjective: context.validated.objective,
      });

      return {
        status: 200,
        data: { correlationId, recommendation: action },
        headers: { 'x-correlation-id': correlationId },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 60 }
);
