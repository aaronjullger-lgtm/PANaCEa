import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDailyStudyAllocation = vi.hoisted(() => vi.fn());

vi.mock('./dailyStudyAllocatorService', () => ({
  getDailyStudyAllocation: (...args: unknown[]) => mockGetDailyStudyAllocation(...args),
}));

import {
  applyDailyStudyPlanAction,
  buildStudyPlanTasks,
  getOrCreateDailyStudyPlan,
  normalizePlanDate,
  sanitizeStudyPlanTasks,
} from './studyPlanService';

function allocation(overrides: Record<string, unknown> = {}) {
  return {
    recommendedMainCount: 30,
    recommendedTargetedCount: 20,
    mainSystems: ['Pulmonary', 'Cardiovascular'],
    targetedConditions: ['asthma', 'heart-failure'],
    readinessPriority: 70,
    retentionPriority: 60,
    recommendedSplit: 'balanced',
    reasonSummary: 'Balanced plan.',
    generatedAt: new Date('2026-04-26T12:00:00.000Z'),
    ...overrides,
  } as any;
}

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', examDate: null }),
    },
    userPreferences: {
      findUnique: vi.fn().mockResolvedValue({ dailyGoal: 40, sessionLength: 45 }),
    },
    questionAttempt: {
      count: vi.fn().mockResolvedValue(0),
    },
    dailyStudyPlan: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async (args) => ({
        id: 'plan-1',
        actualQuestionsAnswered: 0,
        actualAccuracy: null,
        actualDurationMinutes: null,
        completedAt: null,
        wasEffective: null,
        createdAt: new Date('2026-04-26T00:00:00.000Z'),
        updatedAt: new Date('2026-04-26T00:00:00.000Z'),
        ...args.create,
      })),
      update: vi.fn(async (args) => ({
        id: args.where.id,
        userId: 'user-1',
        planDate: new Date('2026-04-26T00:00:00.000Z'),
        recommendedSessions: [],
        recommendedModes: [],
        targetQuestionsCount: 40,
        targetSystemFocus: [],
        estimatedTimeMinutes: 45,
        status: 'active',
        actualQuestionsAnswered: args.data.actualQuestionsAnswered ?? 0,
        actualAccuracy: args.data.actualAccuracy ?? null,
        actualDurationMinutes: args.data.actualDurationMinutes ?? null,
        completedAt: args.data.completedAt ?? null,
        wasEffective: null,
        feedbackReason: null,
        createdAt: new Date('2026-04-26T00:00:00.000Z'),
        updatedAt: args.data.updatedAt,
        ...args.data,
      })),
    },
    ...overrides,
  } as any;
}

