import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  preGeneratedQuestion: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  question: {
    upsert: vi.fn(),
  },
};

vi.mock('../_shared/middleware', () => ({
  adminEndpoint: vi.fn((_schema: unknown, handler: any) => handler),
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

import { onRequestPost } from './curate';

function context(body: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'admin-clerk-1' },
    validated: { body },
  } as never;
}

function preGeneratedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pg-1',
    questionType: 'mcq',
    system: 'Pulmonary',
    conditionId: 'condition-1',
    medicalContentId: 'mc-1',
    difficulty: 'medium',
    validationStatus: 'pending',
    questionData: {
      question: 'Which test confirms pulmonary embolism in this stable patient?',
      vignette: 'A postoperative patient has pleuritic chest pain.',
      options: ['D-dimer', 'CT pulmonary angiography', 'Chest x-ray', 'Spirometry'],
      correctAnswerIndex: 1,
      explanation: 'CT pulmonary angiography confirms PE in a stable high-risk patient.',
      conditionName: 'Pulmonary embolism',
      subcategory: 'Vascular',
    },
    ...overrides,
  };
}

describe('POST /api/questions/curate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.preGeneratedQuestion.findUnique.mockResolvedValue(preGeneratedQuestion());
    mockPrisma.preGeneratedQuestion.update.mockResolvedValue({});
    mockPrisma.preGeneratedQuestion.delete.mockResolvedValue({});
    mockPrisma.question.upsert.mockResolvedValue({});
  });

  it('approves generated questions by preserving the pool row and upserting an active approved canonical mirror', async () => {
    const result = await onRequestPost(
      context({ action: 'approve', questionId: 'pg-1' })
    );

    expect(result).toMatchObject({
      data: { success: true, message: 'Question approved for learner pool' },
    });
    expect(mockPrisma.question.upsert).toHaveBeenCalledWith({
      where: { id: 'pg-1' },
      create: expect.objectContaining({
        id: 'pg-1',
        correctAnswer: 'CT pulmonary angiography',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        humanReviewed: true,
        source: 'curated_pre_generated',
        medicalContentId: 'mc-1',
      }),
      update: expect.objectContaining({
        correctAnswer: 'CT pulmonary angiography',
        lifecycleStatus: 'ACTIVE',
        qaStatus: 'APPROVED',
        humanReviewed: true,
      }),
    });
    expect(mockPrisma.preGeneratedQuestion.update).toHaveBeenCalledWith({
      where: { id: 'pg-1' },
      data: expect.objectContaining({
        validationStatus: 'approved',
        validatedAt: expect.any(Date),
        validatedBy: 'admin-clerk-1',
        questionData: expect.objectContaining({
          canonicalQuestionId: 'pg-1',
          correctAnswer: 'CT pulmonary angiography',
        }),
      }),
    });
    expect(mockPrisma.preGeneratedQuestion.delete).not.toHaveBeenCalled();
  });

  it('fails closed instead of approving an unscorable generated question', async () => {
    mockPrisma.preGeneratedQuestion.findUnique.mockResolvedValue(
      preGeneratedQuestion({
        questionData: {
          question: 'Unscorable question',
          options: ['A', 'B'],
          correctAnswerIndex: 10,
          explanation: 'Explanation exists.',
        },
      })
    );

    const result = await onRequestPost(
      context({ action: 'approve', questionId: 'pg-1' })
    );

    expect(result).toMatchObject({
      status: 400,
      data: {
        error: expect.stringContaining('resolvable correct answer'),
      },
    });
    expect(mockPrisma.question.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.update).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.delete).not.toHaveBeenCalled();
  });

  it('marks edited pool questions pending until they are approved again', async () => {
    const result = await onRequestPost(
      context({
        action: 'update',
        questionId: 'pg-1',
        question: {
          question: 'Edited question',
          options: ['One', 'Two', 'Three', 'Four'],
          correctAnswerIndex: 2,
          rationale: 'Three is correct.',
          system: 'Cardiovascular',
          difficulty: 'hard',
        },
      })
    );

    expect(result).toMatchObject({
      data: { success: true, message: 'Question updated' },
    });
    expect(mockPrisma.preGeneratedQuestion.update).toHaveBeenCalledWith({
      where: { id: 'pg-1' },
      data: expect.objectContaining({
        system: 'Cardiovascular',
        difficulty: 'hard',
        validationStatus: 'pending',
        validatedAt: null,
        validatedBy: null,
        questionData: expect.objectContaining({
          question: 'Edited question',
          correctAnswer: 'Three',
          correctAnswerIndex: 2,
        }),
      }),
    });
  });
});
