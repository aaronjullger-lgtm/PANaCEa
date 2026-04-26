import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<Response>) | null,
}));

const _logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockPrisma: any = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  userQuestionSeen: { findMany: vi.fn() },
  preGeneratedQuestion: { findMany: vi.fn() },
  question: { findMany: vi.fn() },
  studySession: { upsert: vi.fn() },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => _logger),
}));

vi.mock('../../../lib/services/conceptQuestionSelector', () => ({
  selectSessionQuestions: vi.fn(),
}));

vi.mock('../../../lib/services/reservoir', () => ({
  reserveFromReservoir: vi.fn().mockResolvedValue([]),
  requestRefill: vi.fn().mockResolvedValue(undefined),
  deriveScope: vi.fn(() => ({ kind: 'adaptive' })),
}));

vi.mock('../../../lib/nccpa-question-weighting', () => ({
  inferLearnerPhase: vi.fn(() => 'pance_prep'),
}));

import { selectSessionQuestions } from '../../../lib/services/conceptQuestionSelector';
import { reserveFromReservoir } from '../../../lib/services/reservoir';
import { safePrismaDisconnect } from '../_shared/prisma-edge';
import './session/generate';

function makeContext(body: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk_user_1' },
    validated: {
      body: {
        mode: 'adaptive',
        size: 2,
        blueprintWeights: { Cardiovascular: 1 },
        blueprintStage: 'pance_prep',
        gatedSystems: [],
        ...body,
      },
    },
    waitUntil: vi.fn(),
  };
}

function makePregenerated(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    system: 'Cardiovascular',
    difficulty: 'medium',
    conditionId: 'cond-1',
    medicalContentId: 'mc-1',
    questionData: {
      stem: `Question ${id}?`,
      options: ['A option', 'B option', 'C option', 'D option'],
      correctAnswer: 'B',
      explanation: 'Because B is correct.',
      ...overrides,
    },
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<any>;
}

describe('POST /api/study/session/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-db-1',
      currentRotation: null,
      eorTestDate: null,
      rotationEndDate: null,
      examDate: null,
      yearInProgram: null,
      trainingPhase: null,
    });
    mockPrisma.user.create.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      makePregenerated('pg-1'),
      makePregenerated('pg-2', { correctAnswer: 'C' }),
    ]);
    mockPrisma.studySession.upsert.mockResolvedValue({});
    (reserveFromReservoir as Mock).mockResolvedValue([]);
    (selectSessionQuestions as Mock).mockResolvedValue({
      sessionId: 'ses_on_demand',
      questions: [],
      metadata: {
        dueReviewCount: 0,
        newCardCount: 0,
        systemDistribution: {},
        estimatedMinutes: 0,
        mode: 'adaptive',
        blueprintStage: 'pance_prep',
      },
    });
  });

  it('starts a session for a first-login user and fills from pre-generated questions', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-db-1',
        currentRotation: null,
        eorTestDate: null,
        rotationEndDate: null,
        examDate: null,
        yearInProgram: null,
        trainingPhase: null,
      });

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.sessionId).toBe('ses_on_demand');
    expect(body.data.questions).toHaveLength(2);
    expect(body.data.questions[0].correctAnswerIndex).toBe(1);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_user_1',
          email: 'clerk_user_1@placeholder.panacea.app',
        }),
      }),
    );
    expect(mockPrisma.studySession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-db-1',
          totalQuestions: 2,
          questionIds: ['pg-1', 'pg-2'],
        }),
      }),
    );
  });

  it('filters bad question data instead of serving unscorable cards', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([
      makePregenerated('bad-1', { correctAnswer: 'Z' }),
      makePregenerated('good-1', { correctAnswer: 'A' }),
    ]);

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions.map((q: any) => q.id)).toEqual(['good-1']);
    expect(body.data.questions[0].correctAnswerIndex).toBe(0);
  });

  it('returns a safe empty session when the question pool is exhausted', async () => {
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);

    const response = await _capture.handler!(makeContext());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.questions).toEqual([]);
    expect(body.data.metadata.newCardCount).toBe(0);
    expect(mockPrisma.studySession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalQuestions: 0,
          questionIds: [],
        }),
      }),
    );
  });

  it('respects system filters when using the pre-generated fallback', async () => {
    await _capture.handler!(makeContext({ mode: 'system', system: 'Pulmonary' }));

    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { system: 'Pulmonary' },
      }),
    );
  });

  it('disconnects prisma after generation', async () => {
    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
