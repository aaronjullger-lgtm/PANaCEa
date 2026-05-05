import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const mockPrisma: any = {};
const ragMock = vi.hoisted(() => ({
  retrieveForExplanation: vi.fn(),
  formatContextForPrompt: vi.fn(),
  assessRetrievalQuality: vi.fn(),
}));
const aiGatewayMock = vi.hoisted(() => {
  class MockGatewayError extends Error {
    code: string;
    retryable: boolean;
    requestId: string;
    traceId: string;
    task: string;

    constructor(args: {
      code: string;
      message: string;
      retryable?: boolean;
      requestId?: string;
      traceId?: string;
      task?: string;
    }) {
      super(args.message);
      this.name = 'GatewayError';
      this.code = args.code;
      this.retryable = args.retryable ?? false;
      this.requestId = args.requestId ?? 'req-1';
      this.traceId = args.traceId ?? 'trace-1';
      this.task = args.task ?? 'tutoring';
    }
  }

  return {
    gateway: { callStructured: vi.fn() },
    GatewayError: MockGatewayError,
    toGatewayContext: vi.fn((context: any) => ({ env: context.env, auth: context.auth })),
  };
});

vi.mock('../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../lib/services/ragContextService', () => ragMock);

vi.mock('../../../lib/ai/aiGateway', () => aiGatewayMock);

import './explain-rag';

function makeContext() {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      CLERK_SECRET_KEY: 'sk_test_123',
      GEMINI_API_KEY: 'gemini-key',
    },
    auth: { userId: 'clerk_user_1' },
    validated: {
      questionId: 'q-1',
      questionText: 'Question text',
      selectedAnswer: 'A',
      correctAnswer: 'B',
      system: 'Cardiovascular',
      allOptions: ['A', 'B', 'C', 'D'],
    },
  };
}

describe('POST /api/questions/explain-rag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    ragMock.retrieveForExplanation.mockResolvedValue({
      chunks: [{ sourceId: 'source-1' }],
      retrievalScores: [0.8],
      isGrounded: true,
    });
    ragMock.formatContextForPrompt.mockReturnValue('Clinical context');
    ragMock.assessRetrievalQuality.mockReturnValue({ grade: 'good', message: 'Grounded' });
    aiGatewayMock.gateway.callStructured.mockResolvedValue({
      mode: 'structured',
      data: {
        whyCorrect: 'The correct answer fits the reference-backed clinical findings in this patient.',
        whyWrong: 'The selected answer does not explain the reference-backed findings as well.',
        whenWrongWouldBeRight:
          'The selected answer would fit a different presentation with the distinguishing finding present.',
        clinicalPearl: 'Anchor the answer to the decisive clinical distinction.',
        keyDistinction: 'The reference-backed distinguishing finding.',
        relatedConcepts: ['Cardiovascular'],
      },
      rawText: '{}',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      telemetry: {
        requestId: 'req-1',
        traceId: 'trace-1',
        task: 'tutoring',
        modelUsed: 'test-model',
        provider: 'gemini',
        endpoint: '/api/questions/explain-rag',
        latencyMs: 1,
        latencyBucket: 'under_100ms',
        attempts: 1,
        fallbackUsed: false,
        schemaRepairUsed: false,
        costUsd: 0,
        costModelFound: true,
      },
    });
  });

  it('generates a validated explanation through the shared AI gateway', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await _capture.handler!(makeContext());

    expect(result.data.fallback).toBe(false);
    expect(result.data.explanation.whyCorrect).toContain('correct answer');
    expect(result.data.explanation.whyWrong).toContain('selected answer');
    expect(result.data.ragMetadata.sourceChunkIds).toEqual(['source-1']);
    expect(result.status).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(aiGatewayMock.gateway.callStructured).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { userId: 'clerk_user_1' } }),
      expect.objectContaining({
        mode: 'structured',
        task: 'tutoring',
        endpoint: '/api/questions/explain-rag',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed instead of returning synthetic clinical fallback text when the gateway fails', async () => {
    aiGatewayMock.gateway.callStructured.mockRejectedValue(
      new aiGatewayMock.GatewayError({
        code: 'SERVER_ERROR',
        message: 'provider unavailable',
        requestId: 'req-failed',
        traceId: 'trace-failed',
      }),
    );

    const result = await _capture.handler!(makeContext());

    expect(result.status).toBe(502);
    expect(result.error).toContain('temporarily unavailable');
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
    expect(result.details.fallback).toBe(false);
    expect(result.data).toBeUndefined();
  });
});
