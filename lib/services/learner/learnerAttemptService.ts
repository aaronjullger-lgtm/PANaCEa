/**
 * Verified attempt recording for the Learner Agent.
 *
 * Delegates to submitDrillReview — no FSRS logic duplicated here.
 * Requires idempotencyKey for agent-initiated writes.
 */

import type { PrismaClient } from '@prisma/client';
import { submitDrillReview } from '../drillReviewService';
import { resolveReviewQuestion } from '../reviewQuestionResolver';
import type { SubmitDrillReviewResult } from '../drillReviewService';

export interface RecordAttemptInput {
  questionId: string;
  selectedAnswer: string | number;
  timeSpentMs: number;
  idempotencyKey: string;
  studySessionId?: string;
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionSource?: 'question' | 'pre_generated' | 'staging' | 'seed' | 'generated';
  sessionType?: 'main' | 'drill' | 'targeted' | 'cram' | 'rapid_recall';
  timeToFirstClick?: number;
  answerSwitches?: number;
  totalDwellTime?: number;
  telemetry?: Record<string, unknown>;
}

export interface RecordAttemptResult extends SubmitDrillReviewResult {
  questionResolvedFrom: string;
}

export async function recordAttempt(
  prisma: PrismaClient,
  userId: string,
  input: RecordAttemptInput,
  logger?: { info: (msg: string, data?: unknown) => void; error: (msg: string, data?: unknown) => void }
): Promise<RecordAttemptResult> {
  if (!input.idempotencyKey?.trim()) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }

  const selectedAnswer = String(input.selectedAnswer);
  const { question, source } = await resolveReviewQuestion(prisma, {
    userId,
    questionId: input.questionId,
    canonicalQuestionId: input.canonicalQuestionId,
    sourceQuestionId: input.sourceQuestionId,
    questionSource: input.questionSource,
    selectedAnswer,
  });

  if (!question) {
    throw new Error('QUESTION_NOT_FOUND');
  }

  const telemetry = {
    ...(input.telemetry ?? {}),
    ...(input.studySessionId ? { session_id: input.studySessionId } : {}),
    learner_agent: true,
  };

  const result = await submitDrillReview(
    prisma as any,
    userId,
    {
      questionId: input.questionId,
      canonicalQuestionId: input.canonicalQuestionId ?? question.canonicalQuestionId,
      sourceQuestionId: input.sourceQuestionId ?? question.sourceQuestionId,
      questionSource: input.questionSource ?? question.questionSource,
      selectedAnswer,
      timeSpentMs: input.timeSpentMs,
      timeToFirstClick: input.timeToFirstClick,
      answerSwitches: input.answerSwitches,
      totalDwellTime: input.totalDwellTime,
      sessionType: input.sessionType ?? 'main',
      idempotencyKey: input.idempotencyKey,
      telemetry,
    },
    question,
    logger
  );

  return { ...result, questionResolvedFrom: source };
}

/**
 * Grade correctness without persisting — read-only helper for tools.
 */
export function gradeAttemptFromQuestion(
  questionData: unknown,
  selectedAnswer: string | number
): { isCorrect: boolean } {
  if (!questionData || typeof questionData !== 'object') {
    return { isCorrect: false };
  }
  const data = questionData as { correctAnswer?: string | number };
  if (data.correctAnswer == null) return { isCorrect: false };
  return { isCorrect: String(data.correctAnswer) === String(selectedAnswer) };
}
