import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  captured,
  mockDisconnect,
  mockLogger,
  mockPerformanceRecordFindMany,
  mockQuestionIdentityCreateMany,
  mockQuestionIdentityFindMany,
  mockResolveOrCreateUserId,
  mockSavedQuestionCreateMany,
  mockSavedQuestionDeleteMany,
  mockSavedQuestionFindMany,
} = vi.hoisted(() => ({
  captured: { handlers: [] as Array<(context: any) => Promise<any>> },
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockPerformanceRecordFindMany: vi.fn(),
  mockQuestionIdentityCreateMany: vi.fn(),
  mockQuestionIdentityFindMany: vi.fn(),
  mockResolveOrCreateUserId: vi.fn(),
  mockSavedQuestionCreateMany: vi.fn(),
  mockSavedQuestionDeleteMany: vi.fn(),
  mockSavedQuestionFindMany: vi.fn(),
}));

const mockPrisma = {
  performanceRecord: {
    findMany: mockPerformanceRecordFindMany,
    createMany: vi.fn(),
  },
  savedQuestion: {
    findMany: mockSavedQuestionFindMany,
    deleteMany: mockSavedQuestionDeleteMany,
    createMany: mockSavedQuestionCreateMany,
  },
  questionIdentity: {
    createMany: mockQuestionIdentityCreateMany,
    findMany: mockQuestionIdentityFindMany,
  },
};

vi.mock('./_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (context: any) => Promise<any>) => {
    captured.handlers.push(handler);
    return handler;
  },
}));

vi.mock('./_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => mockPrisma,
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('./_shared/secureLogger', () => ({
  createEndpointLogger: () => mockLogger,
}));

vi.mock('./_shared/cache', () => ({
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  isKVAvailable: vi.fn(() => false),
}));

vi.mock('./_shared/user-resolver', () => ({
  resolveOrCreateUserId: (...args: unknown[]) => mockResolveOrCreateUserId(...args),
}));

import './sync';

function makePostContext(payload: Record<string, unknown>) {
  return {
    env: { DATABASE_URL: 'prisma://test' },
    auth: { userId: 'clerk-user-1' },
    validated: {
      userId: 'clerk-user-1',
      ...payload,
    },
  };
}

describe('POST /api/sync saved-question identity links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserId.mockResolvedValue('user-db-1');
    mockSavedQuestionFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockQuestionIdentityCreateMany.mockResolvedValue({ count: 1 });
    mockQuestionIdentityFindMany.mockResolvedValue([
      {
        id: 'qi_pre_generated_pg-1',
        questionSource: 'pre_generated',
        sourceQuestionId: 'pg-1',
      },
    ]);
    mockSavedQuestionDeleteMany.mockResolvedValue({ count: 0 });
    mockSavedQuestionCreateMany.mockResolvedValue({ count: 1 });
    mockPerformanceRecordFindMany.mockResolvedValue([]);
  });

  it('persists questionIdentityId for synced saved questions when source metadata is present', async () => {
    const postHandler = captured.handlers[1];

    const result = await postHandler!(
      makePostContext({
        savedQuestions: [
          {
            questionId: 'pg-1',
            canonicalQuestionId: 'q-1',
            sourceQuestionId: 'pg-1',
            questionSource: 'pre_generated',
            type: 'saved',
            questionText: 'Which murmur increases with Valsalva?',
            correctAnswer: 'Hypertrophic cardiomyopathy',
            explanation: 'Reduced preload increases obstruction.',
            topic: 'Cardiology',
            system: 'Cardiovascular',
            medicalContentId: 'mc-1',
            conditionId: 'mc-1',
            updatedAt: '2026-05-01T12:00:00.000Z',
          },
        ],
      })
    );

    expect(mockQuestionIdentityCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          questionSource: 'pre_generated',
          sourceQuestionId: 'pg-1',
          canonicalQuestionId: 'q-1',
          preGeneratedQuestionId: 'pg-1',
          provenance: expect.objectContaining({
            writer: 'sync-saved-questions',
            medicalContentId: 'mc-1',
            conditionId: 'mc-1',
            system: 'Cardiovascular',
            selectionSource: 'saved_question_sync',
          }),
        }),
      ],
      skipDuplicates: true,
    });
    expect(mockSavedQuestionCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-db-1',
          questionId: 'pg-1',
          questionIdentityId: 'qi_pre_generated_pg-1',
          type: 'saved',
        }),
      ],
      skipDuplicates: true,
    });
    expect(result.data.success).toBe(true);
    expect(mockDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
