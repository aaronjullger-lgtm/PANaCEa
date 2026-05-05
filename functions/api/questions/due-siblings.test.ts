import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnsureDueVariant = vi.hoisted(() => vi.fn());

const mockPrisma: any = {
  user: { findUnique: vi.fn() },
  preGeneratedQuestion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  question: { findFirst: vi.fn() },
};

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => async (context: any) => {
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

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../lib/ensureDueVariant', () => ({
  ensureDueVariant: (...args: unknown[]) => mockEnsureDueVariant(...args),
}));

import { onRequestPost } from './due-siblings';

function makeContext() {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      GEMINI_API_KEY: 'gemini-test',
    },
    auth: { userId: 'clerk-user-1' },
    validated: {
      dueItems: [
        {
          conditionId: 'condition-1',
          taskType: 'diagnosis',
          originalQuestionId: 'draft-question-1',
        },
      ],
    },
  };
}

async function callEndpoint(context = makeContext()): Promise<{ status: number; body: any }> {
  const response = (await (onRequestPost as any)(context)) as Response;
  return { status: response.status, body: await response.json() };
}

describe('POST /api/questions/due-siblings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.findFirst.mockResolvedValue(null);
    mockPrisma.question.findFirst.mockResolvedValue(null);
    mockPrisma.preGeneratedQuestion.updateMany.mockResolvedValue({ count: 0 });
    mockEnsureDueVariant.mockResolvedValue(undefined);
  });

  it('does not seed due variant generation from unapproved original questions', async () => {
    const { status, body } = await callEndpoint();

    expect(status).toBe(200);
    expect(body.results[0].question).toBeNull();
    expect(mockPrisma.preGeneratedQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'draft-question-1',
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'draft-question-1',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockEnsureDueVariant).not.toHaveBeenCalled();
  });
});
