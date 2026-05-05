import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  postHandler: null as ((context: any) => Promise<any>) | null,
}));

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  medicalContent: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const gatewayMock = vi.hoisted(() => {
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
      this.task = args.task ?? 'enrichment';
    }
  }

  return {
    gateway: { callStructured: vi.fn() },
    GatewayError: MockGatewayError,
    toGatewayContext: vi.fn((context: any) => ({ env: context.env, auth: context.auth })),
  };
});

const auditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../_shared/middleware', () => ({
  adminEndpoint: vi.fn((_schema: unknown, handler: any) => {
    capture.postHandler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => prismaMock),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../_shared/auditLog', () => ({
  auditLog: auditLogMock,
}));

vi.mock('../../../lib/ai/aiGateway', () => gatewayMock);

import './enrich-condition';

function makeContext(body: Record<string, unknown>) {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      CLERK_SECRET_KEY: 'sk_test_123',
      GEMINI_API_KEY: 'gemini-key',
    },
    auth: { userId: 'clerk_admin_1' },
    validated: { body },
  };
}

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mc-1',
    conditionId: 'pulmonary_embolism',
    condition: 'Pulmonary embolism',
    system: 'Pulmonary',
    subcategory: 'Vascular',
    overview: null,
    buzzwords: [],
    treatment: 'Anticoagulation when appropriate.',
    content: { existing: true },
    ...overrides,
  };
}

describe('POST /api/admin/enrich-condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
    prismaMock.medicalContent.findUnique.mockResolvedValue(makeContent());
    prismaMock.medicalContent.update.mockResolvedValue(makeContent());
    gatewayMock.gateway.callStructured.mockResolvedValue({
      mode: 'structured',
      data: {
        fields: {
          overview: 'Pulmonary embolism is obstruction of pulmonary arterial flow by thrombus.',
          buzzwords: ['pleuritic chest pain', 'tachycardia', 'dyspnea'],
          treatment: 'This should be ignored unless requested.',
        },
        display_priority: {
          primary: 'buzzwords',
          secondary: 'best_initial_test',
          reasoning: 'Board recognition often hinges on classic presentation clues.',
        },
      },
      rawText: '{}',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      telemetry: {
        requestId: 'req-1',
        traceId: 'trace-1',
        task: 'enrichment',
        modelUsed: 'test-model',
        provider: 'gemini',
        endpoint: '/api/admin/enrich-condition',
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

  it('uses the shared structured gateway and updates only requested enrichable fields', async () => {
    const result = await capture.postHandler!(
      makeContext({
        conditionId: 'pulmonary_embolism',
        fieldsToEnrich: ['overview', 'buzzwords', 'not_a_real_field'],
        forceRegenerate: true,
      }),
    );

    expect(result).toMatchObject({
      data: {
        conditionId: 'pulmonary_embolism',
        condition: 'Pulmonary embolism',
        fieldsUpdated: ['overview', 'buzzwords'],
        success: true,
      },
    });
    expect(gatewayMock.gateway.callStructured).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { userId: 'clerk_admin_1' } }),
      expect.objectContaining({
        mode: 'structured',
        task: 'enrichment',
        endpoint: '/api/admin/enrich-condition',
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(prismaMock.medicalContent.update).toHaveBeenCalledWith({
      where: { conditionId: 'pulmonary_embolism' },
      data: expect.objectContaining({
        overview: 'Pulmonary embolism is obstruction of pulmonary arterial flow by thrombus.',
        buzzwords: ['pleuritic chest pain', 'tachycardia', 'dyspnea'],
        content: expect.objectContaining({
          existing: true,
          display_priority: expect.objectContaining({ primary: 'buzzwords' }),
        }),
        updatedBy: 'user-db-1',
      }),
    });
    expect(prismaMock.medicalContent.update.mock.calls[0]?.[0].data).not.toHaveProperty(
      'treatment',
    );
    expect(auditLogMock).toHaveBeenCalledWith('admin_enrich_condition', {
      userId: 'clerk_admin_1',
      conditionId: 'pulmonary_embolism',
      fieldsUpdated: ['overview', 'buzzwords'],
    });
  });

  it('fails closed without writing content when gateway enrichment fails', async () => {
    gatewayMock.gateway.callStructured.mockRejectedValue(
      new gatewayMock.GatewayError({
        code: 'SERVER_ERROR',
        message: 'provider unavailable',
      }),
    );

    const result = await capture.postHandler!(
      makeContext({
        conditionId: 'pulmonary_embolism',
        fieldsToEnrich: ['overview'],
        forceRegenerate: true,
      }),
    );

    expect(result).toMatchObject({
      status: 502,
      data: { error: 'Content enrichment failed: SERVER_ERROR' },
    });
    expect(prismaMock.medicalContent.update).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
