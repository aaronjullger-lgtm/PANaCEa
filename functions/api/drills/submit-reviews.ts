import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { getEorRotationEnd } from '../../../lib/fsrs/eorScheduler';
import { scheduleConceptReview } from '../ai/learning/profile-crud';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { DrillSubmitReviewSchema, buildBatchIdemKey, IDEM_TTL_SECONDS } from './submit-review';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
import { setInCache, isKVAvailable } from '../_shared/cache';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import {
  beginSubmissionIdempotency,
  completeSubmissionIdempotency,
  failSubmissionIdempotency,
} from '../_shared/submission-idempotency';
import { z } from 'zod';

const BatchDrillSubmitReviewSchema = z.array(DrillSubmitReviewSchema);

export const onRequestOptions = async (context: any) => {
  return authenticatedEndpoint(BatchDrillSubmitReviewSchema, async () => ({
    data: { message: 'Method not allowed' },
    status: 405,
  }))(context);
};

export const onRequestPost = authenticatedEndpoint(BatchDrillSubmitReviewSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/submit-reviews');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    logger.addContext({ userId: auth.userId, batchSize: validated.length });

    if (!env.DATABASE_URL) {
      logger.error('Database not configured');
      return { status: 500, error: 'Database not configured' };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const user = await resolveOrCreateUserRecord(prisma, auth.userId, {
      id: true,
      yearInProgram: true,
      currentRotation: true,
      eorTestDate: true,
      rotationEndDate: true,
    });

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });

    const results = [];
    const kvAvailable = isKVAvailable(env.CACHE);
    for (const review of validated) {
      const {
        questionId,
        selectedAnswer,
        timeSpentMs,
        timeToFirstClick,
        answerSwitches,
        totalDwellTime,
        timezone,
        wakeTimeHHMM,
        telemetry,
        sessionType,
        idempotencyKey,
      } = review;

      let idempotencyRecordId: string | null = null;
      try {
        const idempotency = await beginSubmissionIdempotency(prisma, {
          userId: user.id,
          endpoint: '/api/drills/submit-reviews',
          idempotencyKey,
        });
        if (idempotency?.state === 'completed') {
          logger.info('persistent batch idempotency hit — skipping pipeline', {
            questionId,
            idempotencyKey,
          });
          results.push({
            questionId,
            success: true,
            data: idempotency.response,
            source: 'idempotent-store',
          });
          continue;
        }
        if (idempotency?.state === 'in_progress') {
          logger.warn('duplicate batch item is still processing', {
            questionId,
            idempotencyKey,
          });
          results.push({
            questionId,
            success: false,
            error: 'Submission is still processing. Retry shortly.',
            source: 'idempotent-in-progress',
            retryAfterSeconds: idempotency.retryAfterSeconds,
          });
          continue;
        }
        idempotencyRecordId = idempotency?.id ?? null;

        const normalizedSelectedAnswer =
          typeof selectedAnswer === 'string' ? selectedAnswer : String(selectedAnswer);
        const { question, source } = await resolveReviewQuestion(prisma, {
          userId: user.id,
          questionId,
          selectedAnswer: normalizedSelectedAnswer,
        });

        if (!question) {
          await failSubmissionIdempotency(prisma, idempotencyRecordId, 'NOT_FOUND');
          results.push({ questionId, error: 'Question not found', success: false, source: 'missing' });
          continue;
        }

        const result = await submitDrillReview(
          prisma,
          user.id,
          {
            questionId,
            selectedAnswer,
            timeSpentMs,
            timeToFirstClick,
            answerSwitches,
            totalDwellTime,
            timezone,
            wakeTimeHHMM,
            telemetry,
            sessionType,
            idempotencyKey,
          },
          question,
          { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
          eorRotationEnd
        );

        // SRS: Schedule concept review (Leitner-style: fail +1 day, pass +3 days)
        if (typeof result.isCorrect === 'boolean') {
          try {
            const conceptKey = `${question.system || 'General'}|${question.conditionId || questionId}`;
            await scheduleConceptReview(prisma, user.id, conceptKey, result.isCorrect);
          } catch (error_) {
            logger.warn('SRS scheduleConceptReview failed (non-fatal)', {
              questionId,
              error: error_ instanceof Error ? error_.message : String(error_),
            });
          }
          // When incorrect: ensure a due variant exists (sibling or generate+store) so Due session never waits
          if (result.isCorrect === false) {
            ensureDueVariant(
              prisma,
              {
                id: question.id,
                conditionId: question.conditionId,
                system: question.system ?? null,
                difficulty: question.difficulty ?? 'medium',
                questionType: question.questionType ?? 'mcq',
                questionData: question.questionData,
              },
              env.GEMINI_API_KEY as string | undefined,
              { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
              user.id // pass userId so confusion pairs are injected into the variant prompt
            ).catch((e) => logger.warn("Background confusion processing failed", e));
          }
        }

        // Sprint S3 — Cache the successful per-item response so retries with
        // the same idempotency key short-circuit. Fire-and-forget; a KV write
        // failure must not fail the user request.
        await completeSubmissionIdempotency(prisma, idempotencyRecordId, result);

        if (idempotencyKey && kvAvailable) {
          try {
            await setInCache(
              env.CACHE,
              buildBatchIdemKey(auth.userId, idempotencyKey),
              result,
              IDEM_TTL_SECONDS,
            );
          } catch (cacheError) {
            logger.warn('batch idempotency cache write failed (non-fatal)', {
              questionId,
              error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            });
          }
        }

        results.push({ questionId, success: true, data: result, source });
      } catch (error) {
        if (idempotencyRecordId) {
          try {
            await failSubmissionIdempotency(prisma, idempotencyRecordId, 'INTERNAL_ERROR');
          } catch (idempotencyError) {
            logger.warn('failed to mark batch idempotency row failed', {
              questionId,
              error: idempotencyError instanceof Error ? idempotencyError.message : String(idempotencyError),
            });
          }
        }
        logger.error(`Failed to process review for question ${questionId}`, error);
        results.push({
          questionId,
          success: false,
          error: 'Failed to submit review',
        });
      }
    }

    return { data: results };
  } catch (error: unknown) {
    logger.error('submit-reviews batch error:', error);
    return {
      status: 500,
      error: 'Failed to submit reviews',
      details: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
}, { requestsPerMinute: 60 });
