import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDailyStudyAllocation = vi.hoisted(() => vi.fn());

vi.mock('./dailyStudyAllocatorService', () => ({
  getDailyStudyAllocation: (...args: unknown[]) => mockGetDailyStudyAllocation(...args),
}));

import {
  applyDailyStudyPlanAction,
  buildStudyPlanTasks,
  ensureStudyPlanTasksLaunchable,
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
      mode: 'targeted',
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

  it('does not infer plan progress from unrelated same-day attempts on refresh', async () => {
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

    expect(prisma.dailyStudyPlan.update).not.toHaveBeenCalled();
    expect(plan.actualQuestionsAnswered).toBe(0);
  });

  it('does not overwrite an existing pending plan that already has launchable tasks', async () => {
    const existingPlan = {
      id: 'plan-accepted',
      userId: 'user-1',
      planDate: new Date('2026-04-26T00:00:00.000Z'),
      recommendedSessions: [
        {
          id: '2026-04-26-study-path-one',
          kind: 'main',
          mode: 'core_adaptive',
          title: 'Accepted study path block',
          count: 15,
          estimatedMinutes: 30,
          reason: 'Accepted from personalized study path.',
          priority: 'medium',
          status: 'pending',
          route: '/study/main-session?source=study-plan&taskId=2026-04-26-study-path-one',
          launchParams: { source: 'study-plan', taskId: '2026-04-26-study-path-one' },
        },
      ],
      recommendedModes: ['core_adaptive'],
      targetQuestionsCount: 15,
      targetSystemFocus: ['Pulmonary'],
      estimatedTimeMinutes: 30,
      status: 'pending',
      actualQuestionsAnswered: 0,
      completedAt: null,
    };
    const prisma = createPrismaMock({
      dailyStudyPlan: {
        findUnique: vi.fn().mockResolvedValue(existingPlan),
        upsert: vi.fn(),
        update: vi.fn(),
      },
    });

    const plan = await getOrCreateDailyStudyPlan(prisma, 'user-1', existingPlan.planDate);

    expect(prisma.dailyStudyPlan.upsert).not.toHaveBeenCalled();
    expect(mockGetDailyStudyAllocation).not.toHaveBeenCalled();
    expect(plan.recommendedSessions[0].title).toBe('Accepted study path block');
  });

  it('repairs stored active plan tasks that no longer have an approved launch pool', async () => {
    const existingPlan = {
      id: 'plan-1',
      userId: 'user-1',
      planDate: new Date('2026-04-26T00:00:00.000Z'),
      recommendedSessions: [
        {
          id: 'review',
          kind: 'targeted',
          mode: 'rapid_recall',
          title: 'Due review block',
          count: 10,
          estimatedMinutes: 15,
          reason: 'Due reviews.',
          priority: 'medium',
          status: 'pending',
          conditionIds: ['mc-1'],
          route: '/study/main-session?mode=condition&conditionId=mc-1',
          launchParams: { mode: 'condition', conditionId: 'mc-1' },
        },
      ],
      recommendedModes: ['rapid_recall'],
      targetQuestionsCount: 10,
      targetSystemFocus: ['Pulmonary'],
      estimatedTimeMinutes: 15,
      status: 'active',
      actualQuestionsAnswered: 0,
      completedAt: null,
    };
    const prisma = createPrismaMock({
      medicalContent: {
        findMany: vi.fn().mockResolvedValue([{ id: 'mc-1', conditionId: 'cond-1', system: 'Pulmonary' }]),
      },
      question: { count: vi.fn().mockResolvedValue(0) },
      preGeneratedQuestion: { count: vi.fn().mockResolvedValue(0) },
      dailyStudyPlan: {
        findUnique: vi.fn().mockResolvedValue(existingPlan),
        upsert: vi.fn(),
        update: vi.fn(async (args) => ({ ...existingPlan, ...args.data })),
      },
    });

    const plan = await getOrCreateDailyStudyPlan(prisma, 'user-1', existingPlan.planDate);

    expect(prisma.dailyStudyPlan.update).toHaveBeenCalledOnce();
    expect(plan.recommendedSessions[0]).toEqual(
      expect.objectContaining({
        kind: 'main',
        mode: 'core_adaptive',
        conditionIds: undefined,
        route: expect.stringContaining('mode=adaptive'),
      })
    );
    expect(plan.recommendedModes).toEqual(['core_adaptive']);
  });

  it('canonicalizes stale study-plan launch params during task sanitization', () => {
    const [task] = sanitizeStudyPlanTasks([
      {
        id: '2026-04-26-targeted-review',
        kind: 'targeted',
        mode: 'rapid_recall',
        title: 'Due review block',
        count: 10,
        estimatedMinutes: 15,
        reason: 'Due reviews.',
        priority: 'medium',
        status: 'pending',
        conditionIds: ['mc-1'],
        launchParams: {
          source: 'study-plan',
          taskId: '2026-04-26-targeted-review',
          mode: 'rapid_recall',
          conditionId: 'legacy-cond',
        },
      },
    ]);

    expect(task?.launchParams).toEqual(
      expect.objectContaining({
        source: 'study-plan',
        taskId: '2026-04-26-targeted-review',
        mode: 'condition',
        conditions: 'mc-1',
        conditionId: 'mc-1',
      })
    );
    expect(task?.mode).toBe('targeted');
    expect(task?.route).toContain('mode=condition');
    expect(task?.route).not.toContain('mode=rapid_recall');
    expect(task?.route).not.toContain('legacy-cond');
  });

  it('routes system-only targeted tasks as system work instead of under-specified condition work', () => {
    const [task] = sanitizeStudyPlanTasks([
      {
        id: '2026-04-26-targeted-system',
        kind: 'targeted',
        mode: 'rapid_recall',
        title: 'Pulmonary repair',
        count: 12,
        estimatedMinutes: 20,
        reason: 'Targeted system review.',
        priority: 'medium',
        status: 'pending',
        systemFilter: ['Pulmonary'],
        launchParams: {
          source: 'study-plan',
          taskId: '2026-04-26-targeted-system',
          mode: 'rapid_recall',
        },
      },
    ]);

    expect(task?.mode).toBe('targeted');
    expect(task?.launchParams).toEqual(
      expect.objectContaining({
        source: 'study-plan',
        taskId: '2026-04-26-targeted-system',
        mode: 'system',
        systems: 'Pulmonary',
      })
    );
    expect(task?.route).toContain('mode=system');
    expect(task?.route).not.toContain('mode=condition');
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

    await applyDailyStudyPlanAction(prisma, plan, {
      action: 'complete',
      taskId: 'main',
      questionsAnswered: 20,
      accuracy: 0.75,
      durationMinutes: 28,
      linkedSessionId: 'study-session-123',
    });
    const completeCall = prisma.dailyStudyPlan.update.mock.calls[0]?.[0];
    expect(completeCall.data.actualQuestionsAnswered).toBe(20);
    expect(completeCall.data.actualAccuracy).toBe(0.75);
    expect(completeCall.data.actualDurationMinutes).toBe(28);
    expect(completeCall.data.recommendedSessions[0].status).toBe('completed');
    expect(completeCall.data.recommendedSessions[0].linkedSessionId).toBe('study-session-123');
    expect(completeCall.data.recommendedSessions[0].actualQuestionsAnswered).toBe(20);
    expect(completeCall.data.recommendedSessions[0].actualAccuracy).toBe(0.75);
    expect(completeCall.data.recommendedSessions[0].actualDurationMinutes).toBe(28);
    expect(completeCall.data.recommendedSessions[1].status).toBe('pending');

    await applyDailyStudyPlanAction(prisma, {
      ...plan,
      actualQuestionsAnswered: 20,
      recommendedSessions: completeCall.data.recommendedSessions,
    }, {
      action: 'complete',
      taskId: 'main',
      questionsAnswered: 20,
      accuracy: 0.75,
      durationMinutes: 28,
      linkedSessionId: 'study-session-123',
    });
    const repeatedCompleteCall = prisma.dailyStudyPlan.update.mock.calls[1]?.[0];
    expect(repeatedCompleteCall.data.actualQuestionsAnswered).toBe(20);

    await applyDailyStudyPlanAction(prisma, plan, { action: 'reschedule', taskId: 'review', rescheduleDate: new Date('2026-04-27T00:00:00.000Z') });
    const rescheduleCall = prisma.dailyStudyPlan.update.mock.calls[2]?.[0];
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

  it('degrades targeted tasks to adaptive work when no approved condition question pool exists', async () => {
    const prisma = createPrismaMock({
      medicalContent: {
        findMany: vi.fn().mockResolvedValue([{ id: 'mc-1', conditionId: 'cond-1', system: 'Pulmonary' }]),
      },
      question: { count: vi.fn().mockResolvedValue(0) },
      preGeneratedQuestion: { count: vi.fn().mockResolvedValue(0) },
    });
    const tasks = buildStudyPlanTasks({
      allocation: allocation({
        recommendedMainCount: 0,
        recommendedTargetedCount: 10,
        targetedConditions: ['mc-1'],
      }),
      planDate: new Date('2026-04-26T12:00:00.000Z'),
      dailyGoal: 10,
      sessionLength: 15,
      daysToExam: null,
    });

    const launchable = await ensureStudyPlanTasksLaunchable(prisma, tasks);

    expect(launchable[0]).toEqual(
      expect.objectContaining({
        kind: 'main',
        mode: 'core_adaptive',
        conditionIds: undefined,
        route: expect.stringContaining('mode=adaptive'),
      })
    );
    expect(prisma.question.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { conditionId: { in: ['cond-1'] } },
            { medicalContentId: { in: ['mc-1'] } },
          ]),
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('keeps targeted tasks when an approved condition question pool exists', async () => {
    const prisma = createPrismaMock({
      medicalContent: {
        findMany: vi.fn().mockResolvedValue([{ id: 'mc-1', conditionId: 'cond-1', system: 'Pulmonary' }]),
      },
      question: { count: vi.fn().mockResolvedValue(0) },
      preGeneratedQuestion: { count: vi.fn().mockResolvedValue(2) },
    });
    const tasks = buildStudyPlanTasks({
      allocation: allocation({
        recommendedMainCount: 0,
        recommendedTargetedCount: 10,
        targetedConditions: ['mc-1'],
      }),
      planDate: new Date('2026-04-26T12:00:00.000Z'),
      dailyGoal: 10,
      sessionLength: 15,
      daysToExam: null,
    });

    const launchable = await ensureStudyPlanTasksLaunchable(prisma, tasks);

    expect(launchable[0]).toEqual(
      expect.objectContaining({
        kind: 'targeted',
        mode: 'targeted',
        conditionIds: ['mc-1'],
        route: expect.stringContaining('conditionId=mc-1'),
      })
    );
  });

  it('does not rewrite completed task history during launchability repair', async () => {
    const prisma = createPrismaMock({
      medicalContent: {
        findMany: vi.fn().mockResolvedValue([{ id: 'mc-1', conditionId: 'cond-1', system: 'Pulmonary' }]),
      },
      question: { count: vi.fn().mockResolvedValue(0) },
      preGeneratedQuestion: { count: vi.fn().mockResolvedValue(0) },
    });
    const tasks = [
      {
        id: 'review',
        kind: 'targeted' as const,
        mode: 'rapid_recall',
        title: 'Due review block',
        count: 10,
        estimatedMinutes: 15,
        reason: 'Due reviews.',
        priority: 'medium' as const,
        status: 'completed' as const,
        conditionIds: ['mc-1'],
        route: '/study/main-session?mode=condition&conditionId=mc-1',
        launchParams: { mode: 'condition', conditionId: 'mc-1' },
      },
    ];

    await expect(ensureStudyPlanTasksLaunchable(prisma, tasks)).resolves.toEqual(tasks);
    expect(prisma.question.count).not.toHaveBeenCalled();
    expect(prisma.preGeneratedQuestion.count).not.toHaveBeenCalled();
  });
});
