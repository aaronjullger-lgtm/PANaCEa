import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  getHandler: null as ((context: any) => Promise<any>) | null,
  postHandler: null as ((context: any) => Promise<any>) | null,
  postOptions: null as Record<string, unknown> | null,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockPrisma: any = {
  preGeneratedQuestion: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  userQuestionSeen: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
};

const _user = vi.hoisted(() => ({
  value: { id: 'user-db-1', role: 'USER' },
}));

const _cache = vi.hoisted(() => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  isKVAvailable: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.getHandler = handler;
    return handler;
  }),
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any, options?: Record<string, unknown>) => {
    _capture.postHandler = handler;
    _capture.postOptions = options ?? null;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
  CACHE_STRATEGY: {
    QUESTIONS: {},
    AGGREGATE: {},
  },
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: vi.fn(() => Promise.resolve(_user.value)),
}));

vi.mock('../_shared/cache', () => ({
  getFromCache: _cache.getFromCache,
  setInCache: _cache.setInCache,
  getQuestionPoolCacheKey: vi.fn(() => 'cache-key'),
  CACHE_CONFIG: { TTL: { QUESTION_POOL: 300 } },
  isKVAvailable: _cache.isKVAvailable,
}));

import './pool';

function makeContext() {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: 'clerk_user_1' },
    validated: {
      question: {
        id: 'seed-1',
        question: 'What is the best next step?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because A.',
        system: 'CV',
      },
    },
  };
}

describe('POST /api/questions/pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _user.value = { id: 'user-db-1', role: 'USER' };
    mockPrisma.preGeneratedQuestion.create.mockResolvedValue({});
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(0);
    mockPrisma.preGeneratedQuestion.updateMany.mockResolvedValue({});
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.question.upsert.mockResolvedValue({});
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.userQuestionSeen.createMany.mockResolvedValue({});
    _cache.getFromCache.mockResolvedValue(null);
    _cache.setInCache.mockResolvedValue(undefined);
    _cache.isKVAvailable.mockReturnValue(false);
  });

  it('rejects non-admin learner pool seed requests', async () => {
    const result = await _capture.postHandler!(makeContext());

    expect(result.status).toBe(403);
    expect(mockPrisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
  });

  it('allows admin seeding through body validation, not query validation', async () => {
    _user.value = { id: 'admin-db-1', role: 'ADMIN' };

    const result = await _capture.postHandler!(makeContext());

    expect(_capture.postOptions).toMatchObject({ requestsPerMinute: 30 });
    expect(result.status).toBe(201);
    expect(mockPrisma.preGeneratedQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'seed-1',
          validationStatus: 'approved',
          validatedAt: expect.any(Date),
          validatedBy: 'clerk_user_1',
          questionData: expect.objectContaining({
            correctAnswerIndex: 0,
          }),
        }),
      })
    );
    expect(mockPrisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seed-1' },
        create: expect.objectContaining({
          id: 'seed-1',
          question: 'What is the best next step?',
          source: 'admin_seed_pre_generated',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('fails closed when an admin seed has an unresolvable correct answer', async () => {
    _user.value = { id: 'admin-db-1', role: 'ADMIN' };
    const context = makeContext();
    context.validated.question.correctAnswer = 'Not an option';

    const result = await _capture.postHandler!(context);

    expect(result.status).toBe(400);
    expect(mockPrisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/questions/pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _user.value = { id: 'user-db-1', role: 'USER' };
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(0);
    mockPrisma.preGeneratedQuestion.updateMany.mockResolvedValue({});
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.question.upsert.mockResolvedValue({});
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.userQuestionSeen.createMany.mockResolvedValue({});
    _cache.getFromCache.mockResolvedValue(null);
    _cache.setInCache.mockResolvedValue(undefined);
    _cache.isKVAvailable.mockReturnValue(false);
  });

  it('does not trust cached pool rows without approved validation metadata', async () => {
    _cache.isKVAvailable.mockReturnValue(true);
    _cache.getFromCache.mockResolvedValue([
      {
        id: 'cached-unsafe',
        questionType: 'general',
        system: 'CV',
        conditionId: null,
        medicalContentId: null,
        difficulty: 'medium',
        questionData: {
          question: 'Cached unsafe question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'Unsafe cache entry.',
        },
        generatedAt: new Date(),
        usedAt: null,
      },
    ]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      {
        id: 'db-approved',
        questionType: 'general',
        system: 'CV',
        conditionId: null,
        medicalContentId: null,
        difficulty: 'medium',
        validationStatus: 'approved',
        questionData: {
          question: 'Approved DB question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'Approved entry.',
        },
        generatedAt: new Date(),
        usedAt: null,
      },
    ]);
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(1);

    const result = await _capture.getHandler!({
      env: { DATABASE_URL: 'postgresql://test', CACHE: {} },
      auth: { userId: 'clerk_user_1' },
      validated: { system: 'CV', count: '1' },
    });

    expect(result.data.questions.map((q: any) => q.id)).toEqual(['db-approved']);
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ validationStatus: 'approved' }),
      })
    );
  });
});
