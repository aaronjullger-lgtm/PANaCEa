/**
 * POST /api/srs/submit
 *
 * Compatibility adapter for the legacy due-review UI.
 *
 * Authoritative FSRS writes live in `drillReviewService` through the same path
 * used by `/api/drills/submit-review`. This endpoint keeps the older payload
 * and response shape while preventing a second divergent scheduler pipeline.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { submitDrillReview, resolveCorrectAnswer, type QuestionData } from '../../../lib/services/drillReviewService';
import { getEorRotationEnd } from '../../../lib/fsrs/eorScheduler';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { resolveReviewQuestion, PLACEHOLDER_CORRECT_ANSWER } from '../drills/_shared/reviewQuestionResolver';
import { markConsumed } from '../../../lib/services/reservoir';

const SRSSubmitSchema = z.object({
  body: z.object({
    srsItemId: z.string().uuid().optional(),
    topicProgressId: z.string().uuid().optional(),
    questionId: z.string().min(1),
    rating: z.number().int().min(1).max(4),
    gradeContinuous: z.number().min(1).max(4).optional(),
    isCorrect: z.boolean(),
    userAnswer: z.string().optional(),
    timeSpent: z.number().int().min(0).max(3600000).optional(),
    variantId: z.string().uuid().optional(),
    attemptId: z.string().optional(),
    telemetry: z.record(z.string(), z.unknown()).optional(),
    urgencyMultiplier: z.number().min(0).max(3).optional(),
    progressContext: z.preprocess(
      (value) => (typeof value === 'string' ? value.toUpperCase() : value),
      z.enum(['READINESS', 'TARGETED']).optional()
    ),
  }),
});

type SrsSubmitBody = z.infer<typeof SRSSubmitSchema>['body'];

function getOptionLabels(questionData: QuestionData): string[] {
  const rawOptions = Array.isArray(questionData.options)
    ? questionData.options
    : Array.isArray(questionData.choices)
      ? questionData.choices
      : [];

  return rawOptions
    .map((candidate) => {
      if (typeof candidate === 'string') return candidate;
      if (candidate && typeof candidate === 'object') {
        return candidate.value ?? candidate.text ?? candidate.label ?? null;
      }
      return null;
    })
    .filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
}

export function synthesizeLegacySrsSelectedAnswer(
  questionData: QuestionData,
  body: Pick<SrsSubmitBody, 'isCorrect' | 'userAnswer'>
): string | null {
  const providedAnswer = body.userAnswer?.trim();
  if (providedAnswer) return providedAnswer;

  const correctAnswer = resolveCorrectAnswer(questionData);
  if (body.isCorrect) {
    return correctAnswer;
  }

  const incorrectOption = getOptionLabels(questionData).find((option) => {
    if (!correctAnswer) return true;
    return option.trim().toLowerCase() !== correctAnswer.trim().toLowerCase();
  });

  return incorrectOption ?? (correctAnswer ? PLACEHOLDER_CORRECT_ANSWER : null);
}

export const onRequestPost = authenticatedEndpoint(SRSSubmitSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/submit');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
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

    const body = validated.body;
    const reviewSessionType = body.progressContext === 'TARGETED' ? 'targeted' : 'main';
    const preResolvedSelectedAnswer = body.userAnswer?.trim() || (body.isCorrect ? PLACEHOLDER_CORRECT_ANSWER : '__selected_answer__');
    const { question } = await resolveReviewQuestion(prisma, {
      userId: user.id,
      questionId: body.questionId,
      selectedAnswer: preResolvedSelectedAnswer,
    });

    if (!question) {
      return { status: 404, error: 'Question not found' };
    }

    const selectedAnswer = synthesizeLegacySrsSelectedAnswer(
      (question.questionData as QuestionData) ?? {},
      body
    );

    if (!selectedAnswer) {
      logger.warn('Legacy SRS submit could not resolve selected answer', {
        questionId: body.questionId,
        hasUserAnswer: Boolean(body.userAnswer),
        isCorrect: body.isCorrect,
      });
      return {
        status: 422,
        error: 'Could not resolve submitted answer for review.',
        code: 'UNPROCESSABLE_ENTITY',
      };
    }

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });

    const telemetrySessionId =
      typeof body.telemetry?.session_id === 'string' && body.telemetry.session_id.trim().length > 0
        ? body.telemetry.session_id
        : undefined;

    const result = await submitDrillReview(
      prisma,
      user.id,
      {
        questionId: body.questionId,
        selectedAnswer,
        timeSpentMs: body.timeSpent ?? 0,
        telemetry: body.telemetry as any,
        sessionType: reviewSessionType,
        idempotencyKey: body.attemptId,
      },
      question,
      { info: logger.info.bind(logger), warn: logger.warn.bind(logger), error: logger.error.bind(logger) },
      eorRotationEnd,
      body.urgencyMultiplier
    );

    if (telemetrySessionId) {
      try {
        await markConsumed(prisma, telemetrySessionId, [body.questionId]);
      } catch (consumeError) {
        logger.warn('Legacy SRS reservoir consume failed (non-fatal)', {
          questionId: body.questionId,
          sessionId: telemetrySessionId,
          error: consumeError instanceof Error ? consumeError.message : String(consumeError),
        });
      }
    }

    // Canonical review scheduling is owned by submitDrillReview/drillReviewService.
    // This compatibility route must not write a second concept schedule.
    if (typeof result.isCorrect === 'boolean') {
      if (result.isCorrect === false && question.conditionId) {
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
          user.id
        ).catch((error: unknown) => {
          logger.warn('Legacy SRS ensureDueVariant failed (non-fatal)', {
            questionId: body.questionId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    const nextReviewDate = result.fsrsSchedule?.nextDueDate;
    const triggerVisualRegeneration =
      result.isCorrect === false && (question.conditionId != null || body.questionId != null);

    logger.info('Legacy SRS submit delegated to drillReviewService', {
      userId: user.id.substring(0, 10),
      questionId: body.questionId.substring(0, 10),
      sourceQuestionId: question.sourceQuestionId,
      questionSource: question.questionSource,
      progressContext: body.progressContext ?? 'READINESS',
      fsrsUpdated: Boolean(result.fsrsSchedule),
    });

    return {
      data: {
        success: true,
        nextReviewDate,
        ...(triggerVisualRegeneration && {
          triggerVisualRegeneration: true,
          questionId: body.questionId,
          conditionId: question.conditionId ?? undefined,
          topicProgressId: body.topicProgressId,
          visualRegenerationHint:
            'Call POST /api/srs/generate-visual with front/back (or question text) and style: "exaggerated" for cartoon mnemonic; display with Flip animation.',
        }),
      },
    };
  } catch (error) {
    logger.error('SRS submit compatibility adapter error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId.substring(0, 10),
    });
    throw new Error('Failed to submit SRS review');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
