import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  dailyStudyPlan: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

const mockCache = vi.hoisted(() => ({
  getFromCache: vi.fn(),
  isKVAvailable: vi.fn(),
  getStudyPathCacheKey: vi.fn(),
}));

const mockResolveOrCreateUserRecord = vi.hoisted(() => vi.fn());

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('../_shared/cors', () => ({
  getCorsConfig: vi.fn(() => ({ allowedOrigins: ['*'] })),
  getCorsHeaders: vi.fn(() => ({})),
}));

vi.mock('../_shared/cache', () => ({
  CACHE_CONFIG: {
    PREFIX: { STUDY_PATH: 'study_path:' },
  },
  getFromCache: (...args: unknown[]) => mockCache.getFromCache(...args),
  getStudyPathCacheKey: (...args: unknown[]) => mockCache.getStudyPathCacheKey(...args),
  isKVAvailable: (...args: unknown[]) => mockCache.isKVAvailable(...args),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: (...args: unknown[]) => mockResolveOrCreateUserRecord(...args),
}));

import { onRequestPut } from './accept';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      CACHE: {
        put: vi.fn(),
      },
    },
    request: new Request('https://studypanacea.com/api/study-path/accept', {
      method: 'PUT',
    }),
    auth: { userId: 'clerk-user-1' },
    validated: {
      planId: 'plan-accepted',
      ...overrides,
    },
  } as any;
}

function makeRecommendation() {
  return {
    plan: {
      id: 'plan-accepted',
      userId: 'user-db-1',
      generatedAt: new Date('2026-05-02T12:00:00Z'),
      validUntil: new Date('2026-05-03T12:00:00Z'),
      sessions: [
        {
          id: 'study-session-1',
          date: new Date('2026-05-03T14:00:00Z'),
          topics: [
            {
              taxonomyCode: 'Cardiovascular',
              subcategory: 'Valvular disease',
              recommendedAction: 'REVIEW',
              estimatedMinutes: 30,
              urgencyScore: 0.8,
            },
          ],
        },
      ],
      totalEstimatedMinutes: 30,
      confidence: 0.8,
      metadata: {
        blueprintCoverage: { Cardiovascular: 1 },
        projectedRetentionIncrease: 0.1,
        fatigueRisk: 'LOW',
        gapsProcessed: 1,
        constraintsUsed: {},
      },
    },
    alternatives: [],
    rationale: 'Test rationale',
    confidence: 0.8,
    canRegenerate: true,
    generatedAt: new Date('2026-05-02T12:00:00Z'),
  };
}

