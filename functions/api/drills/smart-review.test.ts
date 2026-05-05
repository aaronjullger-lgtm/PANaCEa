import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockSafePrismaDisconnect, captured } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    userTopicProgress: { findMany: vi.fn() },
    userProgress: { findMany: vi.fn() },
    preGeneratedQuestion: { findMany: vi.fn() },
    question: { findMany: vi.fn() },
  },
  mockSafePrismaDisconnect: vi.fn(),
  captured: { handler: null as any },
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: (...args: any[]) => mockSafePrismaDisconnect(...args),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    captured.handler = handler;
    return handler;
  }),
}));

import './smart-review';

function makeContext() {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated: {},
  };
}

describe('GET /api/drills/smart-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.question.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a smart-review queue from canonical topic progress and pregenerated questions', async () => {
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        nextReviewDate: new Date('2026-04-01T00:00:00.000Z'),
        difficulty: 7,
        stability: 4,
        reps: 3,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'preq-1',
        conditionId: 'condition-1',
        system: 'Pulmonary',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: 'Which diagnosis best fits this presentation?',
          options: ['Pneumonia', 'Pulmonary embolism'],
          correctAnswer: 'Pulmonary embolism',
          explanation: 'The presentation is most consistent with PE.',
        },
      },
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.success).toBe(true);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({
      id: 'topic-progress-1',
      questionId: 'preq-1',
      difficulty: 7,
      stability: 4,
      srsReason: 'WEAK_SPOT',
      question: {
        id: 'preq-1',
        stem: 'Which diagnosis best fits this presentation?',
        correctAnswer: 'Pulmonary embolism',
        system: 'Pulmonary',
      },
    });
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: { in: ['condition-1'] },
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conditionId: { in: ['condition-1'] },
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockPrisma.userTopicProgress.findMany).toHaveBeenCalled();
    expect(mockPrisma.userProgress.findMany).toHaveBeenCalled();
    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('returns an empty successful queue without touching legacy SRSItem data', async () => {
    const result = await captured.handler(makeContext());

    expect(result.data).toMatchObject({
      success: true,
      items: [],
      stats: { totalDue: 0, hardCount: 0, overdueCount: 0, newCount: 0 },
    });
    expect('sRSItem' in mockPrisma).toBe(false);
  });

  it('resolves pregenerated correctAnswerIndex and skips incomplete cards', async () => {
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        nextReviewDate: new Date('2026-04-01T00:00:00.000Z'),
        difficulty: 2,
        stability: 4,
        reps: 3,
      },
      {
        id: 'topic-progress-2',
        conditionId: 'condition-2',
        taskType: 'diagnosis',
        nextReviewDate: new Date('2026-04-01T00:00:00.000Z'),
        difficulty: 2,
        stability: 4,
        reps: 3,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'preq-indexed',
        conditionId: 'condition-1',
        system: 'Cardiology',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: 'Which rhythm is most likely?',
          options: ['Atrial fibrillation', 'SVT', 'Sinus tachycardia'],
          correctAnswerIndex: 1,
          explanation: 'The rhythm is SVT.',
        },
      },
      {
        id: 'preq-incomplete',
        conditionId: 'condition-2',
        system: 'Pulmonary',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: '',
          options: [],
        },
      },
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].questionId).toBe('preq-indexed');
    expect(result.data.items[0].question.correctAnswer).toBe('SVT');
  });

  it('skips pregenerated review questions whose answer key does not resolve to an option', async () => {
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      {
        id: 'topic-progress-1',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        nextReviewDate: new Date('2026-04-01T00:00:00.000Z'),
        difficulty: 2,
        stability: 4,
        reps: 3,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'preq-invalid',
        conditionId: 'condition-1',
        system: 'Pulmonary',
        difficulty: 'medium',
        questionData: {
          taskType: 'diagnosis',
          question: 'Which diagnosis best fits this presentation?',
          options: ['Pneumonia', 'Pulmonary embolism'],
          correctAnswer: 'Asthma',
          explanation: 'Invalid fixture should not be served.',
        },
      },
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(0);
    expect(result.data.stats.totalDue).toBe(0);
  });
});
