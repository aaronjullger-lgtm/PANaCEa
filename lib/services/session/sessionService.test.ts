import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    userQuestionSeen: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    preGeneratedQuestion: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    questionSeed: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    userProgress: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    medicalContent: {
      findMany: vi.fn(),
    },
  } as any,
}));

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../content/contentService', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    getConditionsContent: vi.fn().mockResolvedValue(new Map()),
  })),
}));

import { SessionService } from './sessionService';

function makePregeneratedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pg-1',
    questionType: 'mcq',
    system: 'CV',
    conditionId: 'condition-1',
    medicalContentId: 'medical-content-1',
    difficulty: 'medium',
    validationStatus: 'approved',
    generatedAt: new Date('2026-05-01T12:00:00Z'),
    questionData: {
      question: 'What is the next best step?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'A is correct.',
    },
    ...overrides,
  };
}

describe('SessionService production serving contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.userQuestionSeen.upsert.mockResolvedValue({});
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(1);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([makePregeneratedQuestion()]);
    mockPrisma.preGeneratedQuestion.create.mockResolvedValue({});
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.question.updateMany.mockResolvedValue({});
    mockPrisma.questionSeed.findMany.mockResolvedValue([]);
    mockPrisma.questionSeed.update.mockResolvedValue({});
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findFirst.mockResolvedValue(null);
    mockPrisma.medicalContent.findMany.mockResolvedValue([]);
  });

  it('queries only approved pregenerated and active approved canonical questions', async () => {
    const service = new SessionService('postgresql://test', {} as any);

    await service.getSessionQuestions({
      userId: 'user-1',
      count: 5,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    expect(mockPrisma.preGeneratedQuestion.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usedAt: null,
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('does not serve seed-expanded or hot-path generated questions when safe persisted content is short', async () => {
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(0);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.question.findMany.mockResolvedValue([]);

    const service = new SessionService('postgresql://test', { GEMINI_API_KEY: 'test-key' } as any);
    const result = await service.getSessionQuestions({
      userId: 'user-1',
      count: 5,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    expect(result.questions).toEqual([]);
    expect(mockPrisma.questionSeed.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.medicalContent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
  });
});
