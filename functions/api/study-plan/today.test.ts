import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockDisconnect,
  mockGetDailyStudyAllocation,
  mockGetOrCreateDailyStudyPlan,
  captured,
} = vi.hoisted(() => {
  return {
    mockUserFindUnique: vi.fn(),
    mockUserCreate: vi.fn(),
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    mockGetDailyStudyAllocation: vi.fn(),
    mockGetOrCreateDailyStudyPlan: vi.fn(),
    captured: { get: null as ((ctx: any) => Promise<any>) | null },
  };
});

const mockPrisma = {
  user: { findUnique: mockUserFindUnique, create: mockUserCreate },
  dailyStudyPlan: {},
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) => {
    captured.get = handler;
    return handler;
  },
  withCors: () => vi.fn(),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => mockPrisma,
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../../../lib/services/dailyStudyAllocatorService', () => ({
  getDailyStudyAllocation: (...args: unknown[]) => mockGetDailyStudyAllocation(...args),
}));

vi.mock('../../../lib/services/studyPlanService', () => ({
  getOrCreateDailyStudyPlan: (...args: unknown[]) => mockGetOrCreateDailyStudyPlan(...args),
  sanitizeStudyPlanTasks: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}));

import './today';

function makeContext() {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    request: new Request('https://example.test/api/study-plan/today?userId=user-db-other'),
    validated: {},
  };
}

describe('GET /api/study-plan/today user ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDailyStudyAllocation.mockResolvedValue({
      recommendedMainCount: 30,
      recommendedTargetedCount: 25,
      mainSystems: [],
      targetedConditions: [],
      readinessPriority: 50,
      retentionPriority: 50,
      recommendedSplit: 'balanced',
      reasonSummary: 'No prior data yet.',
      generatedAt: new Date('2026-04-26T00:00:00.000Z'),
    });
    mockGetOrCreateDailyStudyPlan.mockResolvedValue({
      id: 'plan-1',
      planDate: new Date('2026-04-26T00:00:00.000Z'),
      status: 'pending',
      actualQuestionsAnswered: 0,
      targetQuestionsCount: 55,
      recommendedSessions: [],
    });
  });

  it('resolves Clerk auth to internal user id before querying user-owned study plan data', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'user-db-1' });

    const result = await captured.get!(makeContext());

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_user_123' },
      select: { id: true },
    });
    expect(mockGetDailyStudyAllocation).toHaveBeenCalledWith(mockPrisma, 'user-db-1');
    expect(mockGetOrCreateDailyStudyPlan).toHaveBeenCalledWith(mockPrisma, 'user-db-1');
    expect(mockGetDailyStudyAllocation).not.toHaveBeenCalledWith(mockPrisma, 'user-db-other');
    expect(result.data.recommendedSplit).toBe('balanced');
    expect(result.data.planId).toBe('plan-1');
  });

  it('creates the internal user row on first login and returns an empty-data plan', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-db-new' });
    mockUserCreate.mockResolvedValue({ id: 'user-db-new' });

    const result = await captured.get!(makeContext());

    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_123',
          email: 'clerk_user_123@placeholder.panacea.app',
        }),
      })
    );
    expect(mockGetDailyStudyAllocation).toHaveBeenCalledWith(mockPrisma, 'user-db-new');
    expect(result.data.reasonSummary).toBe('No prior data yet.');
  });
});
