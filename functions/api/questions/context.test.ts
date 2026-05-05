import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveOrCreateUserRecord = vi.hoisted(() => vi.fn());

const mockPrisma: any = {
  question: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  reviewLog: {
    findMany: vi.fn(),
  },
  condition: {
    findMany: vi.fn(),
  },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result.data ?? result), {
      status: result.status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: (...args: unknown[]) => mockResolveOrCreateUserRecord(...args),
}));

import { onRequestGet } from './context';

function makeContext(questionId = 'q-approved-1') {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: 'clerk-user-1' },
    params: { questionId },
    validated: { params: { questionId } },
  };
}

async function callEndpoint(context = makeContext()): Promise<{ status: number; body: any }> {
  const response = (await (onRequestGet as any)(context)) as Response;
  return { status: response.status, body: await response.json() };
}

describe('GET /api/questions/:questionId/context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserRecord.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.question.findFirst.mockResolvedValue({
      id: 'q-approved-1',
      system: 'Pulmonary',
      conditionId: 'cond-1',
      Condition: {
        id: 'cond-1',
        name: 'pulmonary_embolism',
        displayName: 'Pulmonary embolism',
        system: 'Pulmonary',
        content: { overview: 'PE content' },
        relatedSystems: ['Cardiovascular'],
      },
    });
    mockPrisma.reviewLog.findMany
      .mockResolvedValueOnce([
        { wasCorrect: true, grade: 3, reviewedAt: new Date('2026-05-01T12:00:00Z') },
        { wasCorrect: false, grade: 1, reviewedAt: new Date('2026-05-02T12:00:00Z') },
      ])
      .mockResolvedValueOnce([{ conditionId: 'cond-2', wasCorrect: true, grade: 3 }]);
    mockPrisma.question.count.mockResolvedValueOnce(12).mockResolvedValueOnce(24);
    mockPrisma.condition.findMany.mockResolvedValue([
      {
        id: 'cond-2',
        name: 'pneumonia',
        displayName: 'Pneumonia',
        _count: { Question: 5 },
      },
    ]);
  });

  it('uses production question safety and internal user IDs for performance context', async () => {
    const { status, body } = await callEndpoint();

    expect(status).toBe(200);
    expect(body.questionId).toBe('q-approved-1');
    expect(body.performance.onCondition).toEqual(
      expect.objectContaining({
        totalAttempts: 2,
        correctCount: 1,
        accuracy: '0.50',
      })
    );
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-approved-1',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockPrisma.reviewLog.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-db-1',
          conditionId: 'cond-1',
        }),
      })
    );
    expect(mockPrisma.reviewLog.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-db-1',
          conditionId: { in: ['cond-2'] },
        }),
      })
    );
  });

  it('fails closed for draft or unapproved question context requests', async () => {
    mockPrisma.question.findFirst.mockResolvedValue(null);

    const { status, body } = await callEndpoint(makeContext('draft-question'));

    expect(status).toBe(404);
    expect(body.error).toBe('Question not found');
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'draft-question',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockPrisma.reviewLog.findMany).not.toHaveBeenCalled();
  });
});
