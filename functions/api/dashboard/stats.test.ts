import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDisconnect,
  mockSummary,
  mockPrefsFindUnique,
  mockEncounterFindMany,
  mockResolveUserId,
  mockD1GetOrSet,
  capturedHandlers,
} = vi.hoisted(() => {
  const capturedHandlers: Record<string, ((ctx: any) => Promise<any>) | null> = {
    get: null,
  };
  return {
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    mockSummary: vi.fn(),
    mockPrefsFindUnique: vi.fn(),
    mockEncounterFindMany: vi.fn(),
    mockResolveUserId: vi.fn().mockResolvedValue('user-db-1'),
    mockD1GetOrSet: vi.fn(),
    capturedHandlers,
  };
});

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    userPreferences: { findUnique: mockPrefsFindUnique },
    patientEncounterSession: { findMany: mockEncounterFindMany },
  }),
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) => {
    capturedHandlers.get = handler;
    return handler;
  },
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: () => ({
    addContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserId: (...args: unknown[]) => mockResolveUserId(...args),
}));

vi.mock('../_shared/d1-cache', () => ({
  d1GetOrSet: (...args: unknown[]) => mockD1GetOrSet(...args),
}));

vi.mock('../../../lib/services/dashboardAnalyticsService', () => ({
  getUserDashboardSummary: () => mockSummary(),
}));

import './stats';

function makeSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    stats: {
      overall: {
        currentStreak: 12,
        totalAttempts: 100,
        accuracy: 72, // percentage, per dashboardAnalyticsService percentFromCounts
      },
      weakAreas: [{ system: 'CARDIOLOGY' }],
      reviewQueueStats: { due: 5, new: 3 },
      studyPlanProgress: { completed: 10, total: 20 },
      ...overrides,
    },
  };
}

function makeContext(env: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test', ...env },
    auth: { userId: 'clerk_user_123' },
  };
}

describe('/api/dashboard/stats D1 caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serves cached payload without touching Prisma when D1 cache hits', async () => {
    const cached = { currentStreak: 99, weakestSystem: 'N/A', predictedPassChance: 50 };
    mockD1GetOrSet.mockResolvedValue(cached);

    const result = await capturedHandlers.get!(makeContext({ EDGE_DB: {} }));

    expect(result.data).toEqual(cached);
    expect(mockD1GetOrSet).toHaveBeenCalledWith(
      {},
      'dashboard:stats:clerk_user_123',
      expect.any(Function),
      120
    );
    // Cache hit: fetchFn never runs, so Prisma is never created/disconnected.
    expect(mockSummary).not.toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('computes payload from database on cache miss and disconnects Prisma', async () => {
    mockD1GetOrSet.mockImplementation(async (_db: unknown, _key: string, fetchFn: () => Promise<unknown>) =>
      fetchFn()
    );
    mockSummary.mockResolvedValue(makeSummary());
    mockPrefsFindUnique.mockResolvedValue({ streakGoalDays: 'weekdays', streakFreezes: 3, userCoins: 42 });
    mockEncounterFindMany.mockResolvedValue([]);

    const result = await capturedHandlers.get!(makeContext({ EDGE_DB: {} }));

    expect(result.data).toEqual(
      expect.objectContaining({
        currentStreak: 12,
        weakestSystem: expect.stringContaining('CARDIOLOGY'),
        streakFreezes: 3,
        userCoins: 42,
        streakGoalDays: 'weekdays',
        reviewQueueStats: { due: 5, new: 3 },
      })
    );
    expect(mockResolveUserId).toHaveBeenCalled();
    expect(mockPrefsFindUnique).toHaveBeenCalled();
    expect(mockEncounterFindMany).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('maps null prefs to all-streak defaults', async () => {
    mockD1GetOrSet.mockImplementation(async (_db: unknown, _key: string, fetchFn: () => Promise<unknown>) =>
      fetchFn()
    );
    mockSummary.mockResolvedValue(makeSummary());
    mockPrefsFindUnique.mockResolvedValue(null);
    mockEncounterFindMany.mockResolvedValue([]);

    const result = await capturedHandlers.get!(makeContext());

    expect(result.data.streakGoalDays).toBe('all');
    expect(result.data.streakFreezes).toBe(0);
    expect(result.data.userCoins).toBe(0);
  });

  it('derives predicted pass chance from OSCE scores', async () => {
    mockD1GetOrSet.mockImplementation(async (_db: unknown, _key: string, fetchFn: () => Promise<unknown>) =>
      fetchFn()
    );
    mockSummary.mockResolvedValue(makeSummary());
    mockPrefsFindUnique.mockResolvedValue(null);
    mockEncounterFindMany.mockResolvedValue([
      { OsceResult: { score: 85, clinicalReasoningScore: 85 } },
      { OsceResult: { score: 90, clinicalReasoningScore: 80 } },
    ]);

    const result = await capturedHandlers.get!(makeContext({ EDGE_DB: {} }));

    // avg OSCE = (85 + 85)/2 for first, (90 + 80)/2 for second = 85, 85 → avg 85
    // predicted = min(95, round(75 + (85-80)*0.5)) = min(95, 78) = 78
    expect(result.data.predictedPassChance).toBe(78);
  });

  it('falls back to quiz accuracy when no OSCE scores exist', async () => {
    mockD1GetOrSet.mockImplementation(async (_db: unknown, _key: string, fetchFn: () => Promise<unknown>) =>
      fetchFn()
    );
    mockSummary.mockResolvedValue(makeSummary());
    mockPrefsFindUnique.mockResolvedValue(null);
    mockEncounterFindMany.mockResolvedValue([{ OsceResult: null }]);

    const result = await capturedHandlers.get!(makeContext({ EDGE_DB: {} }));

    // accuracy 0.72 → round(35 + 72*0.5) = round(71) = 71
    expect(result.data.predictedPassChance).toBe(71);
  });
});
