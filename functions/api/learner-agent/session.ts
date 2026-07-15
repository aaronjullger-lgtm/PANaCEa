/**
 * POST /api/learner-agent/session
 *
 * Start or complete a learner-agent study session (Pages fallback without DO).
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import { startStudySession, completeStudySession } from '../../../lib/services/learner';
import { correlationFromRequest } from '../../../lib/services/learnerAgent/observability';

const SessionSchema = z.object({
  body: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('start'),
      objective: z.string().min(1).max(300),
    }),
    z.object({
      action: z.literal('complete'),
      sessionId: z.string().min(1).max(128),
      questionsAnswered: z.number().int().min(0).max(500),
      accuracy: z.number().min(0).max(1),
      durationMinutes: z.number().int().min(0).max(24 * 60),
    }),
  ]),
});

export const onRequestPost = authenticatedEndpoint(
  SessionSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const correlationId = correlationFromRequest(context.request);

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const body = context.validated.body;

      if (body.action === 'start') {
        const result = await startStudySession(prisma, user.id, body.objective);
        return {
          status: 200,
          data: { correlationId, ...result },
          headers: { 'x-correlation-id': correlationId },
        };
      }

      const result = await completeStudySession(prisma, user.id, {
        sessionId: body.sessionId,
        questionsAnswered: body.questionsAnswered,
        accuracy: body.accuracy,
        durationMinutes: body.durationMinutes,
      });

      return {
        status: 200,
        data: { correlationId, ...result },
        headers: { 'x-correlation-id': correlationId },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
