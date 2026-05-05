import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  card: { findMany: vi.fn() },
  userProgress: { findMany: vi.fn() },
  reviewLog: { findMany: vi.fn() },
}));

vi.mock('../../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/aiGateway', () => ({
  GatewayError: class GatewayError extends Error {
    code = 'TEST';
    requestId = 'req-test';
    traceId = 'trace-test';
  },
  gateway: {
    tutor: vi.fn().mockResolvedValue({
      blocked: false,
      text: 'Which finding in the vignette challenges your selected answer?',
      telemetry: {
        modelUsed: 'mock-tutor',
        provider: 'mock',
        latencyMs: 12,
        fallbackUsed: false,
      },
      usage: {
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
      },
    }),
  },
  toGatewayContext: vi.fn(() => ({ env: {} })),
}));

vi.mock('@/lib/observability/langfuse', () => ({
  createTrace: vi.fn(() => null),
}));

import { gateway } from '@/lib/ai/aiGateway';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import './socratic';

function makeContext(body: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123' },
    auth: { userId: 'clerk_user_1' },
    validated: {
      body: {
        vignette: 'A patient has pleuritic chest pain after surgery.',
        question: 'What is the most likely diagnosis?',
        correctAnswer: 'Pulmonary embolism',
        userWrongAnswer: 'Pneumonia',
        options: ['Pulmonary embolism', 'Pneumonia', 'Asthma', 'GERD'],
        ...body,
      },
    },
    waitUntil: vi.fn(),
  };
}

describe('POST /api/ai/learning/socratic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (gateway.tutor as Mock).mockResolvedValue({
      blocked: false,
      text: 'Which finding in the vignette challenges your selected answer?',
      telemetry: {
        modelUsed: 'mock-tutor',
        provider: 'mock',
        latencyMs: 12,
        fallbackUsed: false,
      },
      usage: {
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
      },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.reviewLog.findMany.mockResolvedValue([]);
  });

  it('calibrates Socratic depth from read-only question history', async () => {
    mockPrisma.card.findMany.mockResolvedValue([
      {
        progressContext: 'TARGETED',
        stability: 1,
        difficulty: 8,
        reps: 6,
        lapses: 2,
        last_review: new Date(Date.now() - 20 * 86_400_000),
      },
    ]);
    mockPrisma.reviewLog.findMany.mockResolvedValue([
      {
        grade: 1,
        wasCorrect: false,
        stability: 1,
        difficulty: 8,
        retrievability: 0.2,
      },
    ]);

    const response = await _capture.handler!(
      makeContext({
        questionId: 'q-1',
        conditionId: 'cond-1',
        turnNumber: 1,
        history: [{ role: 'user', text: 'I thought surgery pointed to pneumonia.' }],
      }),
    );

    expect(response.data.guidingQuestion).toContain('Which finding');
    expect(createEdgePrismaClient).toHaveBeenCalledWith('postgresql://test');
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-db-1', questionId: 'q-1' },
      }),
    );
    expect(mockPrisma.reviewLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-db-1',
          OR: [{ questionId: 'q-1' }, { conditionId: 'cond-1' }],
        }),
      }),
    );

    const tutorArgs = (gateway.tutor as Mock).mock.calls[0][1];
    expect(tutorArgs.systemPrompt).toContain('Recall probability: Low');
    expect(tutorArgs.systemPrompt).toContain('HINT LEVEL 2');
    expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('uses a provided learner state without opening a history lookup', async () => {
    await _capture.handler!(
      makeContext({
        questionId: 'q-1',
        fsrsState: {
          retrievability: 0.85,
          difficulty: 4,
          stability: 12,
          reviewCount: 10,
          lapseCount: 0,
        },
        turnNumber: 0,
      }),
    );

    expect(createEdgePrismaClient).not.toHaveBeenCalled();
    const tutorArgs = (gateway.tutor as Mock).mock.calls[0][1];
    expect(tutorArgs.systemPrompt).toContain('Recall probability: High');
  });

  it('falls back to a generic prompt when history lookup fails', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db unavailable'));

    const response = await _capture.handler!(makeContext({ questionId: 'q-1' }));

    expect(response.data.guidingQuestion).toContain('Which finding');
    const tutorArgs = (gateway.tutor as Mock).mock.calls[0][1];
    expect(tutorArgs.systemPrompt).toContain('The student got this question wrong');
    expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
  });
});
