import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  preGeneratedQuestion: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  question: {
    upsert: vi.fn(),
  },
  questionAnswerChoice: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  questionExplanation: {
    upsert: vi.fn(),
  },
};

vi.mock('../_shared/middleware', () => ({
  adminAuthenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../_shared/auditLog', () => ({
  auditLog: vi.fn(),
}));

import { onRequestGet, onRequestPost } from './question-review';

function context(body: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'admin-clerk-1', metadata: { dbUserId: 'admin-db-1' } },
    validated: { body },
  } as never;
}

function getContext(validated: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'admin-clerk-1', metadata: { dbUserId: 'admin-db-1' } },
    validated,
  } as never;
}

function preGeneratedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pgq-review-1',
    validationStatus: 'pending',
    questionData: {
      vignette: 'A stable patient has pleuritic chest pain after surgery.',
      question: 'Which test confirms pulmonary embolism?',
      options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
      correctAnswer: 'B',
      explanation: 'CT pulmonary angiography confirms PE in a stable high-risk patient.',
      conditionName: 'Pulmonary embolism',
      subcategory: 'Vascular',
    },
    system: 'Pulmonary',
    difficulty: 'medium',
    conditionId: 'condition-1',
    medicalContentId: 'mc-1',
    generatedAt: new Date('2026-05-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('POST /api/admin/question-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.preGeneratedQuestion.findUnique.mockResolvedValue(preGeneratedQuestion());
    mockPrisma.preGeneratedQuestion.update.mockResolvedValue({
      id: 'pgq-review-1',
      validationStatus: 'approved',
      validatedAt: new Date(),
      validatedBy: 'admin-clerk-1',
      qualityScore: null,
      validationNotes: null,
    });
    mockPrisma.question.upsert.mockResolvedValue({});
    mockPrisma.questionAnswerChoice.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionAnswerChoice.upsert.mockResolvedValue({});
    mockPrisma.questionExplanation.upsert.mockResolvedValue({});
  });

  it('mirrors approved pre-generated questions to canonical Question before marking them approved', async () => {
    const result = await (onRequestPost as any)(
      context({
        questionId: 'pgq-review-1',
        validationStatus: 'approved',
        validationNotes: 'Reviewed by admin.',
      })
    );

    expect(result).toMatchObject({
      data: {
        success: true,
        message: 'Question approved',
      },
    });
    expect(mockPrisma.question.upsert).toHaveBeenCalledWith({
      where: { id: 'pgq-review-1' },
      create: expect.objectContaining({
        id: 'pgq-review-1',
        source: 'admin_review_pre_generated',
        correctAnswer: 'CT pulmonary angiography',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        medicalContentId: 'mc-1',
      }),
      update: expect.objectContaining({
        source: 'admin_review_pre_generated',
        correctAnswer: 'CT pulmonary angiography',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
      }),
    });
    expect(mockPrisma.questionAnswerChoice.upsert).toHaveBeenCalledWith({
      where: {
        questionId_choiceKey: {
          questionId: 'pgq-review-1',
          choiceKey: 'B',
        },
      },
      create: expect.objectContaining({
        questionId: 'pgq-review-1',
        choiceKey: 'B',
        choiceText: 'CT pulmonary angiography',
        isCorrect: true,
        displayOrder: 1,
      }),
      update: expect.objectContaining({
        choiceText: 'CT pulmonary angiography',
        isCorrect: true,
        displayOrder: 1,
      }),
    });
    expect(mockPrisma.questionExplanation.upsert).toHaveBeenCalledWith({
      where: {
        questionId_explanationType_version: {
          questionId: 'pgq-review-1',
          explanationType: 'CORRECT_RATIONALE',
          version: 1,
        },
      },
      create: expect.objectContaining({
        questionId: 'pgq-review-1',
        explanationType: 'CORRECT_RATIONALE',
        body: 'CT pulmonary angiography confirms PE in a stable high-risk patient.',
      }),
      update: expect.objectContaining({
        body: 'CT pulmonary angiography confirms PE in a stable high-risk patient.',
      }),
    });
    expect(mockPrisma.preGeneratedQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pgq-review-1' },
        data: expect.objectContaining({
          validationStatus: 'approved',
          validatedBy: 'admin-clerk-1',
          validationNotes: 'Reviewed by admin.',
        }),
      })
    );
  });

  it('fails closed instead of approving an unmirrorable pre-generated question', async () => {
    mockPrisma.preGeneratedQuestion.findUnique.mockResolvedValue(
      preGeneratedQuestion({
        questionData: {
          question: 'Unscorable?',
          options: ['A', 'B'],
          correctAnswer: 'Z',
          explanation: 'Explanation exists.',
        },
      })
    );

    const result = await (onRequestPost as any)(
      context({
        questionId: 'pgq-review-1',
        validationStatus: 'approved',
      })
    );

    expect(result).toMatchObject({
      status: 400,
      data: {
        success: false,
        error: expect.stringContaining('cannot be approved'),
      },
    });
    expect(mockPrisma.question.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.update).not.toHaveBeenCalled();
  });

  it('does not require a canonical mirror when rejecting a question', async () => {
    const result = await (onRequestPost as any)(
      context({
        questionId: 'pgq-review-1',
        validationStatus: 'rejected',
      })
    );

    expect(result).toMatchObject({
      data: {
        success: true,
        message: 'Question rejected',
      },
    });
    expect(mockPrisma.question.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.update).toHaveBeenCalledOnce();
  });

  it('auto-approve mirrors candidates before flipping validation status', async () => {
    mockPrisma.preGeneratedQuestion.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      preGeneratedQuestion({ id: 'auto-1' }),
    ]);
    mockPrisma.preGeneratedQuestion.update.mockResolvedValue({});

    const result = await (onRequestGet as any)(
      getContext({ action: 'auto-approve', dryRun: 'false' })
    );

    expect(result).toMatchObject({
      data: {
        success: true,
        data: {
          approved: 1,
          skipped: 0,
        },
      },
    });
    expect(mockPrisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'auto-1' },
        create: expect.objectContaining({
          id: 'auto-1',
          source: 'auto_approved_pre_generated',
          humanReviewed: false,
        }),
      })
    );
    expect(mockPrisma.preGeneratedQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'auto-1' },
        data: expect.objectContaining({
          validationStatus: 'approved',
          validatedBy: 'auto-approve-gate',
        }),
      })
    );
  });
});
