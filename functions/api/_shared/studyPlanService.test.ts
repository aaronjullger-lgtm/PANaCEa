import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/optimizer/performanceGapAnalyzer', () => ({
  analyzePerformanceGaps: vi.fn(),
}));

vi.mock('@/services/optimizer/retentionAwareScheduler', () => ({
  scheduleReviews: vi.fn(),
}));

vi.mock('@/services/optimizer/blueprintBalancedSelector', () => ({
  balanceBlueprintPriorities: vi.fn(),
}));

vi.mock('@/services/optimizer/pathGenerator', () => ({
  generateStudyPlan: vi.fn(),
}));

vi.mock('@/lib/services/dailyStudyAllocatorService', () => ({
  getDailyStudyAllocation: vi.fn(),
}));

import { ensureStudyPlanWindow, updateStudyPlanProgress } from './studyPlanService';
import { getDailyStudyAllocation } from '@/lib/services/dailyStudyAllocatorService';

function makePersistedPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'day-1',
    userId: 'user-1',
    planDate: new Date('2026-05-03T00:00:00.000Z'),
    recommendedSessions: [
      {
        id: 'accepted-task',
        kind: 'main',
        status: 'pending',
        title: 'Accepted study path block',
        description: 'Accepted block',
        reason: 'Accepted from study path.',
        systems: ['Pulmonary'],
        conditionIds: [],
        estimatedMinutes: 30,
        targetQuestions: 15,
        launchSettings: {
          mode: 'core_adaptive',
          focus: 'all',
          count: 15,
          questionCount: 15,
          systems: ['Pulmonary'],
        },
        route: '/study/main-session?source=study-plan&taskId=accepted-task',
      },
    ],
    recommendedModes: ['core_adaptive'],
    targetQuestionsCount: 15,
    targetSystemFocus: ['Pulmonary'],
    estimatedTimeMinutes: 30,
    status: 'pending',
    actualQuestionsAnswered: 0,
    actualDurationMinutes: null,
    actualAccuracy: null,
    completedAt: null,
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    updatedAt: new Date('2026-05-02T12:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma(existingRows: any[]) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        examDate: null,
        currentRotation: null,
        rotationExamDate: null,
        eorTestDate: null,
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    },
    userPreferences: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userGoal: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    dailyStudyPlan: {
      findMany: vi.fn().mockResolvedValue(existingRows),
      upsert: vi.fn(),
    },
    reviewLog: {
      findFirst: vi.fn(),
    },
  };
}

