import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { getEorRotationEnd } from '../../../lib/fsrs/eorScheduler';
import { scheduleConceptReview } from '../ai/learning/profile-crud';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { DrillSubmitReviewSchema } from './submit-review';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
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

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: {
        id: true,
        yearInProgram: true,
        currentRotation: true,
        eorTestDate: true,
        rotationEndDate: true,
      },
    });

    if (!user) {
      return {
        status: 404,
        error: 'User not found',
        message: 'Your user account has not been synced yet.',
      };
    }

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });

    const results = [];
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
      } = review;

      try {
        const normalizedSelectedAnswer =
          typeof selectedAnswer === 'string' ? selectedAnswer : String(selectedAnswer);
        const { question, source } = await resolveReviewQuestion(prisma, {
          userId: user.id,
          questionId,
          selectedAnswer: normalizedSelectedAnswer,
        });

        if (!question) {
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
                system: question.system,
                difficulty: question.difficulty ?? 'medium',
                questionType: question.questionType ?? 'mcq',
                questionData: question.questionData,
              },
              env.GEMINI_API_KEY as string | undefined,
              { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
              user.id // pass userId so confusion pairs are injected into the variant prompt
            ).catch(() => {});
          }
        }

        results.push({ questionId, success: true, data: result, source });
      } catch (error) {
        logger.error(`Failed to process review for question ${questionId}`, error);
        results.push({
          questionId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
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
});
