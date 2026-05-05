import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDisconnect,
  mockResolveOrCreateUserRecord,
  mockUpdateStudyPlanProgress,
  captured,
} = vi.hoisted(() => ({
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockResolveOrCreateUserRecord: vi.fn(),
  mockUpdateStudyPlanProgress: vi.fn(),
  captured: { post: null as ((ctx: any) => Promise<any>) | null },
}));

const mockPrisma = {
  user: {},
  dailyStudyPlan: {},
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) => {
    captured.post = handler;
    return handler;
  },
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => mockPrisma,
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: (...args: unknown[]) => mockResolveOrCreateUserRecord(...args),
}));

vi.mock('../_shared/studyPlanService', () => ({
  updateStudyPlanProgress: (...args: unknown[]) => mockUpdateStudyPlanProgress(...args),
}));

import './progress';

describe('POST /api/study-plan/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserRecord.mockResolvedValue({ id: 'user-db-1' });
    mockUpdateStudyPlanProgress.mockResolvedValue({
      planDate: '2026-05-01',
      tasks: [],
    });
  });

  it('resolves or creates the internal user before writing task progress', async () => {
    const result = await captured.post!({
      env: { DATABASE_URL: 'postgres://test' },
      auth: { userId: 'clerk-user-1' },
      validated: {
        body: {
          planDate: '2026-05-01',
          taskId: 'task-1',
          action: 'start',
        },
      },
    });

    expect(mockResolveOrCreateUserRecord).toHaveBeenCalledWith(
      mockPrisma,
      'clerk-user-1',
      { id: true }
    );
    expect(mockUpdateStudyPlanProgress).toHaveBeenCalledWith(
      mockPrisma,
      'user-db-1',
      {
        planDate: '2026-05-01',
        taskId: 'task-1',
        action: 'start',
      }
    );
    expect(result.data.planDate).toBe('2026-05-01');
    expect(mockDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
