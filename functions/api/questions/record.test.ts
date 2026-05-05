import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveUserByClerkId = vi.hoisted(() => vi.fn());

const mockPrisma: any = {
  user: { findUnique: vi.fn() },
  question: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  preGeneratedQuestion: { findFirst: vi.fn() },
  userQuestionSeen: { upsert: vi.fn() },
  questionAttempt: { create: vi.fn() },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body =
      result.error != null
        ? JSON.stringify({ error: result.error })
        : JSON.stringify(result.data ?? result);
    return new Response(body, {
      status,
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

vi.mock('../_shared/resolveUser', () => ({
  resolveUserByClerkId: mockResolveUserByClerkId,
}));

vi.mock('../../../config/training-modes', () => ({
  isRankedMode: vi.fn(() => false),
}));

vi.mock('../../../lib/services/userStatsService', () => ({
  updateGlobalAccuracy: vi.fn(),
}));

vi.mock('../../../lib/answerLetterMap', () => ({
  resolveCorrectAnswerIndex: vi.fn((answer: string, options: string[]) => {
    const letterIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(answer.trim().toUpperCase());
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;
    const textIndex = options.findIndex((option) => option === answer.trim());
    return textIndex >= 0 ? textIndex : null;
  }),
}));

import { onRequestPost } from './record';

function makeContext(questionId = 'pg-1') {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk-user-1' },
    validated: {
      body: {
        questionId,
        questionType: 'mcq',
        system: 'Pulmonary',
        wasCorrect: true,
        mode: 'session',
      },
    },
  };
}

async function callEndpoint(context: any): Promise<{ status: number; body: any }> {
  const response = (await (onRequestPost as any)(context)) as Response;
  return { status: response.status, body: await response.json() };
}

describe('POST /api/questions/record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockResolveUserByClerkId.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.question.findFirst.mockResolvedValue(null);
    mockPrisma.preGeneratedQuestion.findFirst.mockResolvedValue(null);
    mockPrisma.question.upsert.mockResolvedValue({});
    mockPrisma.userQuestionSeen.upsert.mockResolvedValue({});
    mockPrisma.questionAttempt.create.mockResolvedValue({});
  });

  it('only mirrors approved pre-generated questions before recording attempts', async () => {
    mockPrisma.preGeneratedQuestion.findFirst.mockResolvedValue({
      id: 'pg-1',
      questionData: {
        vignette: 'A patient has sudden dyspnea.',
        question: 'What is the best next test?',
        options: ['D-dimer', 'CT pulmonary angiography', 'Peak flow', 'ECG'],
        correctAnswer: 'B',
        explanation: 'CTPA is appropriate when PE suspicion is high.',
      },
      conditionId: 'cond-1',
      medicalContentId: 'content-1',
      system: 'Pulmonary',
      difficulty: 'medium',
      generatedAt: new Date('2026-05-01T00:00:00Z'),
    });

    const { status, body } = await callEndpoint(makeContext());

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.preGeneratedQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pg-1',
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: 'pg-1',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
          humanReviewed: true,
        }),
      })
    );
    expect(mockPrisma.questionAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: 'pg-1',
          conditionId: 'cond-1',
          medicalContentId: 'content-1',
        }),
      })
    );
  });

  it('requires direct canonical questions to pass production serving safety before recording', async () => {
    mockPrisma.question.findFirst.mockResolvedValue({
      id: 'q-approved-1',
      conditionId: 'cond-1',
      medicalContentId: 'content-1',
    });

    const { status, body } = await callEndpoint(makeContext('q-approved-1'));

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-approved-1',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockPrisma.preGeneratedQuestion.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.userQuestionSeen.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_questionId_questionType: {
            userId: 'user-db-1',
            questionId: 'q-approved-1',
            questionType: 'mcq',
          },
        },
      })
    );
  });

  it('fails closed when a pre-generated question is not approved or mirrorable', async () => {
    const { status, body } = await callEndpoint(makeContext('pending-pg'));

    expect(status).toBe(400);
    expect(body.error).toMatch(/not canonical or mirrorable/i);
    expect(mockPrisma.question.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.questionAttempt.create).not.toHaveBeenCalled();
  });

  it('fails closed for direct canonical IDs that are not active and approved', async () => {
    mockPrisma.question.findFirst.mockResolvedValue(null);
    mockPrisma.preGeneratedQuestion.findFirst.mockResolvedValue(null);

    const { status, body } = await callEndpoint(makeContext('draft-question'));

    expect(status).toBe(400);
    expect(body.error).toMatch(/not canonical or mirrorable/i);
    expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'draft-question',
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
    expect(mockPrisma.questionAttempt.create).not.toHaveBeenCalled();
  });
});
