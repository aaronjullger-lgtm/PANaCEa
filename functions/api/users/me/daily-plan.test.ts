import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockPlanFindUnique,
  mockPlanUpdate,
  mockGetOrCreateDailyStudyPlan,
  mockApplyDailyStudyPlanAction,
  mockSafePrismaDisconnect,
  capturedHandlers,
  registerHandler,
} = vi.hoisted(() => {
  const capturedHandlers: { get: ((ctx: any) => Promise<any>) | null; post: ((ctx: any) => Promise<any>) | null; index: number } = {
    get: null,
    post: null,
    index: 0,
  };
  return {
    mockUserFindUnique: vi.fn(),
    mockUserCreate: vi.fn(),
    mockPlanFindUnique: vi.fn(),
    mockPlanUpdate: vi.fn(),
    mockGetOrCreateDailyStudyPlan: vi.fn(),
    mockApplyDailyStudyPlanAction: vi.fn(),
    mockSafePrismaDisconnect: vi.fn(),
    capturedHandlers,
    registerHandler: (handler: (ctx: any) => Promise<any>) => {
      if (capturedHandlers.index === 0) capturedHandlers.get = handler;
      else capturedHandlers.post = handler;
      capturedHandlers.index += 1;
      return handler;
    },
  };
});

vi.mock('../../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) =>
    registerHandler(handler),
  withCors: () => vi.fn(),
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    user: { findUnique: mockUserFindUnique, create: mockUserCreate },
    dailyStudyPlan: { findUnique: mockPlanFindUnique, update: mockPlanUpdate },
  })),
  safePrismaDisconnect: (...args: unknown[]) => mockSafePrismaDisconnect(...args),
}));

vi.mock('../../../../lib/services/studyPlanService', () => ({
  getOrCreateDailyStudyPlan: (...args: unknown[]) => mockGetOrCreateDailyStudyPlan(...args),
  applyDailyStudyPlanAction: (...args: unknown[]) => mockApplyDailyStudyPlanAction(...args),
  normalizePlanDate: (date: Date) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  },
  sanitizeStudyPlanTasks: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}));

import './daily-plan';

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    userId: 'user-db-1',
    planDate: new Date('2026-04-26T00:00:00.000Z'),
    recommendedSessions: [],
    recommendedModes: ['practice'],
    targetQuestionsCount: 20,
    targetSystemFocus: [],
    estimatedTimeMinutes: 45,
    status: 'pending',
    actualQuestionsAnswered: 0,
    actualDurationMinutes: null,
    actualAccuracy: null,
    completedAt: null,
    wasEffective: null,
    feedbackReason: null,
    createdAt: new Date('2026-04-26T00:00:00.000Z'),
    updatedAt: new Date('2026-04-26T00:00:00.000Z'),
    ...overrides,
  };
}

function makeContext(validated: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated,
  };
}

describe('/api/users/me/daily-plan user ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET creates an internal user row before generating a first daily plan', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-db-1' });
    mockUserCreate.mockResolvedValue({ id: 'user-db-1' });
    mockGetOrCreateDailyStudyPlan.mockResolvedValue(makePlan());

    const result = await capturedHandlers.get!(makeContext({ date: '2026-04-26' }));

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_123',
          email: 'clerk_user_123@placeholder.panacea.app',
        }),
      })
    );
    expect(mockGetOrCreateDailyStudyPlan).toHaveBeenCalledWith(expect.any(Object), 'user-db-1', expect.any(Date));
    expect(result.status).toBe(200);
    expect(result.data.id).toBe('plan-1');
    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(expect.any(Object));
  });

  it('POST completes only the authenticated user daily plan', async () => {
    const plan = makePlan({ id: 'plan-owned', userId: 'user-db-1' });
    const completed = { ...plan, status: 'completed', completedAt: new Date('2026-04-26T12:00:00.000Z') };
    mockUserFindUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPlanFindUnique.mockResolvedValue(plan);
    mockApplyDailyStudyPlanAction.mockResolvedValue(completed);

    const result = await capturedHandlers.post!(
      makeContext({
        body: {
          accuracy: 0.8,
          durationMinutes: 30,
          userId: 'user-db-other',
        },
      })
    );

    expect(mockPlanFindUnique).toHaveBeenCalledWith({
      where: {
        userId_planDate: {
          userId: 'user-db-1',
          planDate: expect.any(Date),
        },
      },
    });
    expect(mockApplyDailyStudyPlanAction).toHaveBeenCalledWith(
      expect.any(Object),
      plan,
      expect.objectContaining({ action: undefined, accuracy: 0.8, durationMinutes: 30 })
    );
    expect(result.status).toBe(200);
    expect(result.data.status).toBe('completed');
  });

  it('POST can complete a single persisted task without losing the rest of the plan', async () => {
    const plan = makePlan({
      recommendedSessions: [
        { id: 'task-main', kind: 'main', mode: 'core_adaptive', status: 'pending', count: 20, route: '/study/main-session', launchParams: {} },
        { id: 'task-review', kind: 'targeted', mode: 'rapid_recall', status: 'pending', count: 10, route: '/modes/rapid-recall', launchParams: {} },
      ],
    });
    const updated = makePlan({
      ...plan,
      actualQuestionsAnswered: 20,
      status: 'active',
      recommendedSessions: [
        { id: 'task-main', kind: 'main', mode: 'core_adaptive', status: 'completed', count: 20, route: '/study/main-session', launchParams: {} },
        { id: 'task-review', kind: 'targeted', mode: 'rapid_recall', status: 'pending', count: 10, route: '/modes/rapid-recall', launchParams: {} },
      ],
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPlanFindUnique.mockResolvedValue(plan);
    mockApplyDailyStudyPlanAction.mockResolvedValue(updated);

    const result = await capturedHandlers.post!(
      makeContext({
        body: {
          action: 'complete',
          taskId: 'task-main',
          questionsAnswered: 20,
        },
      })
    );

    expect(mockApplyDailyStudyPlanAction).toHaveBeenCalledWith(
      expect.any(Object),
      plan,
      expect.objectContaining({ action: 'complete', taskId: 'task-main', questionsAnswered: 20 })
    );
    expect(result.data.progress.questionsAnswered).toBe(20);
    expect(result.data.status).toBe('active');
  });

  it('POST compatibility completion honors planDate and linkedSessionId', async () => {
    const plan = makePlan({ id: 'plan-linked', userId: 'user-db-1' });
    const completed = makePlan({
      ...plan,
      status: 'completed',
      recommendedSessions: [
        {
          id: 'task-main',
          kind: 'main',
          mode: 'core_adaptive',
          status: 'completed',
          count: 12,
          linkedSessionId: 'study-session-123',
        },
      ],
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPlanFindUnique.mockResolvedValue(plan);
    mockApplyDailyStudyPlanAction.mockResolvedValue(completed);

    await capturedHandlers.post!(
      makeContext({
        body: {
          action: 'complete',
          planDate: '2026-05-01',
          taskId: 'task-main',
          questionsAnswered: 12,
          linkedSessionId: 'study-session-123',
        },
      })
    );

    expect(mockPlanFindUnique).toHaveBeenCalledWith({
      where: {
        userId_planDate: {
          userId: 'user-db-1',
          planDate: new Date('2026-05-01T00:00:00.000Z'),
        },
      },
    });
    expect(mockApplyDailyStudyPlanAction).toHaveBeenCalledWith(
      expect.any(Object),
      plan,
      expect.objectContaining({
        taskId: 'task-main',
        linkedSessionId: 'study-session-123',
      })
    );
  });
});
