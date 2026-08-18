/**
 * POST /api/learner-agent/attempt
 *
 * Verified attempt recording via submitDrillReview. Requires idempotencyKey.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { isFeatureEnabled, featureDisabledResponse } from '../_shared/feature-flags';
import { LEARNER_AGENT_FLAG } from '../../../lib/services/learnerAgent/constants';
import { recordAttempt } from '../../../lib/services/learner/learnerAttemptService';
import { assertSessionOwnedByUser } from '../../../lib/services/learner/learnerSessionService';
import {
  beginSubmissionIdempotency,
  completeSubmissionIdempotency,
  failSubmissionIdempotency,
} from '../_shared/submission-idempotency';
import { correlationFromRequest } from '../../../lib/services/learnerAgent/observability';
import { createEndpointLogger } from '../_shared/secureLogger';

const AttemptSchema = z.object({
  body: z.object({
    questionId: z.string().min(1).max(128),
    selectedAnswer: z.union([z.string(), z.number()]),
    timeSpentMs: z.number().int().min(0).max(3_600_000),
    idempotencyKey: z.string().min(8).max(128),
    studySessionId: z.string().min(1).max(128).optional(),
    canonicalQuestionId: z.string().min(1).max(128).nullable().optional(),
    sourceQuestionId: z.string().min(1).max(128).optional(),
    questionSource: z
      .enum(['question', 'pre_generated', 'staging', 'seed', 'generated'])
      .optional(),
    sessionType: z.enum(['main', 'drill', 'targeted', 'cram', 'rapid_recall']).optional(),
    timeToFirstClick: z.number().int().min(0).optional(),
    answerSwitches: z.number().int().min(0).optional(),
    totalDwellTime: z.number().int().min(0).optional(),
  }),
});

const ENDPOINT = 'learner-agent/attempt';

export const onRequestPost = authenticatedEndpoint(
  AttemptSchema,
  async (context) => {
    if (!isFeatureEnabled(context.env, LEARNER_AGENT_FLAG)) {
      return featureDisabledResponse(context.request, 'Learner Agent is not enabled');
    }

    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const logger = createEndpointLogger('/api/learner-agent/attempt');
    const correlationId = correlationFromRequest(context.request);
    let idempotencyRecordId: string | null = null;

    try {
      const user = await resolveOrCreateUserRecord(prisma, context.auth.userId, { id: true });
      const body = context.validated.body;

      const idempotency = await beginSubmissionIdempotency(prisma, {
        userId: user.id,
        endpoint: ENDPOINT,
        idempotencyKey: body.idempotencyKey,
      });
      if (idempotency?.state === 'completed') {
        return {
          status: 200,
          data: { correlationId, ...idempotency.response, idempotent: true },
          headers: { 'x-correlation-id': correlationId },
        };
      }
      if (idempotency?.state === 'in_progress') {
        return {
          status: 409,
          error: 'Attempt submission in progress',
          headers: { 'Retry-After': String(idempotency.retryAfterSeconds) },
        };
      }
      idempotencyRecordId = idempotency?.id ?? null;

      if (body.studySessionId) {
        try {
          await assertSessionOwnedByUser(prisma, user.id, body.studySessionId);
        } catch {
          await failSubmissionIdempotency(prisma, idempotencyRecordId, 'FORBIDDEN');
          return { status: 403, error: 'Session does not belong to user' };
        }
      }

      const result = await recordAttempt(
        prisma,
        user.id,
        {
          ...body,
          studySessionId: body.studySessionId,
          telemetry: { correlation_id: correlationId },
        },
        logger
      );

      const responseData = {
        correlationId,
        isCorrect: result.isCorrect,
        rating: result.rating,
        stability: result.stability,
        nextReview: result.nextReview,
        questionResolvedFrom: result.questionResolvedFrom,
        fsrsUpdated: result.fsrsUpdated,
      };

      await completeSubmissionIdempotency(prisma, idempotencyRecordId, responseData);

      return {
        status: 200,
        data: responseData,
        headers: { 'x-correlation-id': correlationId },
      };
    } catch (err) {
      if (idempotencyRecordId) {
        await failSubmissionIdempotency(
          prisma,
          idempotencyRecordId,
          err instanceof Error ? err.message : 'ATTEMPT_FAILED'
        );
      }
      if (err instanceof Error && err.message === 'QUESTION_NOT_FOUND') {
        return { status: 404, error: 'Question not found' };
      }
      logger.error('learner-agent attempt failed', { correlationId, error: String(err) });
      return { status: 500, error: 'Failed to record attempt' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 60 }
);
