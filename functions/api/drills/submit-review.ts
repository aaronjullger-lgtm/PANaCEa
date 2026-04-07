import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { attachLogMeta, getRequestId } from '../_shared/requestLogger';
import { createSpan } from '../_shared/structuredLogger';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { createPipelineTracer } from '../../../lib/observability/pipelineTracer';
import { getEorRotationEnd } from '../../../lib/fsrs/eorScheduler';
import { scheduleConceptReview } from '../intelligence/profile';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
import { getRelativeDrillPerformance } from '../../../lib/services/drillAnalyticsService';

// Request schema — single source of truth lives in the shared library.
// To change the /api/drills/submit-review contract, edit lib/api/schemas/drills.ts.
import { DrillSubmitReviewRequestSchema } from '../../../lib/api/schemas/drills';
export const DrillSubmitReviewSchema = DrillSubmitReviewRequestSchema;

// FIX (Audit 8/F6): CORS preflight must NOT require auth.
// Browser OPTIONS requests never include Authorization headers,
// so wrapping in authenticatedEndpoint silently broke all cross-origin
// drill submissions (staging, preview deploys, etc.).
export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(DrillSubmitReviewSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/submit-review');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    logger.addContext({ userId: auth.userId });
    const requestId = getRequestId(context);

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
    } = validated;

    // Create pipeline tracer for structured observability across the entire review pipeline.
    // Pass the endpoint logger so tracer output flows through SecureLogger's redaction layer
    // rather than bypassing it with raw console.log(JSON.stringify(...)).
    const tracer = createPipelineTracer({
      pipeline: 'drill_review',
      requestId,
      userId: auth.userId,
      questionId,
      sessionType: sessionType ?? 'drill',
      logger,
    });

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

    const normalizedSelectedAnswer =
      typeof selectedAnswer === 'string' ? selectedAnswer : String(selectedAnswer);
    const { question } = await resolveReviewQuestion(prisma, {
      userId: user.id,
      questionId,
      selectedAnswer: normalizedSelectedAnswer,
    });

    if (!question) {
      return { status: 404, error: 'Question not found' };
    }

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });

    // Enrich tracer context with internal userId and session_id from telemetry.
    // session_id groups multiple submissions in one study session — lets you filter logs
    // with sessionId:"xyz" to see every question in the same session at once.
    tracer.addContext({
      internalUserId: user.id,
      ...(telemetry?.session_id ? { sessionId: telemetry.session_id } : {}),
    });

    tracer.step('request_validated', {
      hastelemetry: !!telemetry,
      hasTelemetryRapidGuess: telemetry?.rapid_guess ?? false,
    });

    const pipelineSpan = createSpan('drill_review_pipeline');
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
      eorRotationEnd,
      undefined, // urgencyMultiplier
      tracer
    );
    const { durationMs: pipelineMs } = pipelineSpan.end({
      userId: user.id,
      questionId,
      sessionType: sessionType ?? 'drill',
    });

    // Attach the full pipeline trace summary for structured log indexing
    const traceSummary = tracer.getSummary();

    // Attach structured metadata for request logging (Phase 1 + Phase 2 observability)
    attachLogMeta(context, {
      pipelineMs,
      isCorrect: result.isCorrect,
      sessionType: sessionType ?? 'drill',
      system: question.system,
      conditionId: question.conditionId,
      isRapidGuess: telemetry?.rapid_guess ?? false,
      fsrsUpdated: !!result.fsrsSchedule,
      // Phase 2: Pipeline trace summary for debugging
      traceDecisions: traceSummary.decisions.map(d => `${d.gate}:${d.outcome}`),
      traceSpans: traceSummary.spans.map(s => ({ name: s.name, ms: s.durationMs })),
      traceWarnings: traceSummary.warnings.length,
      traceTotalMs: traceSummary.totalDurationMs,
    });

    // SRS: Schedule concept review (Leitner-style: fail +1 day, pass +3 days)
    if (typeof result.isCorrect === 'boolean') {
      try {
        const conceptKey = `${question.system || 'General'}|${question.conditionId || questionId}`;
        await scheduleConceptReview(prisma, user.id, conceptKey, result.isCorrect);
      } catch (error_) {
        logger.warn('SRS scheduleConceptReview failed (non-fatal)', {
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
          user.id // pass userId so confusion pairs can be injected into the variant prompt
        ).catch((variantError: unknown) => {
          logger.warn('ensureDueVariant failed (non-fatal)', {
            questionId,
            conditionId: question.conditionId,
            error: variantError instanceof Error ? variantError.message : String(variantError),
          });
        });
      }
    }

    // Extract frontend feedback: rapid_guess and nextReview from result
    const isRapidGuess = telemetry?.rapid_guess ?? false;
    const nextReview = result.fsrsSchedule
      ? {
          intervalDays: result.fsrsSchedule.intervalDays,
          nextDueDate: result.fsrsSchedule.nextDueDate,
          stability: result.fsrsSchedule.stability,
          difficulty: result.fsrsSchedule.difficulty,
        }
      : null;

    // ── Relative drill performance feedback (read-after-write) ──────────────
    // Only computed for DRILL sessions; lightweight and non-blocking on failure.
    // conditionFamily is fetched from the Question table (not in reviewQuestionResolver result).
    let drillFeedback = null;
    if (sessionType === 'drill' || !sessionType) {
      try {
        // Look up conditionFamily — nullable, best effort
        let conditionFamily: string | null = null;
        if (question.conditionId) {
          const qDetail = await prisma.question.findUnique({
            where: { id: question.id },
            select: { conditionFamily: true },
          });
          conditionFamily = qDetail?.conditionFamily ?? null;
        }

        drillFeedback = await getRelativeDrillPerformance(
          prisma,
          user.id,
          conditionFamily,
          question.system ?? null
        );
      } catch {
        // Non-fatal: drill feedback is supplementary
      }
    }

    return {
      data: {
        ...result,
        isRapidGuess,
        nextReview,
        drillFeedback,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDbError = errorMessage.includes('prisma') || errorMessage.includes('database') || errorMessage.includes('connection');
    const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('timed out');

    logger.error('submit-review error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      category: isTimeoutError ? 'timeout' : isDbError ? 'database' : 'unknown',
      userId: auth.userId,
      questionId: validated.questionId,
      sessionType: validated.sessionType ?? 'drill',
    });

    return {
      status: isTimeoutError ? 504 : 500,
      error: 'Failed to submit review',
      code: isTimeoutError ? 'SUBMISSION_TIMEOUT' : isDbError ? 'DATABASE_ERROR' : 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error),
      retryable: isTimeoutError || isDbError,
    };
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
});
