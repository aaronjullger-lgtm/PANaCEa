/**
 * Tests for GET /api/srs/due
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

const { mockPrisma, mockSafePrismaDisconnect, captured } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    sRSItem: { findMany: vi.fn() },
  },
  mockSafePrismaDisconnect: vi.fn(),
  captured: { handler: null as any },
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: (...args: any[]) => mockSafePrismaDisconnect(...args),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    captured.handler = handler;
    return handler;
  }),
  withCors: vi.fn(() => vi.fn()),
}));

// Import after mocks
import './due';

// --- Helpers ---

function makeContext(overrides: Record<string, any> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_abc123' },
    validated: { query: { limit: 100 } },
    ...overrides,
  };
}

function makeSRSItem(overrides: Record<string, any> = {}) {
  return {
    id: 'srs-1',
    questionId: 'q-1',
    interval: 1,
    dueDate: new Date('2026-04-01T00:00:00Z'),
    difficulty: 0.5,
    easiness: 2.5,
    repetition: 3,
    fsrsStability: 10,
    fsrsDifficulty: 0.4,
    fsrsState: 'REVIEW',
    ...overrides,
  };
}

// --- Tests ---

describe('GET /api/srs/due', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a placeholder user when the row is missing', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-1' });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([]);

    const result = await captured.handler(makeContext());

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(result.data.items).toEqual([]);
    expect(result.data.totalDue).toBe(0);
  });

  it('returns due items with overdueDays calculated correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // Item due 6 days ago (April 1 -> April 7)
    const item = makeSRSItem({ dueDate: new Date('2026-04-01T12:00:00Z') });
    mockPrisma.sRSItem.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].overdueDays).toBe(6);
    expect(result.data.totalDue).toBe(1);
    expect(result.data.timestamp).toBe('2026-04-07T12:00:00.000Z');
  });

  it('filters out items with null dueDate', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([
      makeSRSItem({ id: 'srs-1', dueDate: new Date('2026-04-01T00:00:00Z') }),
      makeSRSItem({ id: 'srs-2', dueDate: null }),
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].id).toBe('srs-1');
    expect(result.data.totalDue).toBe(1);
  });

  it('calculates priority as overdueDays * difficulty', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // 6 days overdue, difficulty 0.8
    const item = makeSRSItem({
      dueDate: new Date('2026-04-01T12:00:00Z'),
      difficulty: 0.8,
    });
    mockPrisma.sRSItem.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items[0].priority).toBeCloseTo(6 * 0.8, 5);
  });

  it('uses default difficulty 0.3 when difficulty is null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // 6 days overdue, null difficulty
    const item = makeSRSItem({
      dueDate: new Date('2026-04-01T12:00:00Z'),
      difficulty: null,
    });
    mockPrisma.sRSItem.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items[0].priority).toBeCloseTo(6 * 0.3, 5);
  });

  it('uses default limit of 100 when not specified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([]);

    await captured.handler(makeContext({ validated: { query: {} } }));

    expect(mockPrisma.sRSItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('respects the limit query parameter', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([]);

    await captured.handler(makeContext({ validated: { query: { limit: 50 } } }));

    expect(mockPrisma.sRSItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('overdueDays is floored at 0 for items due in the past but same day', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // Due 6 hours ago — less than 1 full day
    const item = makeSRSItem({
      dueDate: new Date('2026-04-07T06:00:00Z'),
    });
    mockPrisma.sRSItem.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items[0].overdueDays).toBe(0);
  });

  it('returns empty array on Prisma error (resilient fallback)', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Connection refused'));

    const result = await captured.handler(makeContext());

    expect(result.data.items).toEqual([]);
    expect(result.data.totalDue).toBe(0);
    expect(result.data.error).toBe('Unable to load due items. Please try again.');
    expect(result.data.timestamp).toBeDefined();
    // Should NOT have a status: 500
    expect(result.status).toBeUndefined();
  });

  it('always calls safePrismaDisconnect on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([]);

    await captured.handler(makeContext());

    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('always calls safePrismaDisconnect on error', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('fail'));

    await captured.handler(makeContext());

    expect(mockSafePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('queries with correct where clause and ordering', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.sRSItem.findMany.mockResolvedValue([]);

    await captured.handler(makeContext());

    const call = mockPrisma.sRSItem.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe('user-1');
    expect(call.where.dueDate.lte).toBeInstanceOf(Date);
    expect(call.orderBy).toEqual([
      { dueDate: 'asc' },
      { difficulty: 'desc' },
    ]);
  });
});
