import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSubmitDrillReview = vi.fn();
const mockResolveReviewQuestion = vi.fn();

vi.mock('@/lib/services/drillReviewService', () => ({
  submitDrillReview: (...args: unknown[]) => mockSubmitDrillReview(...args),
}));

vi.mock('@/lib/services/reviewQuestionResolver', () => ({
  resolveReviewQuestion: (...args: unknown[]) => mockResolveReviewQuestion(...args),
}));

import { recordAttempt } from '@/lib/services/learner/learnerAttemptService';

describe('recordAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveReviewQuestion.mockResolvedValue({
      question: {
        id: 'q1',
        questionData: { correctAnswer: 'A' },
        conditionId: 'c1',
        sourceQuestionId: 'q1',
        questionSource: 'question',
      },
      source: 'main_question',
    });
    mockSubmitDrillReview.mockResolvedValue({
      isCorrect: true,
      rating: 1,
      stability: 2.5,
      nextReview: new Date().toISOString(),
      fsrsUpdated: true,
    });
  });

  it('requires idempotencyKey', async () => {
    await expect(
      recordAttempt({} as any, 'user-1', {
        questionId: 'q1',
        selectedAnswer: 'A',
        timeSpentMs: 1000,
        idempotencyKey: '',
      })
    ).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('delegates to submitDrillReview without duplicating FSRS', async () => {
    const prisma = {} as any;
    const result = await recordAttempt(prisma, 'user-1', {
      questionId: 'q1',
      selectedAnswer: 'A',
      timeSpentMs: 4500,
      idempotencyKey: 'attempt-key-12345678',
      studySessionId: 'ls_session1',
    });

    expect(mockResolveReviewQuestion).toHaveBeenCalledOnce();
    expect(mockSubmitDrillReview).toHaveBeenCalledOnce();
    const submitArgs = mockSubmitDrillReview.mock.calls[0]![2];
    expect(submitArgs.idempotencyKey).toBe('attempt-key-12345678');
    expect(submitArgs.telemetry.session_id).toBe('ls_session1');
    expect(submitArgs.telemetry.learner_agent).toBe(true);
    expect(result.questionResolvedFrom).toBe('main_question');
    expect(result.fsrsUpdated).toBe(true);
  });

  it('throws when question cannot be resolved', async () => {
    mockResolveReviewQuestion.mockResolvedValue({ question: null, source: 'missing' });
    await expect(
      recordAttempt({} as any, 'user-1', {
        questionId: 'missing',
        selectedAnswer: 'A',
        timeSpentMs: 1000,
        idempotencyKey: 'attempt-key-12345678',
      })
    ).rejects.toThrow('QUESTION_NOT_FOUND');
  });
});
