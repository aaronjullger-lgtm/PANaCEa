import { describe, it, expect, vi } from 'vitest';
import {
  PLACEHOLDER_CORRECT_ANSWER,
  resolveReviewQuestion,
} from '../functions/api/drills/_shared/reviewQuestionResolver';

describe('resolveReviewQuestion', () => {
  it('returns pre-generated question when available', async () => {
    const prisma = {
      preGeneratedQuestion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'pg-1',
          questionData: { question: 'Q' },
          conditionId: 'cond-1',
          medicalContentId: 'mc-1',
          system: 'CV',
          difficulty: 'medium',
          questionType: 'mcq',
        }),
      },
      question: { findUnique: vi.fn() },
      questionAttempt: { findFirst: vi.fn() },
    };

    const result = await resolveReviewQuestion(prisma as any, {
      userId: 'u-1',
      questionId: 'pg-1',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('pre_generated');
    expect(result.question?.id).toBe('pg-1');
    expect(prisma.question.findUnique).not.toHaveBeenCalled();
  });

  it('returns normalized main Question when pre-generated is missing', async () => {
    const prisma = {
      preGeneratedQuestion: { findUnique: vi.fn().mockResolvedValue(null) },
      question: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'q-1',
          vignette: 'Vignette',
          question: 'Question',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: 'Because',
          conditionId: 'cond-2',
          medicalContentId: 'mc-2',
          system: 'GI',
          difficulty: 'hard',
          taskType: 'diagnosis',
        }),
      },
      questionAttempt: { findFirst: vi.fn() },
    };

    const result = await resolveReviewQuestion(prisma as any, {
      userId: 'u-2',
      questionId: 'q-1',
      selectedAnswer: 'B',
    });

    expect(result.source).toBe('main_question');
    expect((result.question?.questionData as any).correctAnswer).toBe('B');
    expect(result.question?.questionType).toBe('diagnosis');
  });

  it('falls back to latest question attempt for ephemeral ids', async () => {
    const prisma = {
      preGeneratedQuestion: { findUnique: vi.fn().mockResolvedValue(null) },
      question: { findUnique: vi.fn().mockResolvedValue(null) },
      questionAttempt: {
        findFirst: vi.fn().mockResolvedValue({
          wasCorrect: false,
          conditionId: 'cond-3',
          medicalContentId: 'mc-3',
          system: 'NEURO',
        }),
      },
    };

    const result = await resolveReviewQuestion(prisma as any, {
      userId: 'u-3',
      questionId: 'seed-abc-123',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('question_attempt');
    expect(result.question?.conditionId).toBe('cond-3');
    expect(result.question?.difficulty).toBeNull();
    expect((result.question?.questionData as any).correctAnswer).toBe(PLACEHOLDER_CORRECT_ANSWER);
    expect((result.question?.questionData as any).options).toEqual([
      'A',
      PLACEHOLDER_CORRECT_ANSWER,
    ]);
  });

  it('returns missing when no source can be resolved', async () => {
    const prisma = {
      preGeneratedQuestion: { findUnique: vi.fn().mockResolvedValue(null) },
      question: { findUnique: vi.fn().mockResolvedValue(null) },
      questionAttempt: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    const result = await resolveReviewQuestion(prisma as any, {
      userId: 'u-4',
      questionId: 'unknown',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('missing');
    expect(result.question).toBeNull();
  });
});
