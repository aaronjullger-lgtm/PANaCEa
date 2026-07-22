/**
 * POST /api/learner-agent/connect
 *
 * Authenticates via Clerk, returns WebSocket connection metadata.
 * Fails closed when KV is unavailable (token cannot be validated by worker).
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import { createCorrelationId, correlationFromRequest } from '../../../lib/services/learnerAgent/observability';

const ConnectSchema = z.object({
  body: z.object({}).optional(),
});

const CONNECT_PREFIX = 'learner-connect:';

async function hashUserIdForDo(userId: string): Promise<string> {
  const data = new TextEncoder().encode(`learner-agent:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = authenticatedEndpoint(
  ConnectSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const kv = context.env.RATE_LIMIT_KV as {
      put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void>;
    } | undefined;

    if (!kv) {
      return { status: 503, error: 'Connection broker unavailable' };
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const correlationId = correlationFromRequest(context.request);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const doId = await hashUserIdForDo(user.id);
      const workerUrl = context.env.LEARNER_AGENT_WORKER_URL as string | undefined;
      if (!workerUrl) {
        return { status: 503, error: 'Learner agent worker not configured' };
      }

      const connectionToken = createCorrelationId();
      await kv.put(`${CONNECT_PREFIX}${connectionToken}`, user.id, {
        expirationTtl: 300,
      });

      return {
        status: 200,
        data: {
          correlationId,
          durableObjectId: doId,
          websocketUrl: `${workerUrl.replace(/\/$/, '')}/agents/learner/${doId}`,
          connectionToken,
          expiresInSeconds: 300,
        },
        headers: {
          'x-correlation-id': correlationId,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);

export { CONNECT_PREFIX };
