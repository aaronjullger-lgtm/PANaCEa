import { describe, expect, it, vi } from 'vitest';
import {
  buildEmptyDashboardStats,
  calculateCurrentStreak,
  calculateReviewQueueStats,
  clampNonNegativeInt,
  clampPercent,
  getUserDashboardSummary,
  percentFromCounts,
} from './dashboardAnalyticsService';

function expectNoInvalidNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) expectNoInvalidNumbers(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) expectNoInvalidNumbers(child);
  }
}

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    questionAttempt: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _avg: { timeSpentMs: null, answerChangedCount: null } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    reviewLog: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userQuestionSeen: {
      count: vi.fn().mockResolvedValue(0),
    },
    studySession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userProgress: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    dailyStudyPlan: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any;
}

describe('dashboardAnalyticsService', () => {
  it('guards invalid percentages and negative counts', () => {
    expect(percentFromCounts(1, 0)).toBe(0);
    expect(percentFromCounts(12, 10)).toBe(100);
    expect(percentFromCounts(-5, 10)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampNonNegativeInt(-2)).toBe(0);
  });

  it('builds an empty dashboard payload for a brand-new user', async () => {
    const prisma = createPrismaMock();
    const summary = await getUserDashboardSummary(prisma, 'user-1', new Date('2026-04-26T12:00:00.000Z'));

    expect(summary.stats.overall.totalAttempts).toBe(0);
    expect(summary.stats.overall.accuracy).toBe(0);
    expect(summary.stats.overall.currentStreak).toBe(0);
    expect(summary.stats.weakAreas).toEqual([]);
    expect(summary.stats.studyPlanProgress).toBeNull();
    expect(summary.stats.reviewQueueStats).toEqual({
      dueNow: 0,
      overdue: 0,
      dueToday: 0,
      upcoming7Days: 0,
      totalActive: 0,
    });
    expectNoInvalidNumbers(summary);
  });

  it('derives dashboard summary from partial real activity', async () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const prisma = createPrismaMock({
      questionAttempt: {
        count: vi.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(5),
        aggregate: vi.fn().mockResolvedValue({ _avg: { timeSpentMs: 45000, answerChangedCount: 0.5 } }),
        groupBy: vi.fn()
          .mockResolvedValueOnce([
            { system: 'CV', wasCorrect: true, _count: { id: 2 } },
            { system: 'CV', wasCorrect: false, _count: { id: 3 } },
            { system: 'PULM', wasCorrect: true, _count: { id: 3 } },
          ])
          .mockResolvedValueOnce([
            { conditionId: 'cond-1', wasCorrect: true, _count: { id: 2 } },
            { conditionId: 'cond-1', wasCorrect: false, _count: { id: 3 } },
          ]),
        findMany: vi.fn().mockResolvedValue([
          { wasCorrect: true, system: 'CV', conditionId: 'cond-1', mode: 'main', timeSpentMs: 30000, createdAt: '2026-04-26T10:00:00.000Z' },
          { wasCorrect: false, system: 'CV', conditionId: 'cond-1', mode: 'main', timeSpentMs: 60000, createdAt: '2026-04-25T10:00:00.000Z' },
          { wasCorrect: true, system: 'PULM', conditionId: 'cond-2', mode: 'rapid_recall', timeSpentMs: 5000, createdAt: '2026-04-20T10:00:00.000Z' },
        ]),
      },
      userQuestionSeen: {
        count: vi.fn().mockResolvedValue(7),
      },
      userProgress: {
        findMany: vi.fn().mockResolvedValue([
          { nextReviewAt: '2026-04-25T12:00:00.000Z' },
          { nextReviewAt: '2026-04-26T13:00:00.000Z' },
          { nextReviewAt: '2026-04-29T12:00:00.000Z' },
        ]),
      },
      dailyStudyPlan: {
        findFirst: vi.fn().mockResolvedValue({
          planDate: '2026-04-26T00:00:00.000Z',
          status: 'active',
          targetQuestionsCount: 20,
          actualQuestionsAnswered: 5,
          actualAccuracy: 80,
          estimatedTimeMinutes: 45,
        }),
      },
    });

    const summary = await getUserDashboardSummary(prisma, 'user-1', now);

    expect(summary.stats.overall.totalAttempts).toBe(8);
    expect(summary.stats.overall.correctAttempts).toBe(5);
    expect(summary.stats.overall.accuracy).toBe(63);
    expect(summary.stats.overall.questionsSeenCount).toBe(7);
    expect(summary.stats.overall.currentStreak).toBe(2);
    expect(summary.stats.bySystems.Cardiovascular?.accuracy).toBe(40);
    expect(summary.stats.weakAreas[0]?.system).toBe('Cardiovascular');
    expect(summary.stats.studyPlanProgress?.completionPercent).toBe(25);
    expect(summary.stats.reviewQueueStats).toEqual({
      dueNow: 1,
      overdue: 1,
      dueToday: 1,
      upcoming7Days: 2,
      totalActive: 3,
    });
    expectNoInvalidNumbers(summary);
  });

  it('calculates review buckets and streaks deterministically', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    expect(calculateCurrentStreak(['2026-04-24', '2026-04-25', '2026-04-26'], now)).toBe(3);
    expect(calculateCurrentStreak(['2026-04-23', '2026-04-24'], now)).toBe(0);
    expect(calculateReviewQueueStats([
      { nextReviewAt: '2026-04-24T12:00:00.000Z' },
      { nextReviewAt: '2026-04-26T10:00:00.000Z' },
      { nextReviewAt: '2026-04-28T10:00:00.000Z' },
      { nextReviewAt: null },
    ], now)).toEqual({
      dueNow: 2,
      overdue: 1,
      dueToday: 1,
      upcoming7Days: 1,
      totalActive: 4,
    });
  });

  it('empty dashboard fixture contains no invalid numbers', () => {
    expectNoInvalidNumbers(buildEmptyDashboardStats());
  });
});
