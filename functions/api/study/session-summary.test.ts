import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const mockPrisma: any = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  studySession: { findFirst: vi.fn(), update: vi.fn() },
  reviewLog: { findMany: vi.fn() },
  examBlueprintSystem: { findMany: vi.fn() },
  questionAttempt: { findMany: vi.fn() },
};

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
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../lib/services/antiGamingDistribution', () => ({
  analyzeDistribution: vi.fn().mockResolvedValue({
    isBalanced: true,
    skewScore: 0,
    windowSize: 2,
    overRepresented: [],
    underRepresented: [],
  }),
}));

import './session-summary';

function makeContext(sessionId = 'ses-1') {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk_user_1' },
    validated: { body: { sessionId } },
  };
}

describe('POST /api/study/session-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.studySession.findFirst.mockResolvedValue({
      id: 'ses-1',
      userId: 'user-db-1',
      blueprintLabel: 'PANCE',
      blueprintStage: 'pance_prep',
      blueprintExamTypes: ['PANCE'],
      totalQuestions: 2,
      correctAnswers: 0,
    });
    mockPrisma.reviewLog.findMany.mockResolvedValue([
      { system: 'Cardiovascular', wasCorrect: true, grade: 3 },
      { system: 'Cardiovascular', wasCorrect: false, grade: 1 },
    ]);
    mockPrisma.examBlueprintSystem.findMany.mockResolvedValue([
      { system: 'Cardiovascular', targetPercent: 0.16 },
    ]);
    mockPrisma.studySession.update.mockResolvedValue({});
  });

  it('summarizes only the authenticated user-owned session and marks it complete', async () => {
    const result = await _capture.handler!(makeContext());

    expect(result.data.correctAnswers).toBe(1);
    expect(result.data.totalQuestions).toBe(2);
    expect(result.data.sessionBreakdown.Cardiovascular).toMatchObject({
      count: 2,
      correct: 1,
      accuracy: 0.5,
    });
    expect(mockPrisma.studySession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ses-1', userId: 'user-db-1' },
      }),
    );
    expect(mockPrisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ses-1' },
        data: expect.objectContaining({
          endedAt: expect.any(Date),
          correctAnswers: 1,
          accuracy: 0.5,
        }),
      }),
    );
  });

  it('reports persisted answers separately from planned session size', async () => {
    mockPrisma.studySession.findFirst.mockResolvedValue({
      id: 'ses-1',
      userId: 'user-db-1',
      blueprintLabel: 'PANCE',
      blueprintStage: 'pance_prep',
      blueprintExamTypes: ['PANCE'],
      totalQuestions: 20,
      correctAnswers: 0,
    });
    mockPrisma.reviewLog.findMany.mockResolvedValue([
      { system: 'Pulmonary', wasCorrect: true, grade: 3 },
    ]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.totalQuestions).toBe(1);
    expect(result.data.plannedQuestions).toBe(20);
    expect(result.data.persistedAnswers).toBe(1);
    expect(result.data.reviewSyncComplete).toBe(true);
    expect(mockPrisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalQuestions: 1,
          correctAnswers: 1,
          accuracy: 1,
        }),
      }),
    );
  });

  it('does not inflate completed answers when no review logs have synced yet', async () => {
    mockPrisma.studySession.findFirst.mockResolvedValue({
      id: 'ses-1',
      userId: 'user-db-1',
      blueprintLabel: 'PANCE',
      blueprintStage: 'pance_prep',
      blueprintExamTypes: ['PANCE'],
      totalQuestions: 20,
      correctAnswers: 0,
    });
    mockPrisma.reviewLog.findMany.mockResolvedValue([]);

    const result = await _capture.handler!(makeContext());

    expect(result.data.totalQuestions).toBe(0);
    expect(result.data.plannedQuestions).toBe(20);
    expect(result.data.persistedAnswers).toBe(0);
    expect(result.data.reviewSyncComplete).toBe(false);
    expect(mockPrisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0,
        }),
      }),
    );
  });

  it('prevents cross-user session access', async () => {
    mockPrisma.studySession.findFirst.mockResolvedValue(null);

    const result = await _capture.handler!(makeContext('ses-other-user'));

    expect(result).toMatchObject({ status: 404, error: 'Session not found' });
    expect(mockPrisma.reviewLog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.studySession.update).not.toHaveBeenCalled();
  });

  it('creates a placeholder user for first-login summary empty states', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-db-1' });

    const result = await _capture.handler!(makeContext());

    expect(result.data.sessionId).toBe('ses-1');
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_1',
          email: 'clerk_user_1@placeholder.panacea.app',
        }),
      }),
    );
  });
});