describe('PUT /api/study-path/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserRecord.mockResolvedValue({ id: 'user-db-1' });
    mockCache.isKVAvailable.mockReturnValue(true);
    mockCache.getStudyPathCacheKey.mockReturnValue('recommendation-cache-key');
    mockCache.getFromCache.mockResolvedValue(makeRecommendation());
    mockPrisma.dailyStudyPlan.findUnique.mockResolvedValue(null);
    mockPrisma.dailyStudyPlan.upsert.mockResolvedValue({});
  });

  it('persists an accepted cached study path into launchable daily study plan tasks', async () => {
    const context = makeContext();
    const response = await (onRequestPut as any)(context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.persistedDailyPlans).toBe(1);
    expect(mockResolveOrCreateUserRecord).toHaveBeenCalledWith(
      mockPrisma,
      'clerk-user-1',
      { id: true }
    );
    expect(mockCache.getStudyPathCacheKey).toHaveBeenCalledWith('clerk-user-1', {});
    expect(mockPrisma.dailyStudyPlan.upsert).toHaveBeenCalledWith({
      where: {
        userId_planDate: {
          userId: 'user-db-1',
          planDate: new Date('2026-05-03T00:00:00.000Z'),
        },
      },
      create: expect.objectContaining({
        userId: 'user-db-1',
        planDate: new Date('2026-05-03T00:00:00.000Z'),
        recommendedModes: ['core_adaptive'],
        targetQuestionsCount: 15,
        targetSystemFocus: ['Cardiovascular'],
        estimatedTimeMinutes: 30,
      }),
      update: expect.objectContaining({
        recommendedModes: ['core_adaptive'],
        targetQuestionsCount: 15,
        targetSystemFocus: ['Cardiovascular'],
        estimatedTimeMinutes: 30,
      }),
    });

    const upsertArg = mockPrisma.dailyStudyPlan.upsert.mock.calls[0]?.[0];
    const task = upsertArg?.create?.recommendedSessions?.[0];
    expect(task).toEqual(
      expect.objectContaining({
        kind: 'main',
        mode: 'core_adaptive',
        route: expect.stringContaining('/study/main-session?'),
        launchSettings: expect.objectContaining({
          mode: 'core_adaptive',
          focus: 'all',
          questionCount: 15,
          systems: ['Cardiovascular'],
        }),
      })
    );
    expect(task.route).toContain('source=study-plan');
    expect(task.route).toContain('planDate=2026-05-03');
    expect(task.route).toContain('systems=Cardiovascular');
  });

  it('still records acceptance when no cached plan can be matched', async () => {
    mockCache.getFromCache.mockResolvedValue(null);
    const context = makeContext();
    const response = await (onRequestPut as any)(context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.persistedDailyPlans).toBe(0);
    expect(mockPrisma.dailyStudyPlan.upsert).not.toHaveBeenCalled();
    expect(context.env.CACHE.put).toHaveBeenCalledWith(
      'accepted_plan:clerk-user-1',
      expect.stringContaining('"persistedDailyPlans":0'),
      { expirationTtl: 2592000 }
    );
  });

  it('persists the submitted accepted plan payload when the recommendation cache is unavailable', async () => {
    mockCache.isKVAvailable.mockReturnValue(false);
    mockCache.getFromCache.mockResolvedValue(null);
    const submittedPlan = makeRecommendation().plan;

    const response = await (onRequestPut as any)(
      makeContext({
        plan: {
          ...submittedPlan,
          generatedAt: submittedPlan.generatedAt.toISOString(),
          validUntil: submittedPlan.validUntil.toISOString(),
          sessions: submittedPlan.sessions.map((session) => ({
            ...session,
            date: session.date.toISOString(),
          })),
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.persistedDailyPlans).toBe(1);
    expect(mockPrisma.dailyStudyPlan.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.dailyStudyPlan.upsert.mock.calls[0]?.[0].create.targetSystemFocus).toEqual([
      'Cardiovascular',
    ]);
  });

  it('groups multiple accepted study-path sessions on the same day into one daily plan', async () => {
    const recommendation = makeRecommendation();
    recommendation.plan.sessions.push({
      id: 'study-session-2',
      date: new Date('2026-05-03T18:00:00Z'),
      topics: [
        {
          taxonomyCode: 'Pulmonary',
          subcategory: 'Vascular',
          recommendedAction: 'REVIEW',
          estimatedMinutes: 20,
          urgencyScore: 0.7,
        },
      ],
    });
    mockCache.getFromCache.mockResolvedValue(recommendation);

    const response = await (onRequestPut as any)(makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.persistedDailyPlans).toBe(1);
    expect(mockPrisma.dailyStudyPlan.upsert).toHaveBeenCalledTimes(1);

    const upsertArg = mockPrisma.dailyStudyPlan.upsert.mock.calls[0]?.[0];
    expect(upsertArg.create.recommendedSessions).toHaveLength(2);
    expect(upsertArg.create.targetQuestionsCount).toBe(25);
    expect(upsertArg.create.targetSystemFocus).toEqual(['Cardiovascular', 'Pulmonary']);
    expect(upsertArg.create.estimatedTimeMinutes).toBe(50);
  });

  it('preserves matching task progress and active day status when re-accepting a plan', async () => {
    mockPrisma.dailyStudyPlan.findUnique.mockResolvedValue({
      status: 'active',
      recommendedSessions: [
        {
          id: '2026-05-03-study-path-study-session-1',
          status: 'in_progress',
          startedAt: '2026-05-03T14:00:00.000Z',
          linkedSessionId: 'session-123',
          actualQuestionsAnswered: 8,
          actualDurationMinutes: 18,
          actualAccuracy: 0.75,
        },
      ],
    });

    const response = await (onRequestPut as any)(makeContext());

    expect(response.status).toBe(200);
    const upsertArg = mockPrisma.dailyStudyPlan.upsert.mock.calls[0]?.[0];
    expect(upsertArg.update.status).toBe('active');
    expect(upsertArg.update.recommendedSessions[0]).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        startedAt: '2026-05-03T14:00:00.000Z',
        linkedSessionId: 'session-123',
        actualQuestionsAnswered: 8,
        actualDurationMinutes: 18,
        actualAccuracy: 0.75,
      })
    );
  });
});