describe('ensureStudyPlanWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns persisted accepted plan rows even when the learner has no active target', async () => {
    const prisma = makePrisma([makePersistedPlan()]);

    const result = await ensureStudyPlanWindow(prisma, 'user-1', {
      startDate: new Date('2026-05-03T15:00:00.000Z'),
      days: 1,
    });

    expect(result.state).toBe('ready');
    expect(result.target.kind).toBe('none');
    expect(result.days).toHaveLength(1);
    expect(result.today?.tasks[0]?.id).toBe('accepted-task');
    expect(result.overview.totalTargetQuestions).toBe(15);
    expect(prisma.dailyStudyPlan.upsert).not.toHaveBeenCalled();
    expect(getDailyStudyAllocation).not.toHaveBeenCalled();
  });

  it('canonicalizes stale persisted targeted task modes in current study-plan output', async () => {
    const prisma = makePrisma([
      makePersistedPlan({
        recommendedSessions: [
          {
            id: 'stale-targeted',
            kind: 'targeted',
            status: 'pending',
            title: 'Due review block',
            description: 'Legacy task',
            reason: 'Legacy retained task.',
            systems: ['Pulmonary'],
            conditionIds: ['mc-pe'],
            estimatedMinutes: 20,
            targetQuestions: 8,
            mode: 'rapid_recall',
            launchSettings: {
              mode: 'rapid_recall',
              focus: 'due',
              count: 8,
              questionCount: 8,
              systems: ['Pulmonary'],
            },
            route: '/modes/rapid-recall',
          },
        ],
        recommendedModes: ['rapid_recall'],
      }),
    ]);

    const result = await ensureStudyPlanWindow(prisma, 'user-1', {
      startDate: new Date('2026-05-03T15:00:00.000Z'),
      days: 1,
    });

    const task = result.today?.tasks[0] as any;
    expect(task).toEqual(
      expect.objectContaining({
        id: 'stale-targeted',
        mode: 'targeted',
        route: expect.stringContaining('/study/main-session?'),
      })
    );
    expect(task.route).toContain('mode=condition');
    expect(task.route).toContain('conditionId=mc-pe');
    expect(task.launchSettings).toEqual(
      expect.objectContaining({
        mode: 'targeted',
        focus: 'topic',
        conditionId: 'mc-pe',
      })
    );
    expect(task.route).not.toContain('/modes/rapid-recall');
  });

  it('routes single-system persisted tasks as system-scoped study sessions', async () => {
    const prisma = makePrisma([
      makePersistedPlan({
        recommendedSessions: [
          {
            id: 'system-task',
            kind: 'main',
            status: 'pending',
            title: 'Pulmonary readiness',
            description: 'System scoped work',
            reason: 'Focus area from the accepted plan.',
            systems: ['Pulmonary'],
            conditionIds: [],
            estimatedMinutes: 25,
            targetQuestions: 12,
            launchSettings: {
              mode: 'core_adaptive',
              focus: 'all',
              count: 12,
              questionCount: 12,
              systems: ['Pulmonary'],
            },
            route: '/study/main-session?source=study-plan&taskId=system-task&mode=adaptive',
          },
        ],
      }),
    ]);

    const result = await ensureStudyPlanWindow(prisma, 'user-1', {
      startDate: new Date('2026-05-03T15:00:00.000Z'),
      days: 1,
    });

    const task = result.today?.tasks[0];
    expect(task?.route).toContain('/study/main-session?');
    expect(task?.route).toContain('mode=system');
    expect(task?.route).toContain('systems=Pulmonary');
  });

  it('still asks for a target when no persisted rows exist', async () => {
    const prisma = makePrisma([]);

    const result = await ensureStudyPlanWindow(prisma, 'user-1', {
      startDate: new Date('2026-05-03T15:00:00.000Z'),
      days: 1,
    });

    expect(result.state).toBe('needs-target');
    expect(result.days).toEqual([]);
    expect(result.today).toBeNull();
    expect(prisma.dailyStudyPlan.upsert).not.toHaveBeenCalled();
  });
});

describe('updateStudyPlanProgress', () => {
  it('preserves task launch metadata while marking completion', async () => {
    const row = makePersistedPlan({
      recommendedSessions: [
        {
          id: 'task-1',
          kind: 'targeted',
          status: 'in_progress',
          title: 'Pulmonary repair',
          description: 'Targeted work',
          reason: 'Plan reason',
          systems: ['Pulmonary'],
          conditionIds: ['mc-pe'],
          estimatedMinutes: 20,
          targetQuestions: 8,
          mode: 'condition',
          count: 8,
          priority: 'high',
          systemFilter: ['Pulmonary'],
          launchParams: { mode: 'condition', conditionId: 'mc-pe' },
          linkedAttemptIds: ['attempt-1'],
          launchSettings: {
            mode: 'targeted',
            focus: 'topic',
            count: 8,
            questionCount: 8,
            conditionId: 'mc-pe',
          },
          route: '/study/main-session?source=study-plan&taskId=task-1',
        },
      ],
    });
    const prisma = {
      dailyStudyPlan: {
        findUnique: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockImplementation(async (args) => ({ ...row, ...args.data })),
      },
    };

    await updateStudyPlanProgress(prisma, 'user-1', {
      action: 'complete',
      planDate: '2026-05-03',
      taskId: 'task-1',
      actualQuestionsAnswered: 3,
      actualAccuracy: 2 / 3,
      actualDurationMinutes: 5,
      linkedSessionId: 'session-1',
    });

    const updatedTasks = prisma.dailyStudyPlan.update.mock.calls[0][0].data.recommendedSessions;
    expect(updatedTasks[0]).toEqual(
      expect.objectContaining({
        id: 'task-1',
        status: 'completed',
        mode: 'targeted',
        count: 8,
        priority: 'high',
        systemFilter: ['Pulmonary'],
        launchParams: { mode: 'condition', conditionId: 'mc-pe' },
        linkedAttemptIds: ['attempt-1'],
        actualQuestionsAnswered: 3,
        linkedSessionId: 'session-1',
      })
    );
  });
});
