import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<Response>) | null,
}));

const prismaMock = vi.hoisted(() => ({
  medicalContent: {
    findFirst: vi.fn(),
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
      this.task = args.task ?? 'extraction';
    }
  }

  return {
    gateway: { callStructured: vi.fn() },
    GatewayError: MockGatewayError,
    toGatewayContext: vi.fn((context: any) => ({ env: context.env, auth: context.auth })),
  };
});

vi.mock('../../_shared/middleware', () => ({
  aiEndpoint: vi.fn((_schema: unknown, handler: any) => {
    capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => prismaMock),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../../lib/ai/aiGateway', () => gatewayMock);

import './structured';

function makeContext(identifier = 'asthma') {
  return {
    request: new Request('https://example.test/api/conditions/asthma/structured'),
    env: {
      DATABASE_URL: 'postgresql://test',
      CLERK_SECRET_KEY: 'sk_test_123',
      GEMINI_API_KEY: 'gemini-key',
    },
    auth: { userId: 'clerk_user_1' },
    validated: { params: { identifier } },
  };
}

function makeCondition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mc-1',
    condition: 'Asthma',
    content: { overview: 'Asthma is a chronic airway disease.' },
    overview: 'Asthma is a chronic airway disease.',
    pathophysiology: 'Airway inflammation and bronchoconstriction.',
    symptoms: 'Wheezing and episodic dyspnea.',
    physicalExam: 'Expiratory wheezes.',
    diagnostics: 'Spirometry with reversible obstruction.',
    treatment: 'SABA for rescue and ICS for persistent disease.',
    differentialDiagnosis: 'COPD, CHF, vocal cord dysfunction.',
    gold_standard_dx: 'Spirometry',
    first_line_rx: 'Inhaled corticosteroid for persistent asthma',
    clinical_pearls: 'Night symptoms suggest poor control.',
    best_initial_test: 'Spirometry',
    ...overrides,
  };
}

async function readData(response: Response) {
  expect(response).toBeInstanceOf(Response);
  const body = await response.json() as { data?: unknown; ok?: boolean };
  expect(body.ok).toBe(true);
  return body.data as Record<string, unknown>;
}

describe('GET /api/conditions/:identifier/structured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.medicalContent.findFirst.mockResolvedValue(makeCondition());
    gatewayMock.gateway.callStructured.mockResolvedValue({
      mode: 'structured',
      data: {
        clinical_pearls: ['Use spirometry to confirm reversible obstruction.'],
        history_key_features: ['Episodic wheeze', 'Nocturnal symptoms'],
        physical_exam_findings: ['Expiratory wheezing'],
        diagnostic_labs: ['Spirometry with bronchodilator response'],
        gold_standard: 'Spirometry',
        treatment_first_line: 'Inhaled corticosteroid',
      },
      rawText: '{}',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      telemetry: {
        requestId: 'req-1',
        traceId: 'trace-1',
        task: 'extraction',
        modelUsed: 'test-model',
        provider: 'gemini',
        endpoint: '/api/conditions/[identifier]/structured',
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

  it('extracts structured condition cards through the shared AI gateway', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await capture.handler!(makeContext());
    const data = await readData(response);

    expect(data.source).toBe('gateway');
    expect(data.clinical_pearls).toEqual([
      'Use spirometry to confirm reversible obstruction.',
    ]);
    expect(gatewayMock.gateway.callStructured).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { userId: 'clerk_user_1' } }),
      expect.objectContaining({
        mode: 'structured',
        task: 'extraction',
        endpoint: '/api/conditions/[identifier]/structured',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to trusted stored fields when structured extraction fails', async () => {
    gatewayMock.gateway.callStructured.mockRejectedValue(
      new gatewayMock.GatewayError({
        code: 'SERVER_ERROR',
        message: 'provider unavailable',
      }),
    );

    const response = await capture.handler!(makeContext());
    const data = await readData(response);

    expect(response.status).toBe(200);
    expect(data.source).toBe('fallback');
    expect(data.gold_standard).toBe('Spirometry');
    expect(data.treatment_first_line).toBe('Inhaled corticosteroid for persistent asthma');
    expect(data.clinical_pearls).toEqual([]);
  });
});
