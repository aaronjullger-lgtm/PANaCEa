import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    card: { findMany: vi.fn() },
    userTopicProgress: { findMany: vi.fn() },
    userProgress: { findMany: vi.fn() },
    preGeneratedQuestion: { findMany: vi.fn(), updateMany: vi.fn() },
    question: { findMany: vi.fn() },
  } as any,
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

vi.mock('../../../lib/taskTypes', () => ({
  getTaskTypeFromContent: vi.fn(() => 'diagnosis'),
}));

import './next';

function makeContext() {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: 'clerk-user-1' },
    validated: {},
  };
}

describe('GET /api/srs/next', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.updateMany.mockResolvedValue({});
    mockPrisma.question.findMany.mockResolvedValue([]);
  });

  it('loads second-chance variants only from approved pregenerated questions', async () => {
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        progressContext: 'TARGETED',
        state: 1,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'pg-approved-1',
        conditionId: 'condition-1',
        system: 'CV',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: 'Q',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'A is correct.',
        },
        generatedAt: new Date(),
      },
    ]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.question.id).toBe('pg-approved-1');
    expect(result.data.isVariant).toBe(true);
    expect(result.data.progressContext).toBe('TARGETED');
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: 'condition-1',
          validationStatus: 'approved',
        }),
      })
    );
  });

  it('serves due Card rows before condition/topic fallbacks', async () => {
    mockPrisma.card.findMany.mockResolvedValue([
      {
        id: 'card-1',
        questionId: 'q-approved-1',
        questionIdentityId: 'identity-q-approved-1',
        progressContext: 'TARGETED',
        due: new Date('2026-05-01T12:00:00Z'),
        stability: 4,
        difficulty: 0.7,
        state: 2,
        Question: {
          id: 'q-approved-1',
          vignette: 'A patient presents for follow-up.',
          question: 'What is the next best step?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'A is correct.',
          conditionId: 'condition-1',
          medicalContentId: 'medical-content-1',
          system: 'CV',
          difficulty: 'medium',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
          taskType: 'management',
        },
      },
    ]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-2',
        taskType: 'diagnosis',
        state: 1,
      },
    ]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.cardId).toBe('card-1');
    expect(result.data.questionIdentityId).toBe('identity-q-approved-1');
    expect(result.data.question.id).toBe('q-approved-1');
    expect(result.data.question.canonicalQuestionId).toBe('q-approved-1');
    expect(result.data.question.sourceQuestionId).toBe('q-approved-1');
    expect(result.data.question.questionSource).toBe('question');
    expect(result.data.question.questionIdentityId).toBe('identity-q-approved-1');
    expect(result.data.question.source).toBe('question');
    expect(result.data.progressContext).toBe('TARGETED');
    expect(mockPrisma.userTopicProgress.findMany).not.toHaveBeenCalled();
  });

  it('emits canonical identity fields for pre-generated variant questions', async () => {
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        progressContext: 'TARGETED',
        state: 1,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'pg-approved-1',
        conditionId: 'condition-1',
        system: 'CV',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: 'Q',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'A is correct.',
        },
        generatedAt: new Date(),
      },
    ]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.question).toEqual(
      expect.objectContaining({
        id: 'pg-approved-1',
        canonicalQuestionId: null,
        sourceQuestionId: 'pg-approved-1',
        questionSource: 'pre_generated',
        source: 'pre_generated',
      })
    );
  });

  it('filters /api/srs/next card/topic/progress reads by progressContext when requested', async () => {
    await _capture.handler!({
      ...makeContext(),
      validated: { progressContext: 'TARGETED' },
    });

    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          progressContext: 'TARGETED',
        }),
      })
    );
    expect(mockPrisma.userTopicProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          progressContext: 'TARGETED',
        }),
      })
    );
    expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          progressContext: 'TARGETED',
        }),
      })
    );
  });

  it('skips due Card rows linked to non-production-safe Questions', async () => {
    mockPrisma.card.findMany.mockResolvedValue([
      {
        id: 'card-draft',
        questionId: 'q-draft',
        progressContext: 'TARGETED',
        Question: {
          id: 'q-draft',
          question: 'Draft question?',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'A is correct.',
          conditionId: 'condition-1',
          system: 'CV',
          difficulty: 'medium',
          lifecycleStatus: 'DRAFT',
          qaStatus: 'UNREVIEWED',
        },
      },
    ]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.message).toBe('No items due');
    expect(_logger.warn).toHaveBeenCalledWith(
      'Skipping due Card linked to non-production-safe Question',
      expect.objectContaining({
        cardId: 'card-draft',
        questionId: 'q-draft',
      })
    );
  });

  it('uses production-safe filters for UserProgress fallback hydration', async () => {
    mockPrisma.userProgress.findMany.mockResolvedValue([
      {
        conditionId: 'condition-2',
        progressContext: 'READINESS',
        fsrsCard: { state: 2 },
      },
    ]);
    mockPrisma.question.findMany.mockResolvedValue([
      {
        id: 'q-approved-1',
        conditionId: 'condition-2',
        question: 'What is next?',
        stem: 'What is next?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is correct.',
        system: 'CV',
        difficulty: 'medium',
      },
    ]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.question.id).toBe('q-approved-1');
    expect(result.data.progressContext).toBe('READINESS');
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: { in: ['condition-2'] },
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: { in: ['condition-2'] },
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });
});
