/**
 * Study session lifecycle — coordinates with deterministic NBA.
 * Writes session metadata only; attempts go through drillReviewService.
 */

import type { PrismaClient } from '@prisma/client';
import { getNextBestAction } from './learnerNextActionService';
import { getProgressSummary } from './learnerProgressService';
import type {
  StudySessionStartResult,
  StudySessionCompleteInput,
  StudySessionCompleteResult,
} from './types';

async function stableSessionId(idempotencyKey: string): Promise<string> {
  const data = new TextEncoder().encode(`learner-session:${idempotencyKey}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `ls_${hex.slice(0, 24)}`;
}

function fallbackSessionId(): string {
  return `ls_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function startStudySession(
  prisma: PrismaClient,
  userId: string,
  objective: string,
  options: {
    now?: Date;
    idempotencyKey?: string;
  } = {}
): Promise<StudySessionStartResult & { idempotent: boolean }> {
  const now = options.now ?? new Date();
  const sessionId = options.idempotencyKey
    ? await stableSessionId(options.idempotencyKey)
    : fallbackSessionId();

  const existing = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
  });

  const recommendedAction = await getNextBestAction(prisma, {
    userId,
    now,
    statedObjective: objective,
  });

  if (existing && !existing.endedAt) {
    return {
      sessionId: existing.id,
      objective,
      recommendedAction,
      startedAt: existing.startedAt.toISOString(),
      idempotent: true,
    };
  }

  if (!existing) {
    await prisma.studySession.create({
      data: {
        id: sessionId,
        userId,
        startedAt: now,
        totalQuestions: 0,
        correctAnswers: 0,
        accuracy: 0,
        totalTimeMs: 0,
        mode: 'learner_agent',
        focus: objective.slice(0, 200),
      },
    });
  }

  return {
    sessionId,
    objective,
    recommendedAction,
    startedAt: (existing?.startedAt ?? now).toISOString(),
    idempotent: Boolean(existing),
  };
}

async function aggregateSessionAttempts(
  prisma: PrismaClient,
  userId: string,
  sessionId: string
): Promise<{ questionsAnswered: number; correctAnswers: number; accuracy: number }> {
  const attempts = await prisma.questionAttempt.findMany({
    where: {
      userId,
      telemetryJson: {
        path: ['session_id'],
        equals: sessionId,
      },
    },
    select: { wasCorrect: true, timeSpentMs: true, durationMs: true },
  });

  if (attempts.length === 0) {
    return { questionsAnswered: 0, correctAnswers: 0, accuracy: 0 };
  }

  const correctAnswers = attempts.filter((a) => a.wasCorrect).length;
  return {
    questionsAnswered: attempts.length,
    correctAnswers,
    accuracy: correctAnswers / attempts.length,
  };
}

export async function completeStudySession(
  prisma: PrismaClient,
  userId: string,
  input: StudySessionCompleteInput,
  now: Date = new Date()
): Promise<StudySessionCompleteResult> {
  const session = await prisma.studySession.findFirst({
    where: { id: input.sessionId, userId },
  });

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.endedAt) {
    const [progressSummary, nextAction] = await Promise.all([
      getProgressSummary(prisma, userId, now),
      getNextBestAction(prisma, { userId, now }),
    ]);
    return {
      sessionId: input.sessionId,
      completedAt: session.endedAt.toISOString(),
      progressSummary,
      nextAction,
    };
  }

  const canonical = await aggregateSessionAttempts(prisma, userId, input.sessionId);
  const questionsAnswered = canonical.questionsAnswered || input.questionsAnswered;
  const correctAnswers =
    canonical.questionsAnswered > 0 ? canonical.correctAnswers : Math.round(input.questionsAnswered * input.accuracy);
  const accuracy = questionsAnswered > 0 ? correctAnswers / questionsAnswered : input.accuracy;

  const totalTimeMs =
    canonical.questionsAnswered > 0
      ? (await prisma.questionAttempt.findMany({
          where: {
            userId,
            telemetryJson: { path: ['session_id'], equals: input.sessionId },
          },
          select: { timeSpentMs: true, durationMs: true },
        })).reduce((sum, a) => sum + (a.timeSpentMs ?? a.durationMs ?? 0), 0)
      : input.durationMinutes * 60 * 1000;

  await prisma.studySession.update({
    where: { id: input.sessionId },
    data: {
      endedAt: now,
      totalQuestions: questionsAnswered,
      correctAnswers,
      accuracy,
      totalTimeMs,
    },
  });

  const [progressSummary, nextAction] = await Promise.all([
    getProgressSummary(prisma, userId, now),
    getNextBestAction(prisma, { userId, now }),
  ]);

  return {
    sessionId: input.sessionId,
    completedAt: now.toISOString(),
    progressSummary,
    nextAction,
  };
}

export async function assertSessionOwnedByUser(
  prisma: PrismaClient,
  userId: string,
  sessionId: string
): Promise<void> {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!session) throw new Error('SESSION_NOT_FORBIDDEN');
}
