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

function generateSessionId(): string {
  return `ls_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function startStudySession(
  prisma: PrismaClient,
  userId: string,
  objective: string,
  now: Date = new Date()
): Promise<StudySessionStartResult> {
  const recommendedAction = await getNextBestAction(prisma, {
    userId,
    now,
    statedObjective: objective,
  });

  const sessionId = generateSessionId();

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
    },
  });

  return {
    sessionId,
    objective,
    recommendedAction,
    startedAt: now.toISOString(),
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

  await prisma.studySession.update({
    where: { id: input.sessionId },
    data: {
      endedAt: now,
      totalQuestions: input.questionsAnswered,
      correctAnswers: Math.round(input.questionsAnswered * input.accuracy),
      accuracy: input.accuracy,
      totalTimeMs: input.durationMinutes * 60 * 1000,
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
