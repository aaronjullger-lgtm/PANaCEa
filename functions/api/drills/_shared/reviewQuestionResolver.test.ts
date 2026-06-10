import { describe, expect, it, vi } from 'vitest';
import { resolveReviewQuestion } from './reviewQuestionResolver';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    preGeneratedQuestion: { findFirst: vi.fn().mockResolvedValue(null) },
    question: { findFirst: vi.fn().mockResolvedValue(null) },
    questionAttempt: { findFirst: vi.fn().mockResolvedValue(null) },
    ...overrides,
  } as any;
}

describe('resolveReviewQuestion', () => {
  it('marks PreGeneratedQuestion submissions with source identity', async () => {
    const prisma = makePrisma({
      preGeneratedQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pg-1',
          questionData: { question: 'Q', options: ['A', 'B'], correctAnswer: 'A' },
          conditionId: 'cond-1',
          medicalContentId: null,
          system: 'CV',
          difficulty: 'medium',
          questionType: 'mcq',
        }),
      },
    });

    const result = await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'pg-1',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('pre_generated');
    expect(result.question).toEqual(
      expect.objectContaining({
        id: 'pg-1',
        canonicalQuestionId: null,
        sourceQuestionId: 'pg-1',
        questionSource: 'pre_generated',
      })
    );
  });

  it('uses explicit pre-generated source ids instead of treating them as canonical questions', async () => {
    const prisma = makePrisma({
      preGeneratedQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pg-source-1',
          questionData: { question: 'Q', options: ['A', 'B'], correctAnswer: 'A' },
          conditionId: null,
          medicalContentId: 'mc-1',
          system: 'PULM',
          difficulty: 'medium',
          questionType: 'mcq',
        }),
      },
      question: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'runtime-id',
      sourceQuestionId: 'pg-source-1',
      canonicalQuestionId: null,
      questionSource: 'pre_generated',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('pre_generated');
    expect(prisma.preGeneratedQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pg-source-1' }),
      })
    );
    expect(prisma.question.findFirst).not.toHaveBeenCalled();
    expect(result.question).toEqual(
      expect.objectContaining({
        id: 'pg-source-1',
        canonicalQuestionId: null,
        sourceQuestionId: 'pg-source-1',
        questionSource: 'pre_generated',
        medicalContentId: 'mc-1',
      })
    );
  });

  it('marks canonical Question submissions with canonical identity', async () => {
    const prisma = makePrisma({
      question: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'q-1',
          vignette: 'vignette',
          question: 'Q',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Because',
          conditionId: 'cond-1',
          medicalContentId: null,
          system: 'CV',
          difficulty: 'medium',
          taskType: 'diagnosis',
        }),
      },
    });

    const result = await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'q-1',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('main_question');
    expect(result.question).toEqual(
      expect.objectContaining({
        id: 'q-1',
        canonicalQuestionId: 'q-1',
        sourceQuestionId: 'q-1',
        questionSource: 'question',
      })
    );
  });

  it('recovers pre-generated questions misattributed as canonical questions', async () => {
    const prisma = makePrisma({
      preGeneratedQuestion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pg-pool-1',
          questionData: { question: 'Q', options: ['A', 'B'], correctAnswer: 'A' },
          conditionId: 'cond-1',
          medicalContentId: null,
          system: 'CV',
          difficulty: 'medium',
          questionType: 'mcq',
        }),
      },
    });

    const result = await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'pg-pool-1',
      canonicalQuestionId: 'pg-pool-1',
      questionSource: 'question',
      selectedAnswer: 'A',
    });

    // The canonical claim is checked first, but a miss must fall back to
    // PreGeneratedQuestion instead of degrading to the attempt fallback.
    expect(prisma.question.findFirst).toHaveBeenCalled();
    expect(result.source).toBe('pre_generated');
    expect(result.question).toEqual(
      expect.objectContaining({
        id: 'pg-pool-1',
        canonicalQuestionId: null,
        sourceQuestionId: 'pg-pool-1',
        questionSource: 'pre_generated',
      })
    );
    expect(prisma.questionAttempt.findFirst).not.toHaveBeenCalled();
  });

  it('marks attempt fallback submissions as generated typed references', async () => {
    const prisma = makePrisma({
      questionAttempt: {
        findFirst: vi.fn().mockResolvedValue({
          wasCorrect: false,
          conditionId: 'cond-1',
          medicalContentId: null,
          system: 'PULM',
        }),
      },
    });

    const result = await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'localq-1',
      selectedAnswer: 'A',
    });

    expect(result.source).toBe('question_attempt');
    expect(result.question).toEqual(
      expect.objectContaining({
        id: 'localq-1',
        canonicalQuestionId: null,
        sourceQuestionId: 'localq-1',
        questionSource: 'generated',
      })
    );
  });

  it('requires production-safe question status before resolving persisted rows', async () => {
    const prisma = makePrisma();

    await resolveReviewQuestion(prisma, {
      userId: 'user-1',
      questionId: 'q-unsafe',
      selectedAnswer: 'A',
    });

    expect(prisma.preGeneratedQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-unsafe',
          validationStatus: 'approved',
        }),
      })
    );
    expect(prisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-unsafe',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });
});