describe('studyPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDailyStudyAllocation.mockResolvedValue(allocation());
  });

  it('builds launchable tasks from weak areas and due reviews', () => {
    const tasks = buildStudyPlanTasks({
      allocation: allocation({ readinessPriority: 80, retentionPriority: 75 }),
      planDate: new Date('2026-04-26T12:00:00.000Z'),
      dailyGoal: 40,
      sessionLength: 50,
      daysToExam: 10,
    });

    expect(tasks[0]).toEqual(expect.objectContaining({
      kind: 'main',
      mode: 'core_adaptive',
      systemFilter: ['Pulmonary', 'Cardiovascular'],
      route: expect.stringContaining('/study/main-session'),
      launchParams: expect.objectContaining({
        taskId: '2026-04-26-main-readiness',
        source: 'study-plan',
        mode: 'adaptive',
        systems: 'Pulmonary,Cardiovascular',
      }),
    }));
    expect(tasks[1]).toEqual(expect.objectContaining({
      kind: 'targeted',
      mode: 'rapid_recall',
      conditionIds: ['asthma', 'heart-failure'],
      route: expect.stringContaining('/study/main-session'),
      launchParams: expect.objectContaining({
        taskId: '2026-04-26-targeted-review',
        source: 'study-plan',
        mode: 'condition',
        conditions: 'asthma,heart-failure',
        conditionId: 'asthma',
      }),
    }));
  });

  it('creates a server-backed plan for a new user with no prior plan', async () => {
    const prisma = createPrismaMock();

    const plan = await getOrCreateDailyStudyPlan(prisma, 'user-1', new Date('2026-04-26T15:00:00.000Z'));

    expect(mockGetDailyStudyAllocation).toHaveBeenCalledWith(prisma, 'user-1');
    expect(prisma.dailyStudyPlan.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_planDate: {
          userId: 'user-1',
          planDate: normalizePlanDate(new Date('2026-04-26T15:00:00.000Z')),
        },
      },
    }));
    expect(plan.recommendedSessions.length).toBeGreaterThan(0);
    expect(plan.targetQuestionsCount).toBeGreaterThan(0);
  });

  it('prioritizes a starter block when no due reviews or history are available', () => {
    const tasks = buildStudyPlanTasks({
      allocation: allocation({
        recommendedMainCount: 10,
        recommendedTargetedCount: 0,
        mainSystems: [],
        targetedConditions: [],
        readinessPriority: 50,
        retentionPriority: 0,
      }),
      planDate: new Date('2026-04-26T12:00:00.000Z'),
      dailyGoal: 10,
      sessionLength: 15,
      daysToExam: null,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toMatch(/Readiness|Starter/);
    expect(tasks[0]?.route).toContain('/study/main-session');
  });

  it('syncs today question attempts into an existing pending plan on refresh', async () => {
    const existingPlan = {
      id: 'plan-1',
      userId: 'user-1',
      planDate: new Date('2026-04-26T00:00:00.000Z'),
      recommendedSessions: [],
      recommendedModes: [],
      targetQuestionsCount: 20,
      targetSystemFocus: [],
      estimatedTimeMinutes: 30,
      status: 'active',
      actualQuestionsAnswered: 0,
      completedAt: null,
    };
    const prisma = createPrismaMock({
      questionAttempt: { count: vi.fn().mockResolvedValue(12) },
      dailyStudyPlan: {
        findUnique: vi.fn().mockResolvedValue(existingPlan),
        upsert: vi.fn(),
        update: vi.fn(async (args) => ({ ...existingPlan, ...args.data })),
      },
    });

    const plan = await getOrCreateDailyStudyPlan(prisma, 'user-1', existingPlan.planDate);

    expect(prisma.dailyStudyPlan.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan-1' },
      data: expect.objectContaining({ actualQuestionsAnswered: 12, status: 'active' }),
    }));
    expect(plan.actualQuestionsAnswered).toBe(12);
  });

  it('completes, skips, and reschedules individual tasks without dropping task state', async () => {
    const plan = {
      id: 'plan-1',
      status: 'pending',
      targetQuestionsCount: 30,
      actualQuestionsAnswered: 0,
      completedAt: null,
      planDate: new Date('2026-04-26T00:00:00.000Z'),
      recommendedSessions: [
        { id: 'main', kind: 'main', mode: 'core_adaptive', title: 'Main', count: 20, estimatedMinutes: 30, reason: 'Gap', priority: 'high', status: 'pending', route: '/study/main-session', launchParams: {} },
        { id: 'review', kind: 'targeted', mode: 'rapid_recall', title: 'Review', count: 10, estimatedMinutes: 15, reason: 'Due', priority: 'medium', status: 'pending', route: '/modes/rapid-recall', launchParams: {} },
      ],
    };
    const prisma = createPrismaMock();

    await applyDailyStudyPlanAction(prisma, plan, { action: 'complete', taskId: 'main', questionsAnswered: 20 });
    const completeCall = prisma.dailyStudyPlan.update.mock.calls[0]?.[0];
    expect(completeCall.data.actualQuestionsAnswered).toBe(20);
    expect(completeCall.data.recommendedSessions[0].status).toBe('completed');
    expect(completeCall.data.recommendedSessions[1].status).toBe('pending');

    await applyDailyStudyPlanAction(prisma, plan, { action: 'reschedule', taskId: 'review', rescheduleDate: new Date('2026-04-27T00:00:00.000Z') });
    const rescheduleCall = prisma.dailyStudyPlan.update.mock.calls[1]?.[0];
    expect(rescheduleCall.data.recommendedSessions[1].status).toBe('rescheduled');
    expect(rescheduleCall.data.recommendedSessions[1].rescheduledFor).toBe('2026-04-27');
  });

  it('sanitizes malformed persisted task JSON for legacy plans', () => {
    expect(sanitizeStudyPlanTasks(null)).toEqual([]);
    expect(sanitizeStudyPlanTasks([{ id: 'x', count: Number.NaN, kind: 'unknown' }])[0]).toEqual(
      expect.objectContaining({
        id: 'x',
        kind: 'main',
        count: 10,
        status: 'pending',
      })
    );
  });
});
