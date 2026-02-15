/**
 * POST /api/srs/analyze-behavior
 * "Ghost Grader": Analyze user behavior (hesitation, hover, answer changes) via Gemini
 * to infer true recall difficulty and return confidence + implied FSRS rating.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  analyzeBehaviorGemini,
  type BehaviorTelemetryInput,
} from '../_shared/analyzeBehaviorGemini';

const AnalyzeBehaviorSchema = z.object({
  body: z.object({
    attemptId: z.string().optional(),
    questionId: z.string().optional(),
    rating: z.number().int().min(1).max(4),
    selectedAnswer: z.string().optional(),
    correctAnswerIndex: z.number().int().min(0).max(3).optional(),
    wasCorrect: z.boolean().optional(),
    telemetry: z
      .object({
        time_to_first_interaction_ms: z.number().nullable().optional(),
        answer_change_count: z.number().optional(),
        answer_changes: z.number().optional(),
        duration_ms: z.number().optional(),
        mouse_hover_duration_ms: z.record(z.string(), z.number()).optional(),
        trajectory_metrics: z
          .object({
            distractorHovers: z.record(z.string(), z.number()).optional(),
            hesitationIndex: z.number().optional(),
            confidenceScore: z.number().optional(),
          })
          .optional(),
        rapid_guess: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(AnalyzeBehaviorSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/analyze-behavior');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return { data: { error: 'User not found' }, status: 404 };
    }

    const {
      attemptId,
      questionId: _qId,
      rating,
      selectedAnswer,
      wasCorrect,
      telemetry,
    } = validated.body;

    let attempt: {
      id: string;
      telemetryJson: unknown;
      wasCorrect: boolean;
      selectedAnswer: string | null;
    } | null = null;
    let effectiveTelemetry: BehaviorTelemetryInput | null = telemetry ?? null;

    if (attemptId) {
      attempt = await prisma.questionAttempt.findFirst({
        where: { id: attemptId, userId: user.id },
        select: { id: true, telemetryJson: true, wasCorrect: true, selectedAnswer: true },
      });
      if (attempt?.telemetryJson && typeof attempt.telemetryJson === 'object') {
        effectiveTelemetry = attempt.telemetryJson as BehaviorTelemetryInput;
      }
    }

    const result = await analyzeBehaviorGemini(env, {
      rating,
      wasCorrect: wasCorrect ?? attempt?.wasCorrect,
      selectedAnswer: selectedAnswer ?? attempt?.selectedAnswer ?? undefined,
      telemetry: effectiveTelemetry,
    });

    const { confidence, impliedRating, rawText } = result;

    if (attempt?.id) {
      await prisma.questionAttempt.update({
        where: { id: attempt.id },
        data: { implicitConfidence: confidence },
      });
      await prisma.behaviorLog.create({
        data: {
          questionAttemptId: attempt.id,
          confidenceScore: confidence,
          impliedRating,
          rawResponse: rawText?.slice(0, 2000) ?? null,
        },
      });
    }

    logger.info('Behavior analyzed', {
      attemptId: attempt?.id ?? 'none',
      confidence,
      impliedRating,
    });

    return {
      data: {
        confidence,
        impliedRating,
        fromCache: false,
      },
    };
  } catch (error) {
    logger.error('analyze-behavior error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId?.substring(0, 10),
    });
    throw new Error('Failed to analyze behavior');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
