/**
 * GET /api/analytics/error-patterns
 *
 * Returns error pattern analysis for the current user's incorrect answers.
 * Classifies cognitive biases (anchoring, premature closure, availability,
 * confirmation, fatigue) from existing telemetry data.
 *
 * @see lib/services/errorPatternService.ts — Pure classification
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import type { CloudflareEnv } from '../_shared/types';
import {
  buildPatternProfile,
  type IncorrectAttemptTelemetry,
} from '../../../lib/services/errorPatternService';

const EmptySchema = z.object({});

type Env = CloudflareEnv;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof EmptySchema>;
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Resolve Clerk id to internal User.id — QuestionAttempt.userId is the internal id.
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return Response.json(
        {
          patterns: {
            totalAnalyzed: 0,
            patternCounts: {},
            dominantPattern: null,
            topPatterns: [],
            systemPatterns: {},
            remediations: [],
          },
          attemptCount: 0,
          meta: { status: 'user_not_synced' },
        },
        { status: 404 }
      );
    }

    const incorrectAttempts = await prisma.questionAttempt.findMany({
      where: { userId, wasCorrect: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        questionId: true,
        system: true,
        timeSpentMs: true,
        answerChangedCount: true,
        createdAt: true,
      },
    });

    if (incorrectAttempts.length === 0) {
      return Response.json({
        patterns: {
          totalAnalyzed: 0,
          patternCounts: {},
          dominantPattern: null,
          topPatterns: [],
          systemPatterns: {},
          remediations: [],
        },
        attemptCount: 0,
      });
    }

    const phenotype = await prisma.userStudyPhenotype.findUnique({
      where: { userId },
      select: { preferredSessionLength: true },
    });
    const parTimeMs = (phenotype?.preferredSessionLength ?? 45) * 60_000;
    const questions = await prisma.question.findMany({
      where: {
        id: { in: [...new Set(incorrectAttempts.map((attempt) => attempt.questionId))] },
      },
      select: {
        id: true,
        question: true,
        conditionId: true,
      },
    });
    const questionMap = new Map(questions.map((question) => [question.id, question]));

    const telemetry: IncorrectAttemptTelemetry[] = incorrectAttempts.map(
      (attempt, index) => ({
        questionId: attempt.questionId,
        system: attempt.system ?? 'unknown',
        conditionTested: questionMap.get(attempt.questionId)?.conditionId ?? 'unknown',
        selectedCondition: null,
        timeToFirstClickMs: (attempt.timeSpentMs ?? parTimeMs) * 0.3,
        totalDwellTimeMs: attempt.timeSpentMs ?? parTimeMs,
        answerSwitches: attempt.answerChangedCount ?? 0,
        commitmentGapMs: (attempt.timeSpentMs ?? parTimeMs) * 0.2,
        hintViewed: false,
        parTimeMs,
        selectedConditionRecentlySeen: false,
        isConfusionPair: false,
        firstClickWasCorrect: false,
        vignetteLengthChars: questionMap.get(attempt.questionId)?.question?.length ?? 500,
        sessionPosition: index,
        sessionLength: incorrectAttempts.length,
      })
    );

    const profile = buildPatternProfile(telemetry);

    return Response.json({
      patterns: profile,
      attemptCount: incorrectAttempts.length,
    });
  } catch (error) {
    console.error('Error analyzing error patterns:', error);
    return Response.json(
      { error: 'Failed to analyze error patterns' },
      { status: 500 }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
