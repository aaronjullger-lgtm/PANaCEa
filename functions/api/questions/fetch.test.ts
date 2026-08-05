import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDisconnect,
  mockResolveUser,
  mockSeenFindMany,
  mockQuestionFindMany,
  mockQuestionUpdateMany,
  capturedHandlers,
} = vi.hoisted(() => {
  const capturedHandlers: Record<string, ((ctx: any) => Promise<any>) | null> = {
    post: null,
  };
  return {
    mockDisconnect: vi.fn().mockResolvedValue(undefined),
    mockResolveUser: vi.fn(),
    mockSeenFindMany: vi.fn(),
    mockQuestionFindMany: vi.fn(),
    mockQuestionUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
    capturedHandlers,
  };
});

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => ({
    userQuestionSeen: { findMany: mockSeenFindMany },
    preGeneratedQuestion: {
      findMany: mockQuestionFindMany,
      updateMany: mockQuestionUpdateMany,
    },
  }),
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) => {
    capturedHandlers.post = handler;
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

vi.mock('../_shared/resolveUser', () => ({
  resolveUserByClerkId: (...args: unknown[]) => mockResolveUser(...args),
}));

vi.mock('../../../lib/services/questionServingSafety', () => ({
  withProductionPregeneratedSafety: () => ({}),
}));

import './fetch';

function makeContext(validated: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated,
    waitUntil: vi.fn(),
  };
}

describe('/api/questions/fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vitest.config.ts mockReset:true wipes hoisted implementations each test.
    mockDisconnect.mockResolvedValue(undefined);
    mockResolveUser.mockResolvedValue({ id: 'user-db-1' });
    mockQuestionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('excludes seen questions and applies filters', async () => {
    mockSeenFindMany.mockResolvedValue([
      { questionId: 'q1' },
      { questionId: 'q2' },
      { questionId: 'q3' },
    ]);
    mockQuestionFindMany.mockResolvedValue([{ id: 'q4' }, { id: 'q5' }]);

    const result = await capturedHandlers.post!(
      makeContext({ system: 'CV', questionType: 'RECALL', limit: 5 })
    );

    expect(mockResolveUser).toHaveBeenCalledWith(expect.anything(), 'clerk_user_123');

    // Seen-history query bounded (perf fix: never fetch unbounded seen rows).
    expect(mockSeenFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-db-1', questionType: 'RECALL' },
        take: 5000,
        orderBy: { lastSeenAt: 'desc' },
      })
    );

    // Question query excludes seen ids via notIn and threads the system filter.
    expect(mockQuestionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { notIn: ['q1', 'q2', 'q3'] },
          system: 'CV',
          questionType: 'RECALL',
        },
        take: 5,
      })
    );

    expect(result.data).toEqual({
      success: true,
      questions: [{ id: 'q4' }, { id: 'q5' }],
      source: 'database',
      count: 2,
      needsGeneration: true,
      generationNeeded: 3,
    });
  });

  it('increments timesServed fire-and-forget via waitUntil', async () => {
    mockSeenFindMany.mockResolvedValue([]);
    mockQuestionFindMany.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }]);

    const ctx = makeContext({ limit: 2 });
    await capturedHandlers.post!(ctx);

    expect(mockQuestionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['q1', 'q2'] } },
      data: { timesServed: { increment: 1 } },
    });
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('defaults limit to 10 when omitted', async () => {
    mockSeenFindMany.mockResolvedValue([]);
    mockQuestionFindMany.mockResolvedValue([]);

    await capturedHandlers.post!(makeContext());

    expect(mockQuestionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('returns 404 when Clerk user has no synced user record', async () => {
    mockResolveUser.mockResolvedValue(null);

    const result = await capturedHandlers.post!(makeContext());

    expect(result.status).toBe(404);
    expect(result.error).toBe('User not found');
    expect(mockSeenFindMany).not.toHaveBeenCalled();
  });
});
