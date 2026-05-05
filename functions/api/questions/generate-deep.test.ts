import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGateway, mockLogger } = vi.hoisted(() => ({
  mockGateway: {
    callText: vi.fn(),
  },
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../_shared/middleware', () => ({
  adminAuthenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => mockLogger),
}));

vi.mock('../../../lib/ai/aiGateway', () => ({
  gateway: mockGateway,
  toGatewayContext: vi.fn((context: unknown) => context),
  GatewayError: class GatewayError extends Error {
    code: string;
    retryable = false;
    requestId = 'req-1';
    traceId = 'trace-1';

    constructor(message: string, code = 'TEST_GATEWAY_ERROR') {
      super(message);
      this.code = code;
    }
  },
}));

import { onRequestPost } from './generate-deep';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: {
      GEMINI_API_KEY: 'test-key',
      CACHE_PANCE_MASTER_NAME: 'cache_pance_master_v1',
    },
    auth: { userId: 'admin-user-1' },
    validated: {
      body: {
        condition: 'Asthma',
        category: 'Pulmonary',
        count: 1,
      },
    },
    ...overrides,
  } as never;
}

async function parseJsonResponse(response: unknown) {
  expect(response).toBeInstanceOf(Response);
  return (response as Response).json();
}

describe('POST /api/questions/generate-deep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGateway.callText.mockResolvedValue({
      blocked: false,
      text: JSON.stringify({
        questions: [
          {
            question: 'A patient has episodic wheezing. Which test confirms the diagnosis?',
            options: ['Spirometry', 'CT pulmonary angiography', 'Chest x-ray', 'D-dimer'],
            correctAnswerIndex: 0,
            explanation: 'Spirometry confirms reversible airflow obstruction.',
            system: 'Pulmonary',
          },
        ],
      }),
    });
  });

  it('returns admin-only preview metadata instead of failed-staging metadata', async () => {
    const result = await onRequestPost(makeContext());
    const body = await parseJsonResponse(result);

    expect(body).toMatchObject({
      ok: true,
      data: {
        questions: [
          {
            submissionReady: false,
            requiresApproval: true,
            metadata: {
              source: 'generate-deep-preview',
              persistence: 'admin_preview_only',
              adminPreviewOnly: true,
              submissionReady: false,
              requiresApproval: true,
              condition: 'Asthma',
              category: 'Pulmonary',
            },
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toContain('not_staged');
  });
});
