/**
 * Tests for GET /api/srs/due
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks (vi.hoisted so they're available in vi.mock factories) ---

const { mockPrisma, mockSafePrismaDisconnect, captured } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    card: { findMany: vi.fn() },
    userTopicProgress: { findMany: vi.fn() },
    userProgress: { findMany: vi.fn() },
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
    validated: { limit: 100 },
    ...overrides,
  };
}

function makeTopicProgress(overrides: Record<string, any> = {}) {
  return {
    id: 'topic-1',
    conditionId: 'condition-1',
    taskType: 'diagnosis',
    progressContext: 'TARGETED',
    stability: 10,
    difficulty: 6,
    state: 2,
    nextReviewDate: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

function makeUserProgress(overrides: Record<string, any> = {}) {
  return {
    id: 'progress-1',
    conditionId: 'condition-2',
    progressContext: 'READINESS',
    fsrsStability: 12,
    fsrsDifficulty: 0.4,
    fsrsState: 2,
    nextReviewAt: new Date('2026-04-02T00:00:00Z'),
    ...overrides,
  };
}

function makeCardProgress(overrides: Record<string, any> = {}) {
  return {
    id: 'card-1',
    questionId: 'question-1',
    questionIdentityId: 'identity-question-1',
    progressContext: 'READINESS',
    due: new Date('2026-04-01T00:00:00Z'),
    stability: 14,
    difficulty: 7,
    state: 2,
    Question: {
      conditionId: 'condition-3',
      medicalContentId: 'medical-content-3',
      system: 'Cardiovascular',
      taskType: 'diagnosis',
      lifecycleStatus: 'ACTIVE',
      qaStatus: 'APPROVED',
    },
    ...overrides,
  };
}

// --- Tests ---

describe('GET /api/srs/due', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'));
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a placeholder user when the row is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-1' });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1' });

    const result = await captured.handler(makeContext());

    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(result.data.items).toEqual([]);
    expect(result.data.totalDue).toBe(0);
  });

  it('returns due items with overdueDays calculated correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // Item due 6 days ago (April 1 -> April 7)
    const item = makeTopicProgress({ nextReviewDate: new Date('2026-04-01T12:00:00Z') });
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].overdueDays).toBe(6);
    expect(result.data.items[0].source).toBe('user_topic_progress');
    expect(result.data.items[0].questionId).toBeNull();
    expect(result.data.totalDue).toBe(1);
    expect(result.data.timestamp).toBe('2026-04-07T12:00:00.000Z');
    expect(result.data.source).toBe('canonical_fsrs_progress');
  });

  it('filters out items with null due dates', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      makeTopicProgress({ id: 'topic-1', nextReviewDate: new Date('2026-04-01T00:00:00Z') }),
      makeTopicProgress({ id: 'topic-2', nextReviewDate: null }),
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0].id).toBe('topic-1');
    expect(result.data.totalDue).toBe(1);
  });

  it('calculates priority as overdueDays * normalized difficulty', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // 6 days overdue, FSRS difficulty 8/10.
    const item = makeTopicProgress({
      nextReviewDate: new Date('2026-04-01T12:00:00Z'),
      difficulty: 8,
    });
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items[0].priority).toBeCloseTo(6 * 0.8, 5);
  });

  it('uses default difficulty 0.3 when difficulty is null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // 6 days overdue, null difficulty
    const item = makeUserProgress({
      nextReviewAt: new Date('2026-04-01T12:00:00Z'),
      fsrsDifficulty: null,
    });
    mockPrisma.userProgress.findMany.mockResolvedValue([item]);

    const result = await captured.handler(makeContext());

    expect(result.data.items[0].priority).toBeCloseTo(6 * 0.3, 5);
    expect(result.data.items[0].source).toBe('user_progress');
  });

  it('uses default limit of 100 when not specified', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await captured.handler(makeContext({ validated: { limit: 100 } }));

    expect(mockPrisma.userTopicProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('respects the limit query parameter', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await captured.handler(makeContext({ validated: { limit: 50 } }));

    expect(mockPrisma.userTopicProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('can filter all canonical due stores by progress context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await captured.handler(makeContext({ validated: { limit: 25, progressContext: 'TARGETED' } }));

    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          progressContext: 'TARGETED',
        }),
        take: 25,
      })
    );
    expect(mockPrisma.userTopicProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          progressContext: 'TARGETED',
        }),
        take: 25,
      })
    );
    expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          progressContext: 'TARGETED',
        }),
        take: 25,
      })
    );
  });

  it('suppresses broader due rows when a more specific card or topic covers the same condition/context', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.card.findMany.mockResolvedValue([
      makeCardProgress({
        id: 'card-1',
        questionId: 'question-1',
        progressContext: 'TARGETED',
        due: new Date('2026-04-01T12:00:00Z'),
        Question: {
          conditionId: 'condition-1',
          medicalContentId: 'condition-1',
          system: 'Cardiovascular',
          taskType: 'diagnosis',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        },
      }),
    ]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([
      makeTopicProgress({
        id: 'topic-duplicate',
        conditionId: 'condition-1',
        taskType: 'diagnosis',
        progressContext: 'TARGETED',
      }),
      makeTopicProgress({
        id: 'topic-kept',
        conditionId: 'condition-2',
        taskType: 'treatment',
        progressContext: 'TARGETED',
      }),
    ]);
    mockPrisma.userProgress.findMany.mockResolvedValue([
      makeUserProgress({
        id: 'progress-duplicate-card',
        conditionId: 'condition-1',
        progressContext: 'TARGETED',
      }),
      makeUserProgress({
        id: 'progress-duplicate-topic',
        conditionId: 'condition-2',
        progressContext: 'TARGETED',
      }),
      makeUserProgress({
        id: 'progress-kept',
        conditionId: 'condition-3',
        progressContext: 'TARGETED',
      }),
    ]);

    const result = await captured.handler(makeContext({ validated: { limit: 100 } }));

    expect(result.data.items.map((item: any) => item.id)).toEqual(
      expect.arrayContaining(['card-1', 'topic-kept', 'progress-kept'])
    );
    expect(result.data.items.map((item: any) => item.id)).not.toEqual(
      expect.arrayContaining([
        'topic-duplicate',
        'progress-duplicate-card',
        'progress-duplicate-topic',
      ])
    );
    expect(result.data.totalDue).toBe(3);
    expect(result.data.suppressedDuplicates).toBe(3);
  });

  it('overdueDays is floored at 0 for items due in the past but same day', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    // Due 6 hours ago — less than 1 full day
    const item = makeTopicProgress({
      nextReviewDate: new Date('2026-04-07T06:00:00Z'),
    });
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([item]);

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

    await captured.handler(makeContext());

    const cardCall = mockPrisma.card.findMany.mock.calls[0][0];
    expect(cardCall.where.userId).toBe('user-1');
    expect(cardCall.where.due.lte).toBeInstanceOf(Date);
    expect(cardCall.orderBy).toEqual([{ due: 'asc' }, { difficulty: 'desc' }]);
    const topicCall = mockPrisma.userTopicProgress.findMany.mock.calls[0][0];
    expect(topicCall.where.userId).toBe('user-1');
    expect(topicCall.where.nextReviewDate.lte).toBeInstanceOf(Date);
    expect(topicCall.orderBy).toEqual([{ nextReviewDate: 'asc' }, { difficulty: 'desc' }]);
    const conditionCall = mockPrisma.userProgress.findMany.mock.calls[0][0];
    expect(conditionCall.where.userId).toBe('user-1');
    expect(conditionCall.where.nextReviewAt.lte).toBeInstanceOf(Date);
    expect(conditionCall.orderBy).toEqual([{ nextReviewAt: 'asc' }, { fsrsDifficulty: 'desc' }]);
  });

  it('includes due Card rows with question IDs for study-mode launchers', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.card.findMany.mockResolvedValue([
      makeCardProgress({ due: new Date('2026-04-01T12:00:00Z') }),
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toEqual(
      expect.objectContaining({
        source: 'card',
        questionId: 'question-1',
        questionIdentityId: 'identity-question-1',
        conditionId: 'medical-content-3',
        system: 'Cardiovascular',
      })
    );
  });

  it('filters due Card rows whose linked question is not production safe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.card.findMany.mockResolvedValue([
      makeCardProgress({
        id: 'unsafe-card',
        Question: {
          conditionId: 'condition-3',
          medicalContentId: 'medical-content-3',
          system: 'Cardiovascular',
          taskType: 'diagnosis',
          lifecycleStatus: 'DRAFT',
          qaStatus: 'PENDING',
        },
      }),
    ]);

    const result = await captured.handler(makeContext());

    expect(result.data.items).toEqual([]);
    expect(result.data.totalDue).toBe(0);
  });
});

// Dashboard consumer contract (Implementation Expansion Pass — Phase 2).
// Locks the response shape the dashboard/study-queue depends on so it cannot
// silently drift. Runs with mocked prisma/auth — no real Clerk/Supabase.
describe('GET /api/srs/due — dashboard response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00Z'));
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.userTopicProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
  });
  afterEach(() => vi.useRealTimers());

  it('always exposes the stable top-level keys dashboard callers read', async () => {
    const result = await captured.handler(makeContext());
    expect(result.data).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        totalDue: expect.any(Number),
        timestamp: expect.any(String),
      })
    );
    // Empty state is a 200-shaped payload, never a thrown 500.
    expect(result.status).toBeUndefined();
  });

  it('each due item carries the keys the study-queue launcher needs', async () => {
    mockPrisma.card.findMany.mockResolvedValue([
      makeCardProgress({ due: new Date('2026-04-01T12:00:00Z') }),
    ]);
    const result = await captured.handler(makeContext());
    expect(result.data.items).toHaveLength(1);
    const item = result.data.items[0];
    for (const key of [
      'id',
      'source',
      'questionId',
      'conditionId',
      'dueDate',
      'overdueDays',
      'priority',
    ]) {
      expect(item).toHaveProperty(key);
    }
    expect(typeof item.dueDate).toBe('string'); // ISO string, JSON-safe for the client
    expect(typeof item.priority).toBe('number');
  });

  it('degraded (error) payload still matches the consumer contract (no 500)', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const result = await captured.handler(makeContext());
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [],
        totalDue: 0,
        timestamp: expect.any(String),
      })
    );
    expect(result.status).toBeUndefined();
  });
});
