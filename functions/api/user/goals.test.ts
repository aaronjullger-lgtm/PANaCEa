import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserGoalFindMany,
  mockUserGoalCount,
  mockUserGoalCreate,
  mockUserGoalFindFirst,
  mockUserGoalUpdate,
  mockUserGoalDeleteMany,
  mockDisconnect,
  mockResolveOrCreateUserRecord,
  rootHandlers,
  itemHandlers,
  registerHandler,
} = vi.hoisted(() => {
  const rootHandlers: {
    get: ((ctx: any) => Promise<any>) | null;
    post: ((ctx: any) => Promise<any>) | null;
    patch: ((ctx: any) => Promise<any>) | null;
    delete: ((ctx: any) => Promise<any>) | null;
    index: number;
  } = { get: null, post: null, patch: null, delete: null, index: 0 };
  const itemHandlers: {
    patch: ((ctx: any) => Promise<any>) | null;
    delete: ((ctx: any) => Promise<any>) | null;
    index: number;
  } = { patch: null, delete: null, index: 0 };

  return {
    mockUserGoalFindMany: vi.fn(),
    mockUserGoalCount: vi.fn(),
    mockUserGoalCreate: vi.fn(),
    mockUserGoalFindFirst: vi.fn(),
    mockUserGoalUpdate: vi.fn(),
    mockUserGoalDeleteMany: vi.fn(),
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    mockResolveOrCreateUserRecord: vi.fn(),
    rootHandlers,
    itemHandlers,
    registerHandler: (handler: (ctx: any) => Promise<any>) => {
      if (rootHandlers.index === 0) rootHandlers.get = handler;
      else if (rootHandlers.index === 1) rootHandlers.post = handler;
      else if (rootHandlers.index === 2) rootHandlers.patch = handler;
      else if (rootHandlers.index === 3) rootHandlers.delete = handler;
      else if (itemHandlers.index === 0) {
        itemHandlers.patch = handler;
        itemHandlers.index += 1;
      } else {
        itemHandlers.delete = handler;
        itemHandlers.index += 1;
      }
      rootHandlers.index += 1;
      return handler;
    },
  };
});

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    userGoal: {
      findMany: mockUserGoalFindMany,
      count: mockUserGoalCount,
      create: mockUserGoalCreate,
      findFirst: mockUserGoalFindFirst,
      update: mockUserGoalUpdate,
      deleteMany: mockUserGoalDeleteMany,
    },
  }),
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: (...args: unknown[]) => mockResolveOrCreateUserRecord(...args),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: () => ({
    addContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) =>
    registerHandler(handler),
}));

import './goals';
import './goals/[goalId]';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'prisma://test', CLERK_SECRET_KEY: 'sk_test_x' },
    auth: { userId: 'clerk_user_123' },
    request: new Request('https://example.test/api/user/goals/goal-1'),
    params: { goalId: 'goal-1' },
    validated: {},
    ...overrides,
  };
}

function makeGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-1',
    userId: 'user-db-1',
    title: 'Daily questions',
    description: null,
    goalType: 'daily',
    targetValue: 10,
    targetUnit: 'questions',
    targetDate: null,
    targetSystem: null,
    targetStability: null,
    currentValue: 0,
    progressPercentage: 0,
    status: 'active',
    isRecurring: false,
    currentStreak: 0,
    bestStreak: 0,
    lastMetDate: null,
    motivationNotes: null,
    rewardMessage: null,
    completedAt: null,
    ...overrides,
  };
}

describe('/api/user/goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserRecord.mockResolvedValue({ id: 'user-db-1' });
  });

  it('lists goals using internal User.id, not Clerk subject', async () => {
    mockUserGoalFindMany.mockResolvedValue([makeGoal()]);

    const result = await rootHandlers.get!(
      makeContext({ validated: { status: 'active', goalType: 'daily', limit: 20 } })
    );

    expect(mockResolveOrCreateUserRecord).toHaveBeenCalledWith(
      expect.any(Object),
      'clerk_user_123',
      { id: true }
    );
    expect(mockUserGoalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-db-1', status: 'active', goalType: 'daily' },
      })
    );
    expect(result.data.goals).toHaveLength(1);
  });

  it('creates a goal using internal User.id', async () => {
    const created = makeGoal();
    mockUserGoalCount.mockResolvedValue(0);
    mockUserGoalCreate.mockResolvedValue(created);

    const result = await rootHandlers.post!(
      makeContext({
        validated: {
          body: {
            title: 'Daily questions',
            goalType: 'daily',
            targetValue: 10,
            targetUnit: 'questions',
          },
        },
      })
    );

    expect(mockUserGoalCount).toHaveBeenCalledWith({ where: { userId: 'user-db-1' } });
    expect(mockUserGoalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-db-1', title: 'Daily questions' }),
      })
    );
    expect(result.status).toBe(201);
    expect(result.data.goal).toEqual(created);
  });

  it('updates only a goal owned by the internal user', async () => {
    mockUserGoalFindFirst.mockResolvedValue(makeGoal({ currentValue: 4 }));
    mockUserGoalUpdate.mockResolvedValue(makeGoal({ currentValue: 7, progressPercentage: 70 }));

    const result = await itemHandlers.patch!(
      makeContext({ validated: { body: { currentValue: 7 } } })
    );

    expect(mockUserGoalFindFirst).toHaveBeenCalledWith({
      where: { id: 'goal-1', userId: 'user-db-1' },
    });
    expect(mockUserGoalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'goal-1' },
        data: expect.objectContaining({ currentValue: 7, progressPercentage: 70 }),
      })
    );
    expect(result.data.goal.currentValue).toBe(7);
  });

  it('does not update a goal owned by another user', async () => {
    mockUserGoalFindFirst.mockResolvedValue(null);

    const result = await itemHandlers.patch!(
      makeContext({ validated: { body: { currentValue: 7 } } })
    );

    expect(result.status).toBe(404);
    expect(mockUserGoalUpdate).not.toHaveBeenCalled();
  });

  it('deletes only a goal owned by the internal user', async () => {
    mockUserGoalDeleteMany.mockResolvedValue({ count: 1 });

    const result = await itemHandlers.delete!(makeContext());

    expect(mockUserGoalDeleteMany).toHaveBeenCalledWith({
      where: { id: 'goal-1', userId: 'user-db-1' },
    });
    expect(result.data.success).toBe(true);
  });
});
