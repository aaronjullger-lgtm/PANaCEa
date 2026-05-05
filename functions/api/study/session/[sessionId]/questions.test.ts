import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const mockPrisma = {
  user: { findUnique: vi.fn() },
  studySession: { findUnique: vi.fn() },
  preGeneratedQuestion: { findMany: vi.fn() },
  question: { findMany: vi.fn() },
};

vi.mock('../../../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    capture.handler = handler;
    return handler;
  }),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

import './questions';

function makeContext(sessionId = 'ses-1') {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: 'clerk-user-1' },
    validated: { sessionId },
  };
}

describe('GET /api/study/session/:sessionId/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.studySession.findUnique.mockResolvedValue({
      userId: 'user-1',
      questionIds: ['pg-1'],
      StudySessionQuestion: [],
      mode: 'condition',
      focus: 'topic',
      difficulty: 'adaptive',
      systemsTargeted: ['Pulmonary'],
      blueprintStage: 'pance_prep',
      blueprintLabel: null,
      totalQuestions: 1,
    });
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'pg-1',
        questionData: {
          question: 'A patient has wheezing. What is the next step?',
          options: ['Albuterol', 'Warfarin'],
          correctAnswer: 'Albuterol',
          explanation: 'Bronchodilator therapy treats acute bronchospasm.',
          medicalContentId: 'mc-1',
          conditionName: 'Asthma',
        },
        system: 'Pulmonary',
        difficulty: 'medium',
        conditionId: null,
        medicalContentId: 'mc-1',
      },
    ]);
    mockPrisma.question.findMany.mockResolvedValue([]);
  });

  it('preserves pre-generated source and MedicalContent identity on resume', async () => {
    const result = await capture.handler!(makeContext());

    expect(result.data.questions).toHaveLength(1);
    expect(result.data.questions[0]).toEqual(
      expect.objectContaining({
        id: 'pg-1',
        questionId: null,
        canonicalQuestionId: null,
        sourceQuestionId: 'pg-1',
        questionSource: 'pre_generated',
        conditionId: 'mc-1',
        medicalContentId: 'mc-1',
      })
    );
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          medicalContentId: true,
        }),
      })
    );
  });

  it('prefers ordered StudySessionQuestion source links when available', async () => {
    mockPrisma.studySession.findUnique.mockResolvedValue({
      userId: 'user-1',
      questionIds: ['stale-id'],
      StudySessionQuestion: [
        {
          questionId: null,
          preGeneratedQuestionId: 'pg-1',
          sequenceIndex: 0,
          source: 'pre_generated',
          metadata: { sourceQuestionId: 'pg-1' },
        },
      ],
      mode: 'condition',
      focus: 'topic',
      difficulty: 'adaptive',
      systemsTargeted: ['Pulmonary'],
      blueprintStage: 'pance_prep',
      blueprintLabel: null,
      totalQuestions: 1,
    });

    const result = await capture.handler!(makeContext());

    expect(result.data.questions).toHaveLength(1);
    expect(result.data.questions[0]).toEqual(
      expect.objectContaining({
        id: 'pg-1',
        questionSource: 'pre_generated',
        sourceQuestionId: 'pg-1',
      })
    );
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['pg-1'] },
        }),
      })
    );
    expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
  });
});
