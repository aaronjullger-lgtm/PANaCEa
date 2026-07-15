/**
 * Error-leak regression for /api/drills/lab-cases.
 * On DB failure the client must receive a GENERIC message — never the raw
 * error string / stack (which could expose schema/connection detail).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, captured } = vi.hoisted(() => ({
  mockPrisma: { labCase: { findMany: vi.fn() } },
  captured: { handlers: [] as any[] },
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn(),
}));
vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));
vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    captured.handlers.push(handler);
    return handler;
  }),
}));

import './lab-cases';

const SECRET_DB_MESSAGE = 'PrismaClientKnownRequestError: connect ECONNREFUSED db-internal:5432';

function ctx(overrides: Record<string, any> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://x' },
    auth: { userId: 'clerk_1' },
    validated: { category: 'random', limit: 20, shuffle: true },
    ...overrides,
  };
}

describe('/api/drills/lab-cases error handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET returns a generic message and never leaks the raw DB error', async () => {
    mockPrisma.labCase.findMany.mockRejectedValue(new Error(SECRET_DB_MESSAGE));
    const getHandler = captured.handlers[0];
    const result = await getHandler(ctx());

    expect(result.status).toBe(500);
    expect(result.data.success).toBe(false);
    expect(result.data.error).toBe('Failed to fetch lab cases. Please try again.');
    expect(JSON.stringify(result.data)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(result.data)).not.toContain('Prisma');
  });

  it('POST returns a generic message and never leaks the raw DB error', async () => {
    mockPrisma.labCase.findMany.mockRejectedValue(new Error(SECRET_DB_MESSAGE));
    const postHandler = captured.handlers[1];
    const result = await postHandler(ctx({ validated: { action: 'getDiagnoses' } }));

    expect(result.status).toBe(500);
    expect(result.data.error).toBe('Request failed. Please try again.');
    expect(JSON.stringify(result.data)).not.toContain('ECONNREFUSED');
  });
});
