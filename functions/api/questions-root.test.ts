import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
  options: null as Record<string, unknown> | null,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockPrisma: any = {
  question: {
    findMany: vi.fn(),
  },
};

vi.mock('./_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any, options?: Record<string, unknown>) => {
    _capture.handler = handler;
    _capture.options = options ?? null;
    return handler;
  }),
}));

vi.mock('./_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

import './questions';

describe('GET /api/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.question.findMany.mockResolvedValue([]);
  });

  it('validates query params and applies production question safety filters', async () => {
    const result = await _capture.handler!({
      env: { DATABASE_URL: 'postgresql://test' },
      auth: { userId: 'clerk_user_1' },
      validated: { category: 'physiology', limit: 20 },
    });

    expect(_capture.options).toMatchObject({ source: 'query' });
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tags: { array_contains: 'physiology' },
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(result.data.questions).toEqual([]);
  });
});
